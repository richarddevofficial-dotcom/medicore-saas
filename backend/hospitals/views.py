from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.conf import settings
from .models import Hospital
from auditlog.models import AuditLog
from .serializers import (
    HospitalSerializer,
    HospitalRegistrationSerializer,
    DomainSetupSerializer,
    DomainVerifySerializer,
    generate_domain_verification_token,
    resolve_domain_to_ip,
)

class HospitalViewSet(viewsets.ModelViewSet):
    queryset = Hospital.objects.all()
    serializer_class = HospitalSerializer
    permission_classes = [AllowAny]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return HospitalRegistrationSerializer
        return HospitalSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        hospital = serializer.save()
        return Response({
            'message': 'Hospital registered successfully',
            'hospital_id': hospital.id,
            'hospital_name': hospital.name,
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def my_hospital(self, request):
        if hasattr(request.user, 'staff_profile'):
            hospital = request.user.staff_profile.hospital
            platform_subdomain = ''
            base_domain = getattr(settings, 'PLATFORM_BASE_DOMAIN', '').strip().lower()
            if getattr(settings, 'PLATFORM_SUBDOMAIN_MODE', False) and base_domain and hospital.slug:
                platform_subdomain = f"{hospital.slug}.{base_domain}"
            return Response({
                'id': hospital.id,
                'name': hospital.name,
                'email': hospital.email,
                'phone': hospital.phone,
                'subscription_plan': hospital.subscription_plan,
                'subscription_status': hospital.subscription_status,
                'trial_end': hospital.trial_end,
                'days_left': hospital.days_left,
                'is_trial_active': hospital.is_trial_active,
                'primary_color': hospital.primary_color,
                'secondary_color': hospital.secondary_color,
                'custom_domain': hospital.custom_domain,
                'domain_status': hospital.domain_status,
                'domain_verified_at': hospital.domain_verified_at,
                'domain_last_checked_at': hospital.domain_last_checked_at,
                'domain_last_resolved_ip': hospital.domain_last_resolved_ip,
                'domain_ssl_status': hospital.domain_ssl_status,
                'domain_ssl_expires_at': hospital.domain_ssl_expires_at,
                'platform_subdomain': platform_subdomain,
            })
        return Response({'error': 'Not found'}, status=404)

    @action(detail=False, methods=['post'])
    def domain_setup(self, request):
        if not hasattr(request.user, 'staff_profile'):
            return Response({'error': 'Unauthorized'}, status=403)

        serializer = DomainSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hospital = request.user.staff_profile.hospital
        custom_domain = serializer.validated_data['custom_domain']

        duplicate = Hospital.objects.exclude(id=hospital.id).filter(
            custom_domain=custom_domain,
        ).exists()
        if duplicate:
            return Response(
                {'error': 'Domain already claimed by another hospital.'},
                status=400,
            )

        hospital.custom_domain = custom_domain
        hospital.domain_status = 'pending'
        hospital.domain_verified_at = None
        hospital.domain_last_checked_at = None
        if not hospital.domain_verification_token:
            hospital.domain_verification_token = generate_domain_verification_token()
        hospital.save(
            update_fields=[
                'custom_domain',
                'domain_status',
                'domain_verified_at',
                'domain_last_checked_at',
                'domain_verification_token',
            ]
        )

        AuditLog.objects.create(
            hospital=hospital,
            user=request.user.email or request.user.username,
            role=getattr(request.user.staff_profile, 'role', ''),
            action=f"Domain setup requested: {hospital.custom_domain}",
            target='custom_domain',
            action_type='security',
        )

        return Response({
            'custom_domain': hospital.custom_domain,
            'domain_status': hospital.domain_status,
            'verification': {
                'type': 'dns-txt',
                'name': f"_medicore-verify.{hospital.custom_domain}",
                'value': hospital.domain_verification_token,
                'instruction': 'Create this TXT record then click Verify.',
            },
        })

    @action(detail=False, methods=['post'])
    def domain_verify(self, request):
        if not hasattr(request.user, 'staff_profile'):
            return Response({'error': 'Unauthorized'}, status=403)

        serializer = DomainVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hospital = request.user.staff_profile.hospital
        custom_domain = serializer.validated_data['custom_domain']

        if custom_domain != (hospital.custom_domain or '').lower():
            return Response(
                {'error': 'Domain does not match your configured custom domain.'},
                status=400,
            )

        resolved_ip = resolve_domain_to_ip(custom_domain)
        hospital.domain_last_checked_at = timezone.now()

        if not resolved_ip:
            hospital.domain_status = 'failed'
            hospital.save(update_fields=['domain_status', 'domain_last_checked_at'])
            AuditLog.objects.create(
                hospital=hospital,
                user=request.user.email or request.user.username,
                role=getattr(request.user.staff_profile, 'role', ''),
                action=f"Domain verification failed: {hospital.custom_domain}",
                target='custom_domain',
                action_type='security',
            )
            return Response(
                {
                    'custom_domain': hospital.custom_domain,
                    'domain_status': hospital.domain_status,
                    'verified': False,
                    'error': 'DNS record not found yet. Please check your DNS setup.',
                },
                status=400,
            )

        hospital.domain_status = 'verified'
        hospital.domain_verified_at = timezone.now()
        hospital.save(
            update_fields=['domain_status', 'domain_verified_at', 'domain_last_checked_at']
        )

        AuditLog.objects.create(
            hospital=hospital,
            user=request.user.email or request.user.username,
            role=getattr(request.user.staff_profile, 'role', ''),
            action=f"Domain verified: {hospital.custom_domain}",
            target='custom_domain',
            action_type='security',
        )

        return Response(
            {
                'custom_domain': hospital.custom_domain,
                'domain_status': hospital.domain_status,
                'domain_verified_at': hospital.domain_verified_at,
                'verified': True,
                'resolved_ip': resolved_ip,
            }
        )