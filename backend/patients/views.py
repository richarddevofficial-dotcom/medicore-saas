from decimal import Decimal

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction
from datetime import timedelta
from .models import Patient
from staff.models import StaffProfile
from saas_billing.services import check_hospital_limit
from .serializers import PatientListSerializer, PatientDetailSerializer
from billing.models import Bill, ServiceCatalog
from config.role_permissions import (
    CanManagePatients,
    CanViewPatientStats,
    IsClinicalStaff,
    IsDoctor,
    IsLabTechnician,
    IsReceptionist,
    get_staff_role,
)


def _resolve_request_hospital(request):
    user = request.user
    if user.is_superuser:
        hospital_id = (
            request.headers.get('X-Impersonating-Hospital-Id')
            or request.data.get('hospital_id')
            or request.query_params.get('hospital_id')
        )
        if not hospital_id:
            return None
        from hospitals.models import Hospital
        return Hospital.objects.filter(id=hospital_id).first()

    if hasattr(user, 'staff_profile'):
        return user.staff_profile.hospital
    return None


def _get_patient_bill(patient):
    return Bill.objects.filter(
        hospital=patient.hospital,
        patient_mrn=patient.mrn,
    ).order_by('-created_at').first()


def _get_requested_services(patient, service_ids, service_type):
    service_ids = service_ids if isinstance(service_ids, list) else []
    selected_ids = {str(service_id) for service_id in service_ids if service_id}
    if not selected_ids:
        return []

    services = list(
        ServiceCatalog.objects.filter(
            hospital=patient.hospital,
            service_type=service_type,
            is_active=True,
            id__in=selected_ids,
        )
    )
    if len(services) != len(selected_ids):
        from rest_framework.exceptions import ValidationError
        raise ValidationError(
            {'service_ids': f'One or more selected {service_type} services are unavailable.'}
        )
    return services


def _refresh_bill_status(bill):
    paid = Decimal(str(bill.amount_paid or 0))
    total = Decimal(str(bill.total_amount or 0))
    if paid >= total and total > 0:
        bill.status = 'paid'
    elif paid > 0:
        bill.status = 'partial'
    else:
        bill.status = 'pending'


