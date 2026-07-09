from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from config.plan_permissions import RequiresProPlan
from .models import ImagingTest
from .serializers import ImagingTestSerializer


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

class ImagingTestViewSet(viewsets.ModelViewSet):
    queryset = ImagingTest.objects.all()
    serializer_class = ImagingTestSerializer
    permission_classes = [IsAuthenticated, RequiresProPlan]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['patient_name', 'test_type', 'body_part']
    ordering = ['-created_at']

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return ImagingTest.objects.all()
        if not hospital:
            return ImagingTest.objects.none()
        return ImagingTest.objects.filter(hospital=hospital)
    
    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            raise ValidationError('Hospital context is required')
        serializer.save(hospital=hospital)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        test = self.get_object()
        test.result = request.data.get('result', '')
        test.status = 'completed'
        test.completed_at = timezone.now()
        test.save()
        return Response(ImagingTestSerializer(test).data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = ImagingTest.objects.count()
        requested = ImagingTest.objects.filter(status='requested').count()
        completed = ImagingTest.objects.filter(status='completed').count()
        return Response({'total': total, 'requested': requested, 'completed': completed})
