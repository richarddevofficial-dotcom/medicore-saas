from django.contrib import admin
from django.urls import path, include
import random
import secrets
from datetime import timedelta
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.core.mail import send_mail
from django.core.cache import cache
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
import hashlib

from hospitals.views import HospitalViewSet
from patients.views import PatientViewSet
from staff.views import StaffViewSet
from departments.views import DepartmentViewSet
from rooms.views import WardViewSet, RoomViewSet, BedViewSet
from pharmacy.views import MedicineViewSet, PrescriptionViewSet
from appointments.views import AppointmentViewSet
from billing.views import BillViewSet, SubscriptionPaymentViewSet, ServiceCatalogViewSet, POSReceiptViewSet
from insurance.views import InsuranceCompanyViewSet, InsuranceClaimViewSet
from imaging.views import ImagingTestViewSet
from reports.views import (
    dashboard_report, staff_report, reception_report, 
    cashier_report, pharmacy_report, lab_report, 
    detailed_report, dashboard_charts, reconciliation_report
)
from hospitals.models import Hospital, LoginOTP, TrustedDevice
from hospitals.serializers import HospitalSerializer
from auditlog.models import AuditLog, NotificationEvent
from config.password_links import send_password_setup_email
from config.superadmin_views import (
    super_admin_stats, 
    toggle_hospital_status, 
    update_hospital_plan,
    switch_hospital,
    switch_back_to_superadmin,
    list_platform_super_admins,
    create_platform_super_admin,
    toggle_platform_super_admin_status,
    list_notification_failures,
    retry_failed_receipt_jobs,
)

SYSTEM_SUPER_ADMIN_EMAIL = 'drichigroup@gmail.com'
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_INITIATE_WINDOW_SECONDS = 15 * 60
OTP_INITIATE_IP_MAX_REQUESTS = 10
OTP_INITIATE_ACCOUNT_MAX_REQUESTS = 5
OTP_VERIFY_WINDOW_SECONDS = 15 * 60
OTP_VERIFY_IP_MAX_REQUESTS = 20
OTP_VERIFY_SESSION_MAX_REQUESTS = 10
TRUSTED_DEVICE_MAX_AGE_SECONDS = int(
    getattr(settings, 'TRUSTED_DEVICE_MAX_AGE_SECONDS', 30 * 24 * 60 * 60)
)
TRUSTED_DEVICE_SIGNER = TimestampSigner(salt='trusted-device-login')


def _get_client_ip(request):
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def _rate_limit_check(key, limit, window_seconds):
    now_ts = timezone.now().timestamp()
    state = cache.get(key)

    if not state:
        state = {'count': 0, 'window_start': now_ts}

    elapsed = now_ts - state['window_start']
    if elapsed >= window_seconds:
        state = {'count': 0, 'window_start': now_ts}
        elapsed = 0

    state['count'] += 1
    cache.set(key, state, timeout=window_seconds)

    if state['count'] > limit:
        retry_after = max(1, int(window_seconds - elapsed))
        return True, retry_after

    return False, 0


def _build_device_fingerprint(request):
    user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
    accept_language = request.META.get('HTTP_ACCEPT_LANGUAGE', '')[:120]
    platform = request.META.get('HTTP_SEC_CH_UA_PLATFORM', '')[:80]
    raw = f'{user_agent}|{accept_language}|{platform}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def _get_client_user_agent(request):
    return request.META.get('HTTP_USER_AGENT', '')[:500]


def _issue_trusted_device_token(user, request):
    device_fingerprint = _build_device_fingerprint(request)
    client_ip = _get_client_ip(request)
    user_agent = _get_client_user_agent(request)
    nonce = secrets.token_hex(16)
    payload = f"{user.id}:{device_fingerprint}:{nonce}"
    token = TRUSTED_DEVICE_SIGNER.sign(payload)
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()

    TrustedDevice.objects.create(
        user=user,
        token_hash=token_hash,
        device_fingerprint=device_fingerprint,
        first_ip=client_ip,
        last_ip=client_ip,
        last_user_agent=user_agent,
        expires_at=timezone.now() + timedelta(seconds=TRUSTED_DEVICE_MAX_AGE_SECONDS),
    )

    return token


