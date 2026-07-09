from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import models as dj_models
from django.utils import timezone
from decimal import Decimal, InvalidOperation
from django.core.exceptions import ValidationError
from .models import Medicine, Prescription
from .serializers import MedicineSerializer, PrescriptionSerializer
from billing.models import Bill


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
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'generic_name', 'category__name']
    ordering_fields = ['name', 'quantity', 'expiry_date']
    
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
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [filters.SearchFilter]
    search_fields = ['medicine_name', 'notes']
    ordering = ['-created_at']
    
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
        
        # Validate that medicine exists in this hospital
        if not Medicine.objects.filter(name__iexact=medicine_name, hospital=hospital).exists():
            raise ValidationError({'medicine_name': f'Medicine "{medicine_name}" not found in this hospital'})
        
        medicine = Medicine.objects.filter(name__iexact=medicine_name, hospital=hospital).first()
        if not medicine:
            raise ValidationError({'medicine_name': f'Medicine "{medicine_name}" not found in this hospital'})

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

        serializer.save(
            hospital=hospital,
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
    
    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        prescription = self.get_object()
        user = request.user
        
        # Check if already fully dispensed
        if prescription.status == 'dispensed':
            return Response({'error': 'Prescription already fully dispensed'}, status=status.HTTP_400_BAD_REQUEST)

        remaining_qty = int((prescription.quantity_prescribed or 0) - (prescription.quantity_dispensed or 0))
        if remaining_qty <= 0:
            return Response({'error': 'No quantity left to dispense'}, status=status.HTTP_400_BAD_REQUEST)

        requested_qty = request.data.get('quantity')
        if requested_qty in (None, '', 0, '0'):
            qty = remaining_qty
        else:
            try:
                qty = int(requested_qty)
            except (TypeError, ValueError):
                return Response({'error': 'Quantity must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

            if qty <= 0:
                return Response({'error': 'Quantity must be positive'}, status=status.HTTP_400_BAD_REQUEST)

        if qty > remaining_qty:
            return Response(
                {'error': f'Only {remaining_qty} unit(s) remaining to dispense'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Get hospital for this prescription
        hospital = prescription.hospital
        
        # Find the medicine
        medicine = Medicine.objects.filter(
            name__iexact=prescription.medicine_name, 
            hospital=hospital
        ).first()
        
        if not medicine:
            return Response({'error': f'Medicine "{prescription.medicine_name}" not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if medicine.quantity < qty:
            return Response({'error': f'Only {medicine.quantity} units in stock'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Perform dispense transaction
        from django.db import transaction
        with transaction.atomic():
            medicine.quantity -= qty
            medicine.save()
            
            prescription.quantity_dispensed += qty
            prescription.status = 'dispensed' if prescription.quantity_dispensed >= prescription.quantity_prescribed else 'partial'
            prescription.dispensed_at = timezone.now()
            prescription.dispensed_by = user  # Add this field to your model if not present
            prescription.save()
        
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