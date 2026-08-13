from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import models as dj_models, transaction
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from django.core.exceptions import ValidationError
from .models import Medicine, Prescription, StockMovement
from .serializers import MedicineSerializer, PrescriptionSerializer
from billing.models import Bill
from config.role_permissions import CanCreatePrescription, IsPharmacyStaff, CanViewMedicines


def _refresh_bill_status(bill):
    paid = Decimal(str(bill.amount_paid or 0))
    total = Decimal(str(bill.total_amount or 0))
    if paid >= total and total > 0:
        bill.status = 'paid'
    elif paid > 0:
        bill.status = 'partial'
    else:
        bill.status = 'pending'


class MedicineViewSet(viewsets.ModelViewSet):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'generic_name', 'category__name']
    ordering_fields = ['name', 'quantity', 'expiry_date']

    def get_permissions(self):
        if self.action in {'list', 'retrieve'}:
            return [IsAuthenticated(), CanViewMedicines()]
        return [IsAuthenticated(), IsPharmacyStaff()]
    
    def get_queryset(self):
        """Return medicines filtered by hospital or all for superuser"""
        user = self.request.user
        
        # Superuser can see all medicines
        if user.is_superuser:
            return Medicine.objects.all()
        
        # Regular staff must have a hospital
        if not hasattr(user, 'staff_profile'):
            return Medicine.objects.none()
        
        hospital = user.staff_profile.hospital
        return Medicine.objects.filter(hospital=hospital)
    
    def perform_create(self, serializer):
        user = self.request.user
        
        # Superuser must specify a hospital
        if user.is_superuser:
            hospital_id = self.request.data.get('hospital_id')
            if not hospital_id:
                raise ValidationError("Superuser must specify 'hospital_id'")
            from hospitals.models import Hospital
            try:
                hospital = Hospital.objects.get(id=hospital_id)
            except Hospital.DoesNotExist:
                raise ValidationError("Hospital not found")
        else:
            # Regular staff use their assigned hospital
            if not hasattr(user, 'staff_profile'):
                raise ValidationError("User has no staff profile")
            hospital = user.staff_profile.hospital
        
        serializer.save(hospital=hospital)

    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        rows = request.data.get('medicines')
        if not isinstance(rows, list):
            return Response(
                {'error': 'medicines must be a list of row objects'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        if user.is_superuser:
            hospital_id = request.data.get('hospital_id')
            if hospital_id:
                from hospitals.models import Hospital
                try:
                    hospital = Hospital.objects.get(id=hospital_id)
                except Hospital.DoesNotExist:
                    return Response({'error': 'Hospital not found'}, status=status.HTTP_404_NOT_FOUND)
            elif hasattr(user, 'staff_profile'):
                hospital = user.staff_profile.hospital
            else:
                return Response(
                    {'error': 'Superuser must specify hospital_id'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if not hasattr(user, 'staff_profile'):
                return Response({'error': 'User has no staff profile'}, status=status.HTTP_403_FORBIDDEN)
            hospital = user.staff_profile.hospital

        def _norm(row):
            if not isinstance(row, dict):
                return {}
            return {str(k).strip().lower(): v for k, v in row.items()}

        def _get(row, *keys, default=None):
            for key in keys:
                if key in row and row[key] not in (None, ''):
                    return row[key]
            return default

        def _to_int(value, default=0):
            if value in (None, ''):
                return default
            try:
                return int(float(str(value).strip()))
            except (ValueError, TypeError):
                return default

        def _to_decimal(value, default='0'):
            if value in (None, ''):
                return Decimal(str(default))
            try:
                return Decimal(str(value).strip())
            except (InvalidOperation, ValueError, TypeError):
                return Decimal(str(default))

        created = 0
        updated = 0
        skipped = 0
        errors = []

        valid_forms = {choice[0] for choice in Medicine.FORM_CHOICES}

        for idx, raw in enumerate(rows, start=1):
            row = _norm(raw)
            name = str(_get(row, 'name', default='')).strip()
            if not name:
                skipped += 1
                errors.append({'row': idx, 'error': 'name is required'})
                continue

            form = str(_get(row, 'form', default='tablet')).strip().lower() or 'tablet'
            if form not in valid_forms:
                form = 'tablet'

            strength = str(_get(row, 'strength', default='')).strip()
            generic_name = str(_get(row, 'generic_name', 'generic name', default='')).strip()
            batch_number = str(_get(row, 'batch_number', 'batch #', 'batch', default='')).strip()
            manufacturer = str(_get(row, 'manufacturer', default='')).strip()

            quantity = _to_int(_get(row, 'quantity', 'stock', default=0), default=0)
            reorder_level = _to_int(_get(row, 'reorder_level', 'reorder level', default=20), default=20)
            min_stock = _to_int(_get(row, 'min_stock', 'min stock', default=10), default=10)
            max_stock = _to_int(_get(row, 'max_stock', 'max stock', default=100), default=100)

            cost_price = _to_decimal(_get(row, 'cost_price', 'cost price', 'unit_price', 'price', default='0'))
            selling_price = _to_decimal(_get(row, 'selling_price', 'selling price', 'price', default='0'))

            expiry_date = _get(row, 'expiry_date', 'expiry date', default=None)
            if expiry_date == '':
                expiry_date = None

            category_value = _get(row, 'category', 'category_id', default=None)
            category_obj = None
            if category_value not in (None, ''):
                try:
                    category_id = int(float(str(category_value).strip()))
                    category_obj = hospital.medicinecategory_set.filter(id=category_id).first()
                except (ValueError, TypeError):
                    category_name = str(category_value).strip()
                    if category_name:
                        category_obj, _ = hospital.medicinecategory_set.get_or_create(name=category_name)

            medicine = Medicine.objects.filter(hospital=hospital, name__iexact=name).first()
            if medicine:
                old_quantity = medicine.quantity
                medicine.form = form
                medicine.strength = strength
                medicine.generic_name = generic_name
                medicine.quantity = quantity
                medicine.reorder_level = reorder_level
                medicine.min_stock = min_stock
                medicine.max_stock = max_stock
                medicine.cost_price = cost_price
                medicine.selling_price = selling_price
                medicine.batch_number = batch_number
                medicine.expiry_date = expiry_date
                medicine.manufacturer = manufacturer
                if category_obj is not None:
                    medicine.category = category_obj
                try:
                    medicine.full_clean()
                    medicine.save()
                    if quantity != old_quantity:
                        StockMovement.objects.create(
                            hospital=hospital,
                            medicine=medicine,
                            movement_type='adjustment',
                            quantity=quantity - old_quantity,
                            reference='Bulk import',
                            notes=f'Stock adjusted from {old_quantity} to {quantity} via bulk import',
                            created_by=getattr(user, 'email', None) or getattr(user, 'username', 'System'),
                        )
                    updated += 1
                except Exception as exc:
                    errors.append({'row': idx, 'error': str(exc)})
            else:
                try:
                    Medicine.objects.create(
                        hospital=hospital,
                        category=category_obj,
                        name=name,
                        generic_name=generic_name,
                        form=form,
                        strength=strength,
                        quantity=quantity,
                        reorder_level=reorder_level,
                        min_stock=min_stock,
                        max_stock=max_stock,
                        cost_price=cost_price,
                        selling_price=selling_price,
                        batch_number=batch_number,
                        expiry_date=expiry_date,
                        manufacturer=manufacturer,
                    )
                    created += 1
                except Exception as exc:
                    errors.append({'row': idx, 'error': str(exc)})

        response_status = status.HTTP_200_OK if not errors else status.HTTP_207_MULTI_STATUS
        return Response(
            {
                'created': created,
                'updated': updated,
                'skipped': skipped,
                'errors': errors,
            },
            status=response_status,
        )


class PrescriptionViewSet(viewsets.ModelViewSet):
    queryset = Prescription.objects.all()
    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated, IsPharmacyStaff]
    pagination_class = None
    filter_backends = [filters.SearchFilter]
    search_fields = ['medicine_name', 'notes']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), CanCreatePrescription()]
        return [IsAuthenticated(), IsPharmacyStaff()]
    
    def get_queryset(self):
        """Return prescriptions filtered by hospital or all for superuser"""
        user = self.request.user
        
        # Superuser can see all prescriptions
        if user.is_superuser:
            return Prescription.objects.all()
        
        # Regular staff must have a hospital
        if not hasattr(user, 'staff_profile'):
            return Prescription.objects.none()
        
        hospital = user.staff_profile.hospital
        return Prescription.objects.filter(hospital=hospital)
    
    def perform_create(self, serializer):
        user = self.request.user
        medicine_name = serializer.validated_data.get('medicine_name')
        quantity_prescribed = int(serializer.validated_data.get('quantity_prescribed') or 1)
        patient = serializer.validated_data.get('patient')
        
        # Superuser must specify a hospital
        if user.is_superuser:
            hospital_id = self.request.data.get('hospital_id')
            if not hospital_id:
                raise ValidationError("Superuser must specify 'hospital_id'")
            from hospitals.models import Hospital
            try:
                hospital = Hospital.objects.get(id=hospital_id)
            except Hospital.DoesNotExist:
                raise ValidationError("Hospital not found")
        else:
            # Regular staff use their assigned hospital
            if not hasattr(user, 'staff_profile'):
                raise ValidationError("User has no staff profile")
            hospital = user.staff_profile.hospital

        if patient and patient.hospital_id != hospital.id:
            raise ValidationError({'patient': 'Patient does not belong to your hospital.'})
        if (
            patient
            and hasattr(user, 'staff_profile')
            and user.staff_profile.role == 'doctor'
            and patient.assigned_doctor_id != user.staff_profile.id
        ):
            raise ValidationError(
                {'patient': 'Patient is not assigned to the prescribing doctor.'}
            )
        
        # Validate that medicine exists in this hospital
        if not Medicine.objects.filter(name__iexact=medicine_name, hospital=hospital).exists():
            raise ValidationError({'medicine_name': f'Medicine "{medicine_name}" not found in this hospital'})
        
        medicine = Medicine.objects.filter(name__iexact=medicine_name, hospital=hospital).first()
        if not medicine:
            raise ValidationError({'medicine_name': f'Medicine "{medicine_name}" not found in this hospital'})
        if not medicine.is_active:
            raise ValidationError({'medicine_name': 'Medicine is inactive and cannot be prescribed.'})
        if medicine.is_expired:
            raise ValidationError({'medicine_name': 'Medicine is expired and cannot be prescribed.'})

        medicine_amount = Decimal(str(medicine.selling_price or 0)) * Decimal(str(quantity_prescribed))
        prescription_status = 'pending'

        if patient:
            bill = Bill.objects.filter(
                hospital=hospital,
                patient_mrn=patient.mrn,
            ).order_by('-created_at').first()

            if bill:
                bill.medicine_fee = Decimal(str(bill.medicine_fee or 0)) + medicine_amount
                bill.save()
                _refresh_bill_status(bill)
                bill.save(update_fields=['status', 'updated_at'])

                paid = Decimal(str(bill.amount_paid or 0))
                consultation_fee = Decimal(str(bill.consultation_fee or 0))
                lab_fee = Decimal(str(bill.lab_fee or 0))
                medicine_fee = Decimal(str(bill.medicine_fee or 0))

                if medicine_fee > 0 and paid >= (consultation_fee + lab_fee + medicine_fee):
                    prescription_status = 'ready'

        prescribing_doctor = (
            user.staff_profile
            if hasattr(user, 'staff_profile') and user.staff_profile.role == 'doctor'
            else None
        )
        serializer.save(
            hospital=hospital,
            doctor=prescribing_doctor,
            medicine=medicine,
            medicine_amount=medicine_amount,
            status=prescription_status,
        )
    
    def get_object(self):
        """Override to handle superuser access"""
        obj = super().get_object()
        user = self.request.user
        
        # Superuser can access any object
        if user.is_superuser:
            return obj
        
        # Regular staff can only access their hospital's objects
        if not hasattr(user, 'staff_profile'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("User has no staff profile")
        
        if obj.hospital != user.staff_profile.hospital:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You don't have permission to access this prescription")
        
        return obj

    def perform_destroy(self, instance):
        if (instance.quantity_dispensed or 0) > 0:
            raise ValidationError(
                'Cannot delete a prescription that has been dispensed.'
            )
        if instance.status in {'ready', 'dispensed', 'partial'}:
            raise ValidationError(
                'Only pending or cancelled prescriptions can be deleted.'
            )
        instance.delete()

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        prescription = self.get_object()
        user = request.user

        requested_qty = request.data.get('quantity')
        if requested_qty not in (None, '', 0, '0'):
            try:
                qty = int(requested_qty)
            except (TypeError, ValueError):
                return Response({'error': 'Quantity must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

            if qty <= 0:
                return Response({'error': 'Quantity must be positive'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            qty = None

        with transaction.atomic():
            prescription = Prescription.objects.select_for_update().get(pk=prescription.pk)
            if prescription.status not in {'ready', 'partial'}:
                return Response(
                    {'error': 'Prescription must be paid before dispensing.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            remaining_qty = int(
                (prescription.quantity_prescribed or 0)
                - (prescription.quantity_dispensed or 0)
            )
            if remaining_qty <= 0:
                return Response(
                    {'error': 'No quantity left to dispense'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            dispense_quantity = remaining_qty if qty is None else qty
            if dispense_quantity > remaining_qty:
                return Response(
                    {'error': f'Only {remaining_qty} unit(s) remaining to dispense'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            medicine = (
                Medicine.objects.select_for_update()
                .filter(id=prescription.medicine_id, hospital=prescription.hospital)
                .first()
            )
            if not medicine:
                return Response(
                    {'error': 'Prescription medicine is unavailable. Contact pharmacy administration.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if not medicine.is_active:
                return Response(
                    {'error': 'Medicine is inactive and cannot be dispensed.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if medicine.is_expired:
                return Response(
                    {'error': 'Medicine is expired and cannot be dispensed.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if medicine.quantity < dispense_quantity:
                return Response(
                    {'error': f'Only {medicine.quantity} units in stock'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            staff_name = f'{user.first_name} {user.last_name}'.strip() or user.email or user.username
            medicine.quantity -= dispense_quantity
            medicine.save(update_fields=['quantity', 'updated_at'])

            StockMovement.objects.create(
                hospital=prescription.hospital,
                medicine=medicine,
                movement_type='out',
                quantity=dispense_quantity,
                reference=f'Prescription {prescription.id}',
                notes=f'Dispensed for patient {prescription.patient_id or "walk-in"}',
                created_by=staff_name,
            )

            prescription.quantity_dispensed += dispense_quantity
            prescription.status = 'dispensed' if prescription.quantity_dispensed >= prescription.quantity_prescribed else 'partial'
            prescription.dispensed_at = timezone.now()
            prescription.dispensed_by = getattr(user, 'staff_profile', None)
            prescription.save(
                update_fields=[
                    'quantity_dispensed',
                    'status',
                    'dispensed_at',
                    'dispensed_by',
                ]
            )
        
        return Response(PrescriptionSerializer(prescription).data)
    
    @action(detail=False, methods=['get'])
    def queue(self, request):
        user = request.user
        
        # Superuser can see queue for all hospitals
        if user.is_superuser:
            hospital_id = request.query_params.get('hospital_id')
            if hospital_id:
                prescriptions = Prescription.objects.filter(
                    hospital_id=hospital_id,
                    status__in=['pending', 'ready', 'partial']
                )
            else:
                prescriptions = Prescription.objects.filter(
                    status__in=['pending', 'ready', 'partial']
                )
        else:
            # Regular staff see their hospital's queue
            if not hasattr(user, 'staff_profile'):
                return Response({'error': 'User has no staff profile'}, status=status.HTTP_403_FORBIDDEN)
            
            hospital = user.staff_profile.hospital
            prescriptions = Prescription.objects.filter(
                hospital=hospital, 
                status__in=['pending', 'ready', 'partial']
            )
        
        # Optional: Filter by specific status
        status_filter = request.query_params.get('status')
        if status_filter and status_filter in ['pending', 'ready', 'partial']:
            prescriptions = prescriptions.filter(status=status_filter)
        
        # Order by created_at descending
        prescriptions = prescriptions.order_by('-created_at')
        
        serializer = PrescriptionSerializer(prescriptions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def history(self, request):
        user = request.user
        days = request.query_params.get('days', 30)
        try:
            days = min(max(int(days), 1), 30)
        except (TypeError, ValueError):
            return Response({'error': 'days must be a number between 1 and 30'}, status=400)

        if user.is_superuser:
            hospital_id = request.query_params.get('hospital_id')
            prescriptions = Prescription.objects.all()
            if hospital_id:
                prescriptions = prescriptions.filter(hospital_id=hospital_id)
        elif hasattr(user, 'staff_profile'):
            prescriptions = Prescription.objects.filter(
                hospital=user.staff_profile.hospital,
            )
        else:
            return Response({'error': 'User has no staff profile'}, status=status.HTTP_403_FORBIDDEN)

        since = timezone.now() - timedelta(days=days)
        prescriptions = prescriptions.exclude(status='cancelled').filter(
            created_at__gte=since,
        ).order_by('-created_at')
        return Response(PrescriptionSerializer(prescriptions, many=True).data)
    
    @action(detail=False, methods=['post'])
    def mark_paid_by_patient(self, request):
        from patients.models import Patient
        
        mrn = request.data.get('mrn')
        if not mrn:
            return Response({'error': 'MRN is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        hospital = None
        
        # Determine hospital
        if user.is_superuser:
            hospital_id = request.data.get('hospital_id')
            if not hospital_id:
                return Response({'error': 'Superuser must specify hospital_id'}, status=status.HTTP_400_BAD_REQUEST)
            from hospitals.models import Hospital
            try:
                hospital = Hospital.objects.get(id=hospital_id)
            except Hospital.DoesNotExist:
                return Response({'error': 'Hospital not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            if not hasattr(user, 'staff_profile'):
                return Response({'error': 'User has no staff profile'}, status=status.HTTP_403_FORBIDDEN)
            hospital = user.staff_profile.hospital
        
        # Find patient
        try:
            patient = Patient.objects.get(mrn=mrn, hospital=hospital)
        except Patient.DoesNotExist:
            return Response({'error': 'Patient not found in this hospital'}, status=status.HTTP_404_NOT_FOUND)

        # Verify the patient's latest bill actually covers medicine charges
        # before marking prescriptions as ready to dispense.
        bill = Bill.objects.filter(
            hospital=hospital,
            patient_mrn=patient.mrn,
        ).order_by('-created_at').first()

        if not bill:
            return Response(
                {'error': 'No bill found for this patient.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        paid = Decimal(str(bill.amount_paid or 0))
        required = (
            Decimal(str(bill.consultation_fee or 0))
            + Decimal(str(bill.lab_fee or 0))
            + Decimal(str(bill.medicine_fee or 0))
        )
        if paid < required:
            return Response(
                {
                    'error': 'Outstanding balance must be paid before dispensing.',
                    'balance_due': str(required - paid),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Update prescriptions
        updated_count = Prescription.objects.filter(
            patient=patient, 
            hospital=hospital,
            status='pending'
        ).update(status='ready')
        
        return Response({
            'message': f'{updated_count} prescription(s) marked as ready',
            'patient_mrn': patient.mrn,
            'hospital_id': hospital.id
        })