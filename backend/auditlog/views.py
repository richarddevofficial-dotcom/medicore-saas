from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from config.role_permissions import IsHospitalAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsHospitalAdmin]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user', 'action', 'target']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        queryset = AuditLog.objects.all()
        if user.is_superuser:
            hospital_id = (
                self.request.headers.get('X-Impersonating-Hospital-Id')
                or self.request.query_params.get('hospital_id')
            )
            return queryset.filter(hospital_id=hospital_id) if hospital_id else queryset

        return queryset.filter(hospital=user.staff_profile.hospital)
