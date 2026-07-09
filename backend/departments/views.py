from rest_framework import viewsets, filters
from rest_framework.response import Response
from .models import Department
from .serializers import DepartmentSerializer, DepartmentDetailSerializer


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

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return Department.objects.all()
        if not hospital:
            return Department.objects.none()
        return Department.objects.filter(hospital=hospital)
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DepartmentDetailSerializer
        return DepartmentSerializer
    
    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Hospital context is required')
        serializer.save(hospital=hospital)
