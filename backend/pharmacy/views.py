from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import models as dj_models
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import Medicine, Prescription
from .serializers import MedicineSerializer, PrescriptionSerializer


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
        
        serializer.save(hospital=hospital)
    
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
        
        # Validate quantity
        try:
            qty = int(request.data.get('quantity', 0))
        except (TypeError, ValueError):
            return Response({'error': 'Quantity must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)
        
        if qty <= 0:
            return Response({'error': 'Quantity must be positive'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already fully dispensed
        if prescription.status == 'dispensed':
            return Response({'error': 'Prescription already fully dispensed'}, status=status.HTTP_400_BAD_REQUEST)
        
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