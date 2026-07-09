from rest_framework import viewsets, filters
from rest_framework.exceptions import ValidationError
from .models import LabTest
from .serializers import LabTestSerializer


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

class LabTestViewSet(viewsets.ModelViewSet):
    queryset = LabTest.objects.all()
    serializer_class = LabTestSerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['test_name', 'category', 'patient__first_name']

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return LabTest.objects.all()
        if not hospital:
            return LabTest.objects.none()
        return LabTest.objects.filter(hospital=hospital)

    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            raise ValidationError('Hospital context is required')
        serializer.save(hospital=hospital)