def _revoke_trusted_device_token(token):
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    TrustedDevice.objects.filter(token_hash=token_hash, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )


def _resolve_trusted_device_for_user(
    token,
    user,
    request,
    *,
    require_fingerprint=True,
    enforce_ip_match=False,
):
    if not token:
        return None, 'missing_token'

    try:
        unsigned_payload = TRUSTED_DEVICE_SIGNER.unsign(
            token,
            max_age=TRUSTED_DEVICE_MAX_AGE_SECONDS,
        )
    except (BadSignature, SignatureExpired):
        return None, 'invalid_or_expired_signature'

    payload_parts = unsigned_payload.split(':', 2)
    if len(payload_parts) != 3:
        return None, 'invalid_payload'

    payload_user_id, payload_fingerprint, _nonce = payload_parts
    if str(user.id) != payload_user_id:
        return None, 'user_mismatch'

    expected_fingerprint = _build_device_fingerprint(request)
    if require_fingerprint and payload_fingerprint != expected_fingerprint:
        return None, 'fingerprint_mismatch'

    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    trusted_device = TrustedDevice.objects.filter(
        user=user,
        token_hash=token_hash,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()

    if not trusted_device:
        return None, 'device_record_not_found'

    if require_fingerprint and trusted_device.device_fingerprint != expected_fingerprint:
        return None, 'stored_fingerprint_mismatch'

    current_ip = _get_client_ip(request)
    if enforce_ip_match and trusted_device.last_ip and current_ip and trusted_device.last_ip != current_ip:
        return None, 'ip_changed'

    trusted_device.last_used_at = timezone.now()
    trusted_device.last_ip = current_ip
    trusted_device.last_user_agent = _get_client_user_agent(request)
    trusted_device.save(update_fields=['last_used_at', 'last_ip', 'last_user_agent'])
    return trusted_device, None


def _is_trusted_device_for_user(token, user, request):
    trusted_device, _reason = _resolve_trusted_device_for_user(token, user, request)
    return bool(trusted_device)


def _create_auth_audit_log(user, action, request, target='authentication'):
    try:
        staff = getattr(user, 'staff_profile', None)
        hospital = getattr(staff, 'hospital', None)
        role = getattr(staff, 'role', '') if staff else ''
        if not hospital:
            return
        AuditLog.objects.create(
            hospital=hospital,
            user=user.email or user.username,
            role=role,
            action=action,
            target=target,
            action_type='security',
        )
    except Exception:
        # Never break auth flow because audit logging failed.
        return


def _record_notification_event(
    notification_type,
    recipient,
    subject,
    status,
    attempts=1,
    error_message='',
    reference='',
):
    try:
        NotificationEvent.objects.create(
            notification_type=notification_type,
            channel='email',
            recipient=recipient,
            subject=subject,
            status=status,
            attempts=attempts,
            error_message=error_message,
            reference=reference,
        )
    except Exception:
        return


def _authenticate_user_with_credential(email, phone, password):
    from django.contrib.auth.models import User
    from staff.models import StaffProfile

    user = None
    if email:
        user = authenticate(username=email, password=password)
        if not user:
            try:
                matched_user = User.objects.filter(email=email).first()
                if matched_user:
                    user = authenticate(username=matched_user.username, password=password)
            except Exception:
                pass

    if not user and phone:
        try:
            staff_profile = StaffProfile.objects.filter(phone=phone).first()
            if staff_profile:
                user = authenticate(username=staff_profile.user.username, password=password)
        except Exception:
            pass

    return user


def _build_login_response_data(user):
    from staff.models import StaffProfile

    refresh = RefreshToken.for_user(user)
    is_system_super_admin = user.is_superuser

    staff = None
    try:
        staff = user.staff_profile
    except Exception:
        staff = None

    response_data = {
        'token': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': 'super_admin' if is_system_super_admin else (staff.role if staff else 'admin'),
            'is_superuser': user.is_superuser,
        }
    }

    if staff and staff.hospital and not is_system_super_admin:
        response_data['hospital'] = {
            'id': staff.hospital.id,
            'name': staff.hospital.name,
            'slug': staff.hospital.slug if hasattr(staff.hospital, 'slug') else '',
        }

    return response_data


