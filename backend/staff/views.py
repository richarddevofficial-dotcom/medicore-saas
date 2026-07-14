from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from auditlog.models import AuditLog
from config.password_links import send_password_setup_email
from saas_billing.services import check_hospital_limit
from .models import StaffProfile
from .serializers import StaffSerializer, StaffCreateSerializer


ALLOWED_STAFF_ROLES = {
    'admin',
    'doctor',
    'nurse',
    'receptionist',
    'pharmacist',
    'lab_technician',
    'radiographer',
    'accountant',
}
SYSTEM_SUPER_ADMIN_EMAIL = 'drichigroup@gmail.com'


def _is_staff_manager(user):
    if user.is_superuser:
        return True
    if hasattr(user, 'staff_profile'):
        return user.staff_profile.role == 'admin'
    return False


def _create_staff_audit_log(request, action, target, action_type='governance', hospital=None):
    actor = request.user
    staff_profile = getattr(actor, 'staff_profile', None)
    actor_hospital = hospital or getattr(staff_profile, 'hospital', None)
    actor_role = getattr(staff_profile, 'role', '') if staff_profile else ('super_admin' if actor.is_superuser else '')
    try:
        AuditLog.objects.create(
            hospital=actor_hospital,
            user=actor.email or actor.username,
            role=actor_role,
            action=action,
            target=target,
            action_type=action_type,
        )
    except Exception:
        return

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
            queryset = StaffProfile.objects.exclude(
                user__is_superuser=True,
            ).exclude(
                user__email=SYSTEM_SUPER_ADMIN_EMAIL,
            )
        elif hasattr(user, 'staff_profile'):
            queryset = StaffProfile.objects.filter(hospital=user.staff_profile.hospital)
        else:
            return StaffProfile.objects.none()

        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            active_value = str(is_active).strip().lower()
            if active_value in {'true', '1', 'yes'}:
                queryset = queryset.filter(is_active=True)
            elif active_value in {'false', '0', 'no'}:
                queryset = queryset.filter(is_active=False)

        return queryset
    
    def perform_create(self, serializer):
        user = self.request.user
        if user.is_superuser:
            # Superuser must provide hospital_id
            hospital_id = self.request.data.get('hospital')
            if not hospital_id:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"hospital": "Superuser must specify hospital"})
            from hospitals.models import Hospital
            from rest_framework.exceptions import ValidationError

            hospital = Hospital.objects.filter(id=hospital_id).first()
            if not hospital:
                raise ValidationError({"hospital": "Hospital not found"})

            limit_check = check_hospital_limit(hospital, 'staff')
            if not limit_check['allowed']:
                raise ValidationError(
                    {
                        "plan_limit": (
                            f"{limit_check['plan_code'].upper()} plan allows up to "
                            f"{limit_check['limit']} active staff. "
                            "Upgrade your plan to add more staff."
                        )
                    }
                )

            self._created_staff = serializer.save(hospital=hospital)
        else:
            # Regular staff use their own hospital
            if hasattr(user, 'staff_profile'):
                from rest_framework.exceptions import ValidationError

                hospital = user.staff_profile.hospital
                limit_check = check_hospital_limit(hospital, 'staff')
                if not limit_check['allowed']:
                    raise ValidationError(
                        {
                            "plan_limit": (
                                f"{limit_check['plan_code'].upper()} plan allows up to "
                                f"{limit_check['limit']} active staff. "
                                "Upgrade your plan to add more staff."
                            )
                        }
                    )

                self._created_staff = serializer.save(hospital=hospital)
            else:
                from rest_framework.exceptions import ValidationError
                raise ValidationError("User has no staff profile")

    def create(self, request, *args, **kwargs):
        if not _is_staff_manager(request.user):
            return Response({'error': 'Only admin users can create staff accounts.'}, status=status.HTTP_403_FORBIDDEN)

        self._created_staff = None
        response = super().create(request, *args, **kwargs)
        if response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED):
            created_id = response.data.get('id')
            _create_staff_audit_log(
                request,
                action='staff_create',
                target=f'staff_id:{created_id}:role={response.data.get("role", "")}',
                hospital=request.user.staff_profile.hospital if hasattr(request.user, 'staff_profile') else None,
            )

            created_staff = getattr(self, '_created_staff', None)
            email_sent = False
            if created_staff and created_staff.user:
                try:
                    email_sent = send_password_setup_email(
                        created_staff.user,
                        created_by_email=request.user.email or request.user.username,
                    )
                except Exception:
                    email_sent = False

            if isinstance(response.data, dict):
                response.data['password_setup_email_sent'] = email_sent
        return response

    @action(detail=True, methods=['post'])
    def send_password_setup(self, request, pk=None):
        if not _is_staff_manager(request.user):
            return Response(
                {'error': 'Only admin users can send password setup links.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        staff_member = self.get_object()
        if not staff_member.user or not staff_member.user.email:
            return Response(
                {'error': 'User email is required to send password setup link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            send_password_setup_email(
                staff_member.user,
                created_by_email=request.user.email or request.user.username,
            )
        except Exception:
            return Response(
                {'error': 'Failed to send password setup email.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        _create_staff_audit_log(
            request,
            action='staff_send_password_setup',
            target=f'staff_id:{staff_member.id}:email={staff_member.user.email}',
            hospital=staff_member.hospital,
        )

        return Response({'success': True, 'message': 'Password setup email sent.'}, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        if not _is_staff_manager(request.user):
            return Response({'error': 'Only admin users can update staff accounts.'}, status=status.HTTP_403_FORBIDDEN)
        response = super().update(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            staff_member = self.get_object()
            _create_staff_audit_log(
                request,
                action='staff_update',
                target=f'staff_id:{staff_member.id}',
                hospital=staff_member.hospital,
            )
        return response

    def partial_update(self, request, *args, **kwargs):
        if not _is_staff_manager(request.user):
            return Response({'error': 'Only admin users can update staff accounts.'}, status=status.HTTP_403_FORBIDDEN)
        response = super().partial_update(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            staff_member = self.get_object()
            _create_staff_audit_log(
                request,
                action='staff_partial_update',
                target=f'staff_id:{staff_member.id}',
                hospital=staff_member.hospital,
            )
        return response

    def destroy(self, request, *args, **kwargs):
        if not _is_staff_manager(request.user):
            return Response({'error': 'Only admin users can remove staff accounts.'}, status=status.HTTP_403_FORBIDDEN)

        staff_member = self.get_object()
        if staff_member.user_id == request.user.id:
            return Response({'error': 'You cannot remove your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        user_email = staff_member.user.email
        hospital = staff_member.hospital
        staff_id = staff_member.id
        response = super().destroy(request, *args, **kwargs)
        if response.status_code == status.HTTP_204_NO_CONTENT:
            _create_staff_audit_log(
                request,
                action='staff_delete',
                target=f'staff_id:{staff_id}:email={user_email}',
                hospital=hospital,
            )
        return response

    @action(detail=True, methods=['post'])
    def toggle_status(self, request, pk=None):
        if not _is_staff_manager(request.user):
            return Response(
                {'error': 'Only admin users can change staff status.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        staff_member = self.get_object()

        if staff_member.user_id == request.user.id:
            return Response(
                {'error': 'You cannot deactivate your own account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        staff_member.is_active = not staff_member.is_active
        staff_member.save(update_fields=['is_active'])

        staff_member.user.is_active = staff_member.is_active
        staff_member.user.save(update_fields=['is_active'])

        _create_staff_audit_log(
            request,
            action='staff_toggle_status',
            target=f'staff_id:{staff_member.id}:is_active={staff_member.is_active}',
            hospital=staff_member.hospital,
        )

        return Response(
            {
                'success': True,
                'is_active': staff_member.is_active,
                'message': (
                    'User activated successfully.'
                    if staff_member.is_active
                    else 'User deactivated successfully.'
                ),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def update_role(self, request, pk=None):
        if not _is_staff_manager(request.user):
            return Response(
                {'error': 'Only admin users can update staff roles.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        staff_member = self.get_object()
        new_role = str(request.data.get('role', '')).strip()

        if new_role not in ALLOWED_STAFF_ROLES:
            return Response(
                {'error': 'Invalid role provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if staff_member.role == new_role:
            return Response(
                {'message': 'Role unchanged.', 'role': staff_member.role},
                status=status.HTTP_200_OK,
            )

        staff_member.role = new_role
        staff_member.save(update_fields=['role'])

        _create_staff_audit_log(
            request,
            action='staff_update_role',
            target=f'staff_id:{staff_member.id}:role={new_role}',
            hospital=staff_member.hospital,
        )

        return Response(
            {
                'success': True,
                'role': staff_member.role,
                'message': 'Role updated successfully.',
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'])
    def bulk_deactivate(self, request):
        if not _is_staff_manager(request.user):
            return Response(
                {'error': 'Only admin users can perform bulk deactivation.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        staff_ids = request.data.get('staff_ids') or []
        reason = str(request.data.get('reason', '')).strip()
        confirm_count = int(request.data.get('confirm_count') or 0)

        if not isinstance(staff_ids, list) or not staff_ids:
            return Response({'error': 'staff_ids must be a non-empty list.'}, status=status.HTTP_400_BAD_REQUEST)

        normalized_ids = []
        for raw_id in staff_ids:
            try:
                normalized_ids.append(int(raw_id))
            except Exception:
                return Response({'error': 'staff_ids must contain valid integer ids.'}, status=status.HTTP_400_BAD_REQUEST)

        normalized_ids = list(dict.fromkeys(normalized_ids))
        if len(normalized_ids) > 100:
            return Response({'error': 'Maximum 100 users can be deactivated per operation.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(reason) < 5:
            return Response({'error': 'reason is required and must be at least 5 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        if confirm_count != len(normalized_ids):
            return Response({'error': 'confirm_count must match the number of provided staff ids.'}, status=status.HTTP_400_BAD_REQUEST)

        selected_user_ids = list(
            StaffProfile.objects.filter(id__in=normalized_ids).values_list('user_id', flat=True)
        )
        if request.user.id in selected_user_ids:
            return Response({'error': 'You cannot deactivate your own account in bulk action.'}, status=status.HTTP_400_BAD_REQUEST)

        scoped_qs = self.get_queryset().filter(id__in=normalized_ids, is_active=True)
        scoped_ids = list(scoped_qs.values_list('id', flat=True))
        missing_ids = [staff_id for staff_id in normalized_ids if staff_id not in scoped_ids]
        if missing_ids:
            return Response(
                {'error': f'Some staff ids are not available for deactivation: {missing_ids}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_ids = list(scoped_qs.values_list('user_id', flat=True))
        scoped_qs.update(is_active=False)
        from django.contrib.auth.models import User
        User.objects.filter(id__in=user_ids).update(is_active=False)

        actor_hospital = request.user.staff_profile.hospital if hasattr(request.user, 'staff_profile') else None
        _create_staff_audit_log(
            request,
            action='staff_bulk_deactivate',
            target=(
                f'staff_ids={scoped_ids};count={len(scoped_ids)};reason={reason}'
            ),
            hospital=actor_hospital,
        )

        return Response(
            {
                'success': True,
                'deactivated_count': len(scoped_ids),
                'deactivated_ids': scoped_ids,
            },
            status=status.HTTP_200_OK,
        )