from rest_framework import viewsets, filters
from rest_framework.response import Response
from .models import Department
from .serializers import DepartmentSerializer, DepartmentDetailSerializer

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DepartmentDetailSerializer
        return DepartmentSerializer
    
    def perform_create(self, serializer):
        from hospitals.models import Hospital
        hospital = Hospital.objects.first()
        serializer.save(hospital=hospital)