def _mask_destination(destination):
    if not destination or '@' not in destination:
        return destination or ''
    name, domain = destination.split('@', 1)
    if len(name) <= 2:
        masked_name = name[0] + '*'
    else:
        masked_name = name[:2] + ('*' * max(1, len(name) - 2))
    return f"{masked_name}@{domain}"


@api_view(['POST'])
@permission_classes([AllowAny])
def password_setup_request(request):
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'error': 'Email is required'}, status=400)

    from django.contrib.auth.models import User

    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user:
        _create_auth_audit_log(
            user,
            'Password setup requested',
            request,
            target='password_setup',
        )
        try:
            send_password_setup_email(user)
        except Exception:
            # Do not leak email delivery details to callers.
            pass

    return Response(
        {
            'success': True,
            'message': 'If an account exists for this email, a password setup link has been sent.',
        },
        status=200,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def password_setup_confirm(request):
    uid = request.data.get('uid')
    token = request.data.get('token')
    new_password = request.data.get('new_password')

    if not uid or not token or not new_password:
        return Response({'error': 'uid, token and new_password are required'}, status=400)

    from django.contrib.auth.models import User

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return Response({'error': 'Invalid password setup link'}, status=400)

    if not default_token_generator.check_token(user, token):
        return Response({'error': 'Invalid or expired password setup link'}, status=400)

    try:
        validate_password(new_password, user=user)
    except Exception as exc:
        details = getattr(exc, 'messages', None) or ['Invalid password']
        return Response({'error': details[0]}, status=400)

    user.set_password(new_password)
    user.save(update_fields=['password'])

    _create_auth_audit_log(
        user,
        'Password setup confirmed',
        request,
        target='password_setup',
    )

    return Response({'success': True, 'message': 'Password set successfully.'}, status=200)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def password_change(request):
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')

    if not current_password or not new_password:
        return Response({'error': 'current_password and new_password are required'}, status=400)

    user = request.user
    if not user.check_password(current_password):
        return Response({'error': 'Current password is incorrect'}, status=400)

    try:
        validate_password(new_password, user=user)
    except Exception as exc:
        details = getattr(exc, 'messages', None) or ['Invalid password']
        return Response({'error': details[0]}, status=400)

    user.set_password(new_password)
    user.save(update_fields=['password'])

    _create_auth_audit_log(
        user,
        'Password changed',
        request,
        target='password_change',
    )

    return Response({'success': True, 'message': 'Password changed successfully.'}, status=200)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get('email', '')
    phone = request.data.get('phone', '')
    password = request.data.get('password', '')
    user = _authenticate_user_with_credential(email, phone, password)
    if user:
        return Response(_build_login_response_data(user))
    
    return Response({'error': 'Invalid credentials'}, status=401)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_initiate(request):
    email = request.data.get('email', '')
    phone = request.data.get('phone', '')
    password = request.data.get('password', '')

    client_ip = _get_client_ip(request)
    ip_limited, ip_retry_after = _rate_limit_check(
        f'otp:initiate:ip:{client_ip}',
        OTP_INITIATE_IP_MAX_REQUESTS,
        OTP_INITIATE_WINDOW_SECONDS,
    )
    if ip_limited:
        return Response(
            {
                'error': 'Too many OTP requests from this IP. Please try again later.',
                'retry_after_seconds': ip_retry_after,
            },
            status=429,
        )

    account_identifier = (email or phone or '').strip().lower()
    if account_identifier:
        account_limited, account_retry_after = _rate_limit_check(
            f'otp:initiate:account:{account_identifier}',
            OTP_INITIATE_ACCOUNT_MAX_REQUESTS,
            OTP_INITIATE_WINDOW_SECONDS,
        )
        if account_limited:
            return Response(
                {
                    'error': 'Too many OTP requests for this account. Please try again later.',
                    'retry_after_seconds': account_retry_after,
                },
                status=429,
            )

    user = _authenticate_user_with_credential(email, phone, password)
    if not user:
        return Response({'error': 'Invalid credentials'}, status=401)

    trusted_device_token = request.data.get('trusted_device_token', '')
    trusted_device, trusted_device_reason = _resolve_trusted_device_for_user(
        trusted_device_token,
        user,
        request,
        require_fingerprint=True,
        enforce_ip_match=True,
    )
    if trusted_device:
        _revoke_trusted_device_token(trusted_device_token)
        rotated_token = _issue_trusted_device_token(user, request)
        response_data = _build_login_response_data(user)
        response_data['mfa_required'] = False
        response_data['trusted_device'] = True
        response_data['trusted_device_token'] = rotated_token
        response_data['trusted_device_expires_in_seconds'] = TRUSTED_DEVICE_MAX_AGE_SECONDS
        response_data['trusted_device_rotated'] = True
        return Response(response_data)

    if trusted_device_reason == 'ip_changed':
        _create_auth_audit_log(
            user,
            'Trusted device challenged due to IP change',
            request,
            target='trusted_device',
        )

    if not user.email:
        return Response({'error': 'No email found for this account. OTP email cannot be sent.'}, status=400)

    now = timezone.now()
    latest_otp = LoginOTP.objects.filter(user=user).order_by('-created_at').first()
    if latest_otp:
        elapsed_seconds = (now - latest_otp.created_at).total_seconds()
        if elapsed_seconds < OTP_RESEND_COOLDOWN_SECONDS:
            retry_after = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed_seconds)
            return Response(
                {
                    'error': 'Please wait before requesting another OTP.',
                    'retry_after_seconds': retry_after,
                },
                status=429,
            )

    LoginOTP.objects.filter(user=user, is_used=False, expires_at__gt=now).update(is_used=True)

    otp_code = f"{random.randint(100000, 999999)}"
    otp = LoginOTP.objects.create(
        user=user,
        channel='email',
        destination=user.email,
        code_hash=make_password(otp_code),
        expires_at=now + timedelta(minutes=5),
    )

    subject = 'Your MediCore Login OTP'
    message = (
        f"Hello {user.get_full_name() or user.username},\n\n"
        f"Your one-time login code is: {otp_code}\n"
        "This code will expire in 5 minutes.\n\n"
        "If you did not request this, please ignore this email."
    )
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@medicore.local')
    max_attempts = 3
    attempts = 0
    otp_send_error = ''
    for _idx in range(max_attempts):
        attempts += 1
        try:
            send_mail(subject, message, from_email, [user.email], fail_silently=False)
            _record_notification_event(
                notification_type='otp',
                recipient=user.email,
                subject=subject,
                status='sent',
                attempts=attempts,
                reference=f'otp_session:{otp.session_id}',
            )
            otp_send_error = ''
            break
        except Exception as exc:
            otp_send_error = str(exc)

    if otp_send_error:
        _record_notification_event(
            notification_type='otp',
            recipient=user.email,
            subject=subject,
            status='failed',
            attempts=attempts,
            error_message=otp_send_error,
            reference=f'otp_session:{otp.session_id}',
        )
        return Response({'error': f'Failed to send OTP: {otp_send_error}'}, status=500)

    response_data = {
        'mfa_required': True,
        'otp_session_id': str(otp.session_id),
        'delivery_channel': 'email',
        'destination': _mask_destination(user.email),
        'expires_in_seconds': 300,
        'resend_after_seconds': OTP_RESEND_COOLDOWN_SECONDS,
    }

    if settings.DEBUG:
        response_data['debug_otp'] = otp_code

    return Response(response_data)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_verify(request):
    otp_session_id = request.data.get('otp_session_id', '')
    otp_code = str(request.data.get('otp', '')).strip()
    remember_device = bool(request.data.get('remember_device', False))

    client_ip = _get_client_ip(request)
    ip_limited, ip_retry_after = _rate_limit_check(
        f'otp:verify:ip:{client_ip}',
        OTP_VERIFY_IP_MAX_REQUESTS,
        OTP_VERIFY_WINDOW_SECONDS,
    )
    if ip_limited:
        return Response(
            {
                'error': 'Too many OTP verification attempts from this IP. Please try again later.',
                'retry_after_seconds': ip_retry_after,
            },
            status=429,
        )

    if otp_session_id:
        session_limited, session_retry_after = _rate_limit_check(
            f'otp:verify:session:{otp_session_id}',
            OTP_VERIFY_SESSION_MAX_REQUESTS,
            OTP_VERIFY_WINDOW_SECONDS,
        )
        if session_limited:
            return Response(
                {
                    'error': 'Too many OTP verification attempts for this session. Please request a new code.',
                    'retry_after_seconds': session_retry_after,
                },
                status=429,
            )

    if not otp_session_id or not otp_code:
        return Response({'error': 'otp_session_id and otp are required'}, status=400)

    try:
        otp = LoginOTP.objects.select_related('user').get(session_id=otp_session_id)
    except LoginOTP.DoesNotExist:
        return Response({'error': 'Invalid OTP session'}, status=400)

    if otp.is_used:
        return Response({'error': 'OTP session already used. Please request a new code.'}, status=400)

    now = timezone.now()
    if otp.expires_at <= now:
        otp.is_used = True
        otp.save(update_fields=['is_used'])
        return Response({'error': 'OTP expired. Please request a new code.'}, status=400)

    if otp.attempts >= otp.max_attempts:
        otp.is_used = True
        otp.save(update_fields=['is_used'])
        return Response({'error': 'Maximum OTP attempts exceeded. Request a new code.'}, status=400)

    if not check_password(otp_code, otp.code_hash):
        otp.attempts += 1
        update_fields = ['attempts']
        if otp.attempts >= otp.max_attempts:
            otp.is_used = True
            update_fields.append('is_used')
        otp.save(update_fields=update_fields)
        return Response(
            {
                'error': 'Invalid OTP',
                'attempts_left': max(0, otp.max_attempts - otp.attempts),
            },
            status=400,
        )

    otp.is_used = True
    otp.save(update_fields=['is_used'])
    response_data = _build_login_response_data(otp.user)
    response_data['mfa_required'] = False
    if remember_device:
        response_data['trusted_device_token'] = _issue_trusted_device_token(otp.user, request)
        response_data['trusted_device_expires_in_seconds'] = TRUSTED_DEVICE_MAX_AGE_SECONDS
    return Response(response_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trusted_device_revoke(request):
    trusted_device_token = str(request.data.get('trusted_device_token', '')).strip()
    if not trusted_device_token:
        return Response({'error': 'trusted_device_token is required'}, status=400)

    trusted_device, _reason = _resolve_trusted_device_for_user(
        trusted_device_token,
        request.user,
        request,
        require_fingerprint=False,
        enforce_ip_match=False,
    )
    if not trusted_device:
        return Response({'error': 'Invalid trusted device token'}, status=400)

    _revoke_trusted_device_token(trusted_device_token)
    _create_auth_audit_log(
        request.user,
        'Trusted device revoked',
        request,
        target='trusted_device',
    )
    return Response({'success': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trusted_device_list(request):
    devices = (
        TrustedDevice.objects.filter(
            user=request.user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .order_by('-last_used_at', '-issued_at')
    )

    return Response(
        {
            'results': [
                {
                    'id': device.id,
                    'issued_at': device.issued_at,
                    'expires_at': device.expires_at,
                    'last_used_at': device.last_used_at,
                    'first_ip': device.first_ip,
                    'last_ip': device.last_ip,
                    'last_user_agent': device.last_user_agent,
                }
                for device in devices
            ]
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trusted_device_revoke_all(request):
    revoked_count = TrustedDevice.objects.filter(
        user=request.user,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).update(revoked_at=timezone.now())

    _create_auth_audit_log(
        request.user,
        'All trusted devices revoked',
        request,
        target='trusted_device',
    )
    return Response({'success': True, 'revoked_count': revoked_count})


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def hospital_settings(request):
    hospital = None
    if hasattr(request.user, 'staff_profile'):
        hospital = request.user.staff_profile.hospital
    elif request.user.is_superuser:
        hospital_id = request.query_params.get('hospital_id') or request.data.get('hospital_id')
        if hospital_id:
            hospital = Hospital.objects.filter(id=hospital_id).first()

    if not hospital:
        return Response({'error': 'Hospital not found'}, status=404)

    if request.method == 'GET':
        return Response(HospitalSerializer(hospital).data)
    elif request.method == 'PUT':
        mutable_data = request.data.copy()
        incoming_domain = mutable_data.get('custom_domain', None)
        previous_domain = (hospital.custom_domain or '').strip().lower()

        if incoming_domain is not None:
            normalized_domain = str(incoming_domain).strip().lower()
            current_domain = (hospital.custom_domain or '').strip().lower()

            if normalized_domain:
                duplicate = Hospital.objects.exclude(id=hospital.id).filter(
                    custom_domain=normalized_domain
                ).exists()
                if duplicate:
                    return Response(
                        {'custom_domain': ['Domain already in use by another hospital.']},
                        status=400,
                    )

                mutable_data['custom_domain'] = normalized_domain
                if normalized_domain != current_domain:
                    mutable_data['domain_status'] = 'pending'
                    mutable_data['domain_verified_at'] = None
                    mutable_data['domain_last_checked_at'] = None
                    mutable_data['domain_verification_token'] = secrets.token_hex(16)
            else:
                mutable_data['custom_domain'] = ''
                mutable_data['domain_status'] = 'unconfigured'
                mutable_data['domain_verified_at'] = None
                mutable_data['domain_last_checked_at'] = None
                mutable_data['domain_verification_token'] = ''

        serializer = HospitalSerializer(hospital, data=mutable_data, partial=True)
        if serializer.is_valid():
            serializer.save()

            updated_domain = (serializer.instance.custom_domain or '').strip().lower()
            if updated_domain != previous_domain:
                AuditLog.objects.create(
                    hospital=hospital,
                    user=request.user.email or request.user.username,
                    role=getattr(getattr(request.user, 'staff_profile', None), 'role', ''),
                    action=(
                        f"Domain changed from {previous_domain or 'none'} to "
                        f"{updated_domain or 'none'}"
                    ),
                    target='custom_domain',
                    action_type='security',
                )

            return Response(serializer.data)
        return Response(serializer.errors, status=400)


router = DefaultRouter()
router.register(r'hospitals', HospitalViewSet, basename='hospital')
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'wards', WardViewSet, basename='ward')
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'beds', BedViewSet, basename='bed')
router.register(r'medicines', MedicineViewSet, basename='medicine')
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'bills', BillViewSet, basename='bill')
router.register(r'pos-receipts', POSReceiptViewSet, basename='pos-receipt')
router.register(r'services', ServiceCatalogViewSet, basename='service-catalog')
router.register(r'prescriptions', PrescriptionViewSet, basename='prescription')
router.register(r'insurance-companies', InsuranceCompanyViewSet, basename='insurance-company')
router.register(r'insurance-claims', InsuranceClaimViewSet, basename='insurance-claim')
router.register(r'imaging-tests', ImagingTestViewSet, basename='imaging-test')
router.register(r'subscription-payments', SubscriptionPaymentViewSet, basename='subscription-payment')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # JWT Token Endpoints (Add these for proper JWT support)
    path('api/v1/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Custom Login
    path('api/v1/hospitals/login/', login_view, name='login'),
    path('api/v1/auth/login/initiate/', login_initiate, name='login-initiate'),
    path('api/v1/auth/login/verify/', login_verify, name='login-verify'),
    path('api/v1/auth/password/setup-request/', password_setup_request, name='password-setup-request'),
    path('api/v1/auth/password/setup-confirm/', password_setup_confirm, name='password-setup-confirm'),
    path('api/v1/auth/password/change/', password_change, name='password-change'),
    path('api/v1/auth/trusted-devices/', trusted_device_list, name='trusted-device-list'),
    path('api/v1/auth/trusted-device/revoke/', trusted_device_revoke, name='trusted-device-revoke'),
    path('api/v1/auth/trusted-device/revoke-all/', trusted_device_revoke_all, name='trusted-device-revoke-all'),
    path('api/v1/hospitals/settings/', hospital_settings, name='hospital-settings'),
    
    # Super Admin URLs
    path('api/v1/super-admin/stats/', super_admin_stats, name='super-admin-stats'),
    path('api/v1/super-admin/toggle-hospital/', toggle_hospital_status, name='toggle-hospital'),
    path('api/v1/super-admin/update-plan/', update_hospital_plan, name='update-plan'),
    path('api/v1/super-admin/switch-hospital/', switch_hospital, name='switch-hospital'),
    path('api/v1/super-admin/switch-back/', switch_back_to_superadmin, name='switch-back'),
    path('api/v1/super-admin/platform-admins/', list_platform_super_admins, name='platform-admin-list'),
    path('api/v1/super-admin/platform-admins/create/', create_platform_super_admin, name='platform-admin-create'),
    path('api/v1/super-admin/platform-admins/toggle-status/', toggle_platform_super_admin_status, name='platform-admin-toggle-status'),
    path('api/v1/super-admin/notifications/failures/', list_notification_failures, name='super-admin-notification-failures'),
    path('api/v1/super-admin/notifications/retry-receipts/', retry_failed_receipt_jobs, name='super-admin-retry-failed-receipt-jobs'),
    
    # Reports
    path('api/v1/reports/dashboard/', dashboard_report, name='dashboard-report'),
    path('api/v1/reports/detailed/', detailed_report, name='detailed-report'),
    path('api/v1/reports/staff/', staff_report, name='staff-report'),
    path('api/v1/reports/reception/', reception_report, name='reception-report'),
    path('api/v1/reports/cashier/', cashier_report, name='cashier-report'),
    path('api/v1/reports/pharmacy/', pharmacy_report, name='pharmacy-report'),
    path('api/v1/reports/lab/', lab_report, name='lab-report'),
    path('api/v1/reports/reconciliation/', reconciliation_report, name='reconciliation-report'),
    path('api/v1/reports/dashboard-charts/', dashboard_charts, name='dashboard-charts'),
    
    # Router URLs
    path('api/v1/', include(router.urls)),
]
# Public SaaS registration routes
from django.urls import include as public_include
from django.urls import path as public_path

urlpatterns += [
    public_path(
        'api/v1/public/',
        public_include('publicapi.urls'),
    ),
]

# MediCore SaaS subscription and billing API
from django.urls import include as billing_include
from django.urls import path as billing_path

urlpatterns += [
    billing_path(
        'api/v1/saas-billing/',
        billing_include('saas_billing.urls'),
    ),
]