def _stage_is_paid(patient, stage):
    bill = _get_patient_bill(patient)
    if not bill:
        return False, 'No bill found. Please create and pay the bill first.'

    paid = Decimal(str(bill.amount_paid or 0))
    consultation_fee = Decimal(str(bill.consultation_fee or 0))
    lab_fee = Decimal(str(bill.lab_fee or 0))

    if stage == 'consultation':
        if consultation_fee <= 0:
            return False, 'Consultation fee has not been created yet.'
        if paid >= consultation_fee:
            return True, ''
        return False, 'Consultation fee must be paid before the doctor can start.'

    if stage == 'lab':
        if consultation_fee <= 0 or lab_fee <= 0:
            return False, 'Lab fee has not been created yet.'
        if paid >= (consultation_fee + lab_fee):
            return True, ''
        return False, 'Lab fee must be paid before the lab can start.'

    return True, ''

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    permission_classes = [IsAuthenticated, IsClinicalStaff]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'phone', 'mrn']
    ordering_fields = ['created_at', 'first_name', 'mrn', 'status']
    ordering = ['-created_at']
    lookup_field = 'mrn'

    def get_permissions(self):
        if self.action == 'stats':
            return [IsAuthenticated(), CanViewPatientStats()]
        if self.action in {'list', 'create', 'assign_doctor'}:
            return [IsAuthenticated(), CanManagePatients()]
        if self.action in {
            'doctor_queue',
            'request_lab_test',
            'request_imaging',
            'update_status',
            'complete_treatment',
        }:
            return [IsAuthenticated(), IsDoctor()]
        if self.action in {'lab_queue', 'start_lab_test', 'submit_lab_results'}:
            return [IsAuthenticated(), IsLabTechnician()]
        return [IsAuthenticated(), IsClinicalStaff()]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return PatientListSerializer
        return PatientDetailSerializer

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return Patient.objects.all()
        if not hospital:
            return Patient.objects.none()
        queryset = Patient.objects.filter(hospital=hospital)
        if get_staff_role(self.request.user) == 'doctor':
            return queryset.filter(
                assigned_doctor=getattr(self.request.user, 'staff_profile', None)
            )
        return queryset
    
    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Hospital context is required')

        from rest_framework.exceptions import ValidationError

        limit_check = check_hospital_limit(hospital, 'patients')
        if not limit_check['allowed']:
            raise ValidationError(
                {
                    'plan_limit': (
                        f"{limit_check['plan_code'].upper()} plan allows up to "
                        f"{limit_check['limit']} patients. "
                        'Upgrade your plan to register more patients.'
                    )
                }
            )

        serializer.save(
            hospital=hospital,
            status='registered',
            registered_by=getattr(
                self.request.user,
                'staff_profile',
                None,
            ),
        )
    
    @action(detail=True, methods=['post'])
    def assign_doctor(self, request, mrn=None):
        patient = self.get_object()
        doctor_id = request.data.get('assigned_doctor')
        try:
            doctor = StaffProfile.objects.get(
                id=doctor_id,
                hospital=patient.hospital,
                role='doctor',
                is_active=True,
            )
            patient.assigned_doctor = doctor
            patient.status = 'waiting'
            patient.save()
            return Response(PatientDetailSerializer(patient).data)
        except StaffProfile.DoesNotExist:
            return Response({'error': 'Doctor not found'}, status=404)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reactivate(self, request, mrn=None):
        patient = Patient.objects.select_for_update().get(pk=self.get_object().pk)
        if patient.status != 'treated':
            return Response(
                {'error': 'Only a completed treatment can be reactivated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous_consultation_bill = Bill.objects.filter(
            hospital=patient.hospital,
            patient_mrn=patient.mrn,
            consultation_fee__gt=0,
        ).order_by('-created_at').first()
        if not previous_consultation_bill:
            return Response(
                {'error': 'A consultation fee is required before this patient can be reactivated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Bill.objects.create(
            hospital=patient.hospital,
            patient_name=f'{patient.first_name} {patient.last_name}'.strip(),
            patient_mrn=patient.mrn,
            consultation_fee=previous_consultation_bill.consultation_fee,
            payment_method='cash',
            status='pending',
            notes=f'Reactivated visit; consultation fee based on {previous_consultation_bill.bill_number}.',
        )
        patient.status = 'waiting'
        patient.diagnosis = ''
        patient.treatment_plan = ''
        patient.prescription = ''
        patient.doctor_notes = ''
        patient.lab_test_requested = ''
        patient.lab_test_results = ''
        patient.imaging_requested = ''
        patient.imaging_results = ''
        patient.save()
        return Response(PatientDetailSerializer(patient).data)
    
    @action(detail=True, methods=['post'])
    def request_lab_test(self, request, mrn=None):
        patient = self.get_object()
        services = _get_requested_services(
            patient,
            request.data.get('service_ids'),
            'lab',
        )
        manual_tests = str(request.data.get('lab_test_requested', '')).strip()
        if not services and not manual_tests:
            return Response(
                {'error': 'Select a configured lab service or provide lab test notes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bill = _get_patient_bill(patient)
        if not bill:
            return Response(
                {'error': 'No consultation bill found. Please create bill first.'},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        from laboratory.models import LabTest
        service_fee = sum((service.price for service in services), Decimal('0'))
        service_labels = [
            f'{service.name}{f" ({service.code})" if service.code else ""}'
            for service in services
        ]
        requested_tests = '\n'.join(filter(None, ['\n'.join(service_labels), manual_tests]))
        for service in services:
            LabTest.objects.create(
                hospital=patient.hospital,
                patient=patient,
                test_name=service.name,
                category='Service Catalog',
                price=service.price,
                notes=service.notes,
            )

        bill.lab_fee = Decimal(str(bill.lab_fee or 0)) + service_fee
        bill.save()
        _refresh_bill_status(bill)
        bill.save(update_fields=['status', 'updated_at'])

        patient.lab_test_requested = requested_tests
        patient.status = 'lab_requested'
        patient.save()
        return Response(PatientDetailSerializer(patient).data)
    
    @action(detail=True, methods=['post'])
    def request_imaging(self, request, mrn=None):
        patient = self.get_object()
        is_paid, message = _stage_is_paid(patient, 'consultation')
        if not is_paid:
            return Response({'error': message}, status=status.HTTP_402_PAYMENT_REQUIRED)
        services = _get_requested_services(
            patient,
            request.data.get('service_ids'),
            'imaging',
        )
        if not services:
            return Response(
                {'error': 'Select at least one configured imaging service.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bill = _get_patient_bill(patient)
        if not bill:
            return Response(
                {'error': 'No consultation bill found. Please create bill first.'},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        imaging_info = str(request.data.get('imaging_requested', '')).strip()
        body_part = request.data.get('body_part', '')
        service_fee = sum((service.price for service in services), Decimal('0'))
        bill.imaging_fee = Decimal(str(bill.imaging_fee or 0)) + service_fee
        bill.save()
        _refresh_bill_status(bill)
        bill.save(update_fields=['status', 'updated_at'])

        service_labels = []
        from imaging.models import ImagingTest
        for service in services:
            test_type = next(
                (value for value, _label in ImagingTest.TYPES if value == service.code.lower()),
                'other',
            ) if service.code else 'other'
            service_labels.append(service.name)
            ImagingTest.objects.create(
                hospital=patient.hospital,
                patient=patient,
                patient_name=f"{patient.first_name} {patient.last_name}",
                test_type=test_type,
                body_part=body_part,
                notes=imaging_info,
                price=service.price,
            )

        requested_imaging = ', '.join(service_labels)
        if imaging_info:
            requested_imaging = f'{requested_imaging}: {imaging_info}'
        patient.imaging_requested = requested_imaging
        patient.status = 'imaging_requested'
        patient.save()
        return Response(PatientDetailSerializer(patient).data)
    
    @action(detail=True, methods=['post'])
    def start_lab_test(self, request, mrn=None):
        patient = self.get_object()
        is_paid, message = _stage_is_paid(patient, 'lab')
        if not is_paid:
            return Response({'error': message}, status=status.HTTP_402_PAYMENT_REQUIRED)
        patient.status = 'lab_in_progress'
        patient.save()
        return Response(PatientDetailSerializer(patient).data)
    
    @action(detail=True, methods=['post'])
    def submit_lab_results(self, request, mrn=None):
        patient = self.get_object()
        patient.lab_test_results = request.data.get('lab_test_results', '')
        patient.status = 'lab_completed'
        patient.save()
        return Response(PatientDetailSerializer(patient).data)
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, mrn=None):
        patient = self.get_object()
        new_status = request.data.get('status')
        if new_status == 'in_consultation':
            is_paid, message = _stage_is_paid(patient, 'consultation')
            if not is_paid:
                return Response({'error': message}, status=status.HTTP_402_PAYMENT_REQUIRED)
        if new_status == 'lab_in_progress':
            is_paid, message = _stage_is_paid(patient, 'lab')
            if not is_paid:
                return Response({'error': message}, status=status.HTTP_402_PAYMENT_REQUIRED)
        if 'diagnosis' in request.data:
            patient.diagnosis = request.data.get('diagnosis', '')
        if 'treatment_plan' in request.data:
            patient.treatment_plan = request.data.get('treatment_plan', '')
        if 'prescription' in request.data:
            patient.prescription = request.data.get('prescription', '')
        if 'doctor_notes' in request.data:
            patient.doctor_notes = request.data.get('doctor_notes', '')
        if new_status:
            patient.status = new_status
        patient.save()
        return Response(PatientDetailSerializer(patient).data)

    @action(detail=True, methods=['post'])
    def complete_treatment(self, request, mrn=None):
        patient = self.get_object()
        diagnosis = str(request.data.get('diagnosis', '')).strip()
        if not diagnosis:
            return Response(
                {'diagnosis': 'Diagnosis is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prescriptions = request.data.get('prescriptions', [])
        if not isinstance(prescriptions, list):
            return Response(
                {'prescriptions': 'Prescriptions must be a list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from pharmacy.models import Medicine, Prescription
        prepared_prescriptions = []
        for prescription in prescriptions:
            medicine_name = str(prescription.get('medicine_name', '')).strip()
            if not medicine_name:
                return Response(
                    {'prescriptions': 'Each prescription requires a medicine name.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            medicine = Medicine.objects.filter(
                hospital=patient.hospital,
                name__iexact=medicine_name,
                is_active=True,
            ).first()
            if not medicine or medicine.is_expired:
                return Response(
                    {'prescriptions': f'Medicine "{medicine_name}" is unavailable.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                quantity = max(1, int(prescription.get('quantity_prescribed') or 1))
            except (TypeError, ValueError):
                return Response(
                    {'prescriptions': 'Prescription quantity must be a whole number.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            prepared_prescriptions.append((
                medicine,
                quantity,
                str(prescription.get('dosage', '')).strip(),
                str(prescription.get('notes', '')).strip(),
            ))

        with transaction.atomic():
            bill = _get_patient_bill(patient)
            medicine_fee = sum(
                (medicine.selling_price * quantity for medicine, quantity, _, _ in prepared_prescriptions),
                Decimal('0'),
            )
            prescription_status = 'pending'
            if prepared_prescriptions and bill:
                bill.medicine_fee = Decimal(str(bill.medicine_fee or 0)) + medicine_fee
                bill.save()
                _refresh_bill_status(bill)
                bill.save(update_fields=['status', 'updated_at'])
                paid = Decimal(str(bill.amount_paid or 0))
                required = (
                    Decimal(str(bill.consultation_fee or 0))
                    + Decimal(str(bill.lab_fee or 0))
                    + Decimal(str(bill.medicine_fee or 0))
                )
                if paid >= required:
                    prescription_status = 'ready'

            for medicine, quantity, dosage, notes in prepared_prescriptions:
                Prescription.objects.create(
                    hospital=patient.hospital,
                    patient=patient,
                    doctor=request.user.staff_profile,
                    medicine=medicine,
                    medicine_name=medicine.name,
                    dosage=dosage,
                    quantity_prescribed=quantity,
                    medicine_amount=medicine.selling_price * quantity,
                    status=prescription_status,
                    notes=notes,
                )

            patient.diagnosis = diagnosis
            patient.treatment_plan = request.data.get('treatment_plan', '')
            patient.prescription = request.data.get('prescription', '')
            patient.doctor_notes = request.data.get('doctor_notes', '')
            patient.status = 'treated'
            patient.save()

        return Response(PatientDetailSerializer(patient).data)
    
    @action(detail=False, methods=['get'])
    def doctor_queue(self, request):
        hospital = _resolve_request_hospital(request)
        if request.user.is_superuser and not hospital:
            queryset = Patient.objects.none()
        else:
            queryset = Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()

        staff_profile = getattr(request.user, 'staff_profile', None)
        is_doctor = get_staff_role(request.user) == 'doctor'
        queryset = queryset.filter(
            status__in=['waiting', 'in_consultation', 'lab_requested', 'lab_in_progress', 
                       'lab_completed', 'imaging_requested', 'imaging_completed']
        )
        if is_doctor:
            queryset = queryset.filter(assigned_doctor=staff_profile)
        else:
            doctor_id = request.query_params.get('doctor_id')
            if doctor_id:
                queryset = queryset.filter(assigned_doctor_id=doctor_id)
        return Response(PatientListSerializer(queryset, many=True).data)
    
    @action(detail=False, methods=['get'])
    def lab_queue(self, request):
        hospital = _resolve_request_hospital(request)
        patients = (Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()).filter(
            status__in=['lab_requested', 'lab_in_progress', 'lab_completed']
        )
        return Response(PatientListSerializer(patients, many=True).data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        today = timezone.now().date()
        hospital = _resolve_request_hospital(request)
        patients = Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()

        return Response({
            'total_patients': patients.count(),
            'active_patients': patients.filter(is_active=True).count(),
            'today_new': patients.filter(created_at__date=today).count(),
            'waiting': patients.filter(status='waiting').count(),
            'in_consultation': patients.filter(status='in_consultation').count(),
            'lab_requested': patients.filter(status__in=['lab_requested', 'lab_in_progress', 'lab_completed']).count(),
            'treated_today': patients.filter(status='treated', updated_at__date=today).count(),
        })
