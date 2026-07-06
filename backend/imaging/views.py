from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import ImagingTest
from .serializers import ImagingTestSerializer

class ImagingTestViewSet(viewsets.ModelViewSet):
    queryset = ImagingTest.objects.all()
    serializer_class = ImagingTestSerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['patient_name', 'test_type', 'body_part']
    ordering = ['-created_at']
    
    def perform_create(self, serializer):
        from hospitals.models import Hospital
        serializer.save(hospital=Hospital.objects.first())
    
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
