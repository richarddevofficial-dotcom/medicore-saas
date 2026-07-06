from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import StaffProfile
from .serializers import StaffSerializer, StaffCreateSerializer

class StaffViewSet(viewsets.ModelViewSet):
    queryset = StaffProfile.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        # Use different serializers for different actions
        if self.action in ['create', 'update', 'partial_update']:
            return StaffCreateSerializer
        return StaffSerializer
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return StaffProfile.objects.all()
        if hasattr(user, 'staff_profile'):
            return StaffProfile.objects.filter(hospital=user.staff_profile.hospital)
        return StaffProfile.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        if user.is_superuser:
            # Superuser must provide hospital_id
            hospital_id = self.request.data.get('hospital')
            if not hospital_id:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"hospital": "Superuser must specify hospital"})
            serializer.save(hospital_id=hospital_id)
        else:
            # Regular staff use their own hospital
            if hasattr(user, 'staff_profile'):
                serializer.save(hospital=user.staff_profile.hospital)
            else:
                from rest_framework.exceptions import ValidationError
                raise ValidationError("User has no staff profile")