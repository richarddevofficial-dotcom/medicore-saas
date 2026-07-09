from decimal import Decimal

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import timedelta
from .models import Patient
from staff.models import StaffProfile
from .serializers import PatientListSerializer, PatientDetailSerializer
from billing.models import Bill


def _resolve_request_hospital(request):
    user = request.user
    if user.is_superuser:
        hospital_id = request.data.get('hospital_id') or request.query_params.get('hospital_id')
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
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'phone', 'mrn']
    ordering_fields = ['created_at', 'first_name', 'mrn', 'status']
    ordering = ['-created_at']
    lookup_field = 'mrn'
    
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
        return Patient.objects.filter(hospital=hospital)
    
    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Hospital context is required')
        serializer.save(hospital=hospital, status='registered')
    
    @action(detail=True, methods=['post'])
    def assign_doctor(self, request, mrn=None):
        patient = self.get_object()
        doctor_id = request.data.get('assigned_doctor')
        try:
            doctor = StaffProfile.objects.get(id=doctor_id, role='doctor', is_active=True)
            patient.assigned_doctor = doctor
            patient.status = 'waiting'
            patient.save()
            return Response(PatientDetailSerializer(patient).data)
        except StaffProfile.DoesNotExist:
            return Response({'error': 'Doctor not found'}, status=404)
    
    @action(detail=True, methods=['post'])
    def reactivate(self, request, mrn=None):
        patient = self.get_object()
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
        lab_tests = request.data.get('lab_test_requested', '')
        if lab_tests:
            bill = _get_patient_bill(patient)
            if not bill:
                return Response(
                    {'error': 'No consultation bill found. Please create bill first.'},
                    status=status.HTTP_402_PAYMENT_REQUIRED,
                )

            requested_lab_fee = request.data.get('lab_fee', 30)
            lab_fee = Decimal(str(requested_lab_fee or 0))
            if lab_fee > 0 and Decimal(str(bill.lab_fee or 0)) <= 0:
                bill.lab_fee = lab_fee
                bill.save()
                _refresh_bill_status(bill)
                bill.save(update_fields=['status', 'updated_at'])

            patient.lab_test_requested = lab_tests
            patient.status = 'lab_requested'
            patient.save()
        return Response(PatientDetailSerializer(patient).data)
    
    @action(detail=True, methods=['post'])
    def request_imaging(self, request, mrn=None):
        patient = self.get_object()
        is_paid, message = _stage_is_paid(patient, 'consultation')
        if not is_paid:
            return Response({'error': message}, status=status.HTTP_402_PAYMENT_REQUIRED)
        imaging_info = request.data.get('imaging_requested', '')
        test_type = request.data.get('test_type', 'xray')
        body_part = request.data.get('body_part', '')
        patient.imaging_requested = imaging_info
        patient.status = 'imaging_requested'
        patient.save()
        from imaging.models import ImagingTest
        ImagingTest.objects.create(
            hospital=patient.hospital, patient=patient,
            patient_name=f"{patient.first_name} {patient.last_name}",
            test_type=test_type, body_part=body_part, notes=imaging_info,
        )
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
    
    @action(detail=False, methods=['get'])
    def doctor_queue(self, request):
        doctor_id = request.query_params.get('doctor_id')
        queryset = Patient.objects.filter(
            status__in=['waiting', 'in_consultation', 'lab_requested', 'lab_in_progress', 
                       'lab_completed', 'imaging_requested', 'imaging_completed']
        )
        if doctor_id:
            queryset = queryset.filter(assigned_doctor_id=doctor_id)
        return Response(PatientListSerializer(queryset, many=True).data)
    
    @action(detail=False, methods=['get'])
    def lab_queue(self, request):
        patients = Patient.objects.filter(
            status__in=['lab_requested', 'lab_in_progress', 'lab_completed']
        )
        return Response(PatientListSerializer(patients, many=True).data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        today = timezone.now().date()
        return Response({
            'total_patients': Patient.objects.count(),
            'active_patients': Patient.objects.filter(is_active=True).count(),
            'today_new': Patient.objects.filter(created_at__date=today).count(),
            'waiting': Patient.objects.filter(status='waiting').count(),
            'in_consultation': Patient.objects.filter(status='in_consultation').count(),
            'lab_requested': Patient.objects.filter(status__in=['lab_requested', 'lab_in_progress', 'lab_completed']).count(),
            'treated_today': Patient.objects.filter(status='treated', updated_at__date=today).count(),
        })
