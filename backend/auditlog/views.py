from rest_framework import viewsets, filters
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from config.role_permissions import IsHospitalAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsHospitalAdmin]
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
            if hospital_id:
                if not str(hospital_id).isdigit():
                    raise ValidationError(
                        {'hospital_id': 'Hospital ID must be a positive integer.'}
                    )
                queryset = queryset.filter(hospital_id=hospital_id)
        else:
            queryset = queryset.filter(hospital=user.staff_profile.hospital)

        action_type = self.request.query_params.get('action_type')
        return queryset.filter(action_type=action_type) if action_type else queryset
