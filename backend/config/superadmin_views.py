from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.db.models import Sum, Count
from datetime import datetime
from django.contrib.auth.models import User
from hospitals.models import Hospital, PlatformSuperAdminProfile
from patients.models import Patient
from billing.models import Bill, SubscriptionPayment, ReceiptEmailJob
from auditlog.models import AuditLog, NotificationEvent
from staff.models import StaffProfile
from saas_billing.models import HospitalSubscription, Invoice, Payment
from rest_framework_simplejwt.tokens import RefreshToken

SYSTEM_SUPER_ADMIN_EMAIL = 'drichigroup@gmail.com'


def _ensure_platform_super_admin(request):
    return request.user.is_superuser


def _get_platform_admin_type(user):
    if not user.is_superuser:
        return None

    profile = getattr(user, 'platform_super_admin_profile', None)
    if profile:
        return profile.admin_type

    # Backward compatibility for previously hardcoded primary account.
    if user.email == SYSTEM_SUPER_ADMIN_EMAIL:
        return 'primary'
    return 'secondary'


def _ensure_primary_system_super_admin(request):
    return request.user.is_superuser and _get_platform_admin_type(request.user) == 'primary'


def _upsert_platform_admin_profile(user, admin_type):
    if admin_type == 'primary':
        PlatformSuperAdminProfile.objects.filter(admin_type='primary').update(admin_type='secondary')

    profile, _created = PlatformSuperAdminProfile.objects.get_or_create(
        user=user,
        defaults={'admin_type': admin_type},
    )
    if profile.admin_type != admin_type:
        profile.admin_type = admin_type
        profile.save(update_fields=['admin_type', 'updated_at'])
    return profile


def _create_superadmin_audit_log(request, action, target, action_type='admin', hospital=None):
    actor = request.user
    try:
        AuditLog.objects.create(
            hospital=hospital,
            user=actor.email or actor.username,
            role=_get_platform_admin_type(actor) or ('super_admin' if actor.is_superuser else ''),
            action=action,
            target=target,
            action_type=action_type,
        )
    except Exception:
        # Never block super-admin actions if audit write fails.
        return

@api_view(['GET'])
@permission_classes([IsAdminUser])
def super_admin_stats(request):
    """Super admin dashboard stats - all hospitals"""
    if not _ensure_platform_super_admin(request):
        return Response({'error': 'Only platform super admins can access this endpoint'}, status=403)

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_hospitals = Hospital.objects.count()
    active_hospitals = Hospital.objects.filter(is_active=True).count()
    trial_hospitals = Hospital.objects.filter(subscription_plan='trial').count()
    grace_period_hospitals = HospitalSubscription.objects.filter(
        status=HospitalSubscription.STATUS_GRACE,
    ).count()
    suspended_hospitals = HospitalSubscription.objects.filter(
        status=HospitalSubscription.STATUS_SUSPENDED,
    ).count()
    total_patients = Patient.objects.count()
    total_revenue = float(Bill.objects.filter(status='paid').aggregate(total=Sum('total_amount')).get('total') or 0)
    monthly_revenue = float(
        Payment.objects.filter(
            status=Payment.STATUS_SUCCESS,
            paid_at__gte=month_start,
        ).aggregate(total=Sum('amount')).get('total') or 0
    )
    overdue_invoices = Invoice.objects.filter(
        status=Invoice.STATUS_OVERDUE,
    ).count()

    paid_subscription_qs = SubscriptionPayment.objects.filter(status='paid')
    pending_subscription_qs = SubscriptionPayment.objects.filter(status='pending')
    pending_manual_payment_count = Payment.objects.filter(
        status=Payment.STATUS_PENDING,
    ).count()

    subscription_collections_total = float(
        paid_subscription_qs.aggregate(total=Sum('amount')).get('total') or 0
    )
    subscription_collections_this_month = float(
        paid_subscription_qs.filter(payment_date__gte=month_start).aggregate(total=Sum('amount')).get('total') or 0
    )
    pending_subscription_amount = float(
        pending_subscription_qs.aggregate(total=Sum('amount')).get('total') or 0
    )
    pending_payments_count = pending_subscription_qs.count() + pending_manual_payment_count

    plan_distribution_rows = Hospital.objects.values('subscription_plan').annotate(total=Count('id'))
    plan_distribution_map = {row['subscription_plan']: row['total'] for row in plan_distribution_rows}
    plan_distribution = {
        'trial': plan_distribution_map.get('trial', 0),
        'basic': plan_distribution_map.get('basic', 0),
        'pro': plan_distribution_map.get('pro', 0),
        'enterprise': plan_distribution_map.get('enterprise', 0),
    }

    payment_status_rows = SubscriptionPayment.objects.values('status').annotate(total=Count('id'))
    payment_status_map = {row['status']: row['total'] for row in payment_status_rows}
    payment_status_counts = {
        'pending': payment_status_map.get('pending', 0),
        'paid': payment_status_map.get('paid', 0),
        'failed': payment_status_map.get('failed', 0),
        'refunded': payment_status_map.get('refunded', 0),
    }

    plan_distribution_chart = [
        {'name': 'Trial', 'value': plan_distribution.get('trial', 0)},
        {'name': 'Starter', 'value': plan_distribution.get('basic', 0)},
        {'name': 'Professional', 'value': plan_distribution.get('pro', 0)},
        {'name': 'Enterprise', 'value': plan_distribution.get('enterprise', 0)},
    ]

    # Last 12 months datasets for dashboard charts.
    months = []
    for offset in range(11, -1, -1):
        year = now.year
        month = now.month - offset
        while month <= 0:
            month += 12
            year -= 1
        month_start_date = datetime(year, month, 1, tzinfo=now.tzinfo)
        if month == 12:
            next_month_start = datetime(year + 1, 1, 1, tzinfo=now.tzinfo)
        else:
            next_month_start = datetime(year, month + 1, 1, tzinfo=now.tzinfo)
        months.append((month_start_date, next_month_start))

    revenue_per_month = []
    new_hospitals_per_month = []
    trial_conversion_rate = []

    for month_start_date, next_month_start in months:
        month_label = month_start_date.strftime('%b %Y')
        month_revenue = float(
            Payment.objects.filter(
                status=Payment.STATUS_SUCCESS,
                paid_at__gte=month_start_date,
                paid_at__lt=next_month_start,
            ).aggregate(total=Sum('amount')).get('total') or 0
        )
        revenue_per_month.append({
            'month': month_label,
            'amount': month_revenue,
        })

        new_hospitals_count = Hospital.objects.filter(
            created_at__gte=month_start_date,
            created_at__lt=next_month_start,
        ).count()
        new_hospitals_per_month.append({
            'month': month_label,
            'count': new_hospitals_count,
        })

        trials_ended = HospitalSubscription.objects.filter(
            trial_ends_at__gte=month_start_date,
            trial_ends_at__lt=next_month_start,
        ).count()
        converted = HospitalSubscription.objects.filter(
            activated_at__gte=month_start_date,
            activated_at__lt=next_month_start,
            trial_started_at__isnull=False,
        ).count()
        conversion_rate = round((converted / trials_ended) * 100, 2) if trials_ended else 0
        trial_conversion_rate.append({
            'month': month_label,
            'rate': conversion_rate,
            'converted': converted,
            'trial_ended': trials_ended,
        })

    # Monthly trend for the last 6 months (including current month).
    monthly_subscription_collections = []
    for offset in range(5, -1, -1):
        year = now.year
        month = now.month - offset
        while month <= 0:
            month += 12
            year -= 1

        month_start_date = datetime(year, month, 1, tzinfo=now.tzinfo)
        if month == 12:
            next_month_start = datetime(year + 1, 1, 1, tzinfo=now.tzinfo)
        else:
            next_month_start = datetime(year, month + 1, 1, tzinfo=now.tzinfo)

        amount = float(
            paid_subscription_qs.filter(
                payment_date__gte=month_start_date,
                payment_date__lt=next_month_start,
            ).aggregate(total=Sum('amount')).get('total') or 0
        )
        monthly_subscription_collections.append({
            'month': month_start_date.strftime('%b'),
            'amount': amount,
        })

    recent_subscription_payments = [
        {
            'id': payment.id,
            'hospital_name': payment.hospital.name,
            'plan': payment.plan,
            'amount': float(payment.amount or 0),
            'status': payment.status,
            'payment_method': payment.payment_method,
            'transaction_id': payment.transaction_id,
            'payment_date': payment.payment_date,
            'receipt_delivery_status': payment.receipt_delivery_status,
            'receipt_last_attempt_at': payment.receipt_last_attempt_at,
            'receipt_sent_at': payment.receipt_sent_at,
            'receipt_last_error': payment.receipt_last_error,
            'created_at': payment.created_at,
        }
        for payment in SubscriptionPayment.objects.select_related('hospital').all()[:10]
    ]

    recent_invoices = [
        {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'hospital_name': invoice.hospital.name,
            'plan': invoice.subscription.plan.code,
            'status': invoice.status,
            'total_amount': float(invoice.total_amount or 0),
            'balance_due': float(invoice.balance_due or 0),
            'currency': invoice.currency,
            'issued_at': invoice.issued_at,
            'due_date': invoice.due_date,
        }
        for invoice in (
            Invoice.objects
            .select_related('hospital', 'subscription__plan')
            .order_by('-created_at')[:25]
        )
    ]
    
    # Hospital breakdown with grouped aggregates to avoid N+1 queries.
    patient_counts = dict(
        Patient.objects.values_list('hospital_id').annotate(total=Count('id'))
    )
    staff_counts = dict(
        StaffProfile.objects.values_list('hospital_id').annotate(total=Count('id'))
    )
    revenue_by_hospital = {
        row['hospital_id']: float(row['total'] or 0)
        for row in Bill.objects.filter(status='paid').values('hospital_id').annotate(total=Sum('total_amount'))
    }

    hospitals = []
    for h in Hospital.objects.all():
        hospitals.append({
            'id': h.id,
            'name': h.name,
            'plan': h.subscription_plan,
            'status': 'active' if h.is_active else 'inactive',
            'patients': patient_counts.get(h.id, 0),
            'revenue': revenue_by_hospital.get(h.id, 0.0),
            'staff': staff_counts.get(h.id, 0),
            'days_left': h.days_left,
            'created_at': h.created_at,
        })
    
    return Response({
        'total_hospitals': total_hospitals,
        'active_hospitals': active_hospitals,
        'trial_hospitals': trial_hospitals,
        'grace_period_hospitals': grace_period_hospitals,
        'suspended_hospitals': suspended_hospitals,
        'total_patients': total_patients,
        'total_revenue': total_revenue,
        'monthly_revenue': monthly_revenue,
        'subscription_collections_total': subscription_collections_total,
        'subscription_collections_this_month': subscription_collections_this_month,
        'pending_subscription_amount': pending_subscription_amount,
        'pending_payments_count': pending_payments_count,
        'overdue_invoices': overdue_invoices,
        'plan_distribution': plan_distribution,
        'plan_distribution_chart': plan_distribution_chart,
        'payment_status_counts': payment_status_counts,
        'monthly_subscription_collections': monthly_subscription_collections,
        'revenue_per_month': revenue_per_month,
        'new_hospitals_per_month': new_hospitals_per_month,
        'trial_conversion_rate': trial_conversion_rate,
        'recent_subscription_payments': recent_subscription_payments,
        'recent_invoices': recent_invoices,
        'hospitals': hospitals,
    })

@api_view(['POST'])
@permission_classes([IsAdminUser])
def toggle_hospital_status(request):
    """Activate/deactivate a hospital"""
    if not _ensure_platform_super_admin(request):
        return Response({'error': 'Only platform super admins can access this endpoint'}, status=403)

    hospital_id = request.data.get('hospital_id')
    try:
        hospital = Hospital.objects.get(id=hospital_id)
        hospital.is_active = not hospital.is_active
        hospital.subscription_status = 'active' if hospital.is_active else 'inactive'
        hospital.save()

        staff_user_ids = StaffProfile.objects.filter(
            hospital=hospital,
            user__is_superuser=False,
        ).values_list('user_id', flat=True)
        User.objects.filter(id__in=staff_user_ids).update(is_active=hospital.is_active)

        _create_superadmin_audit_log(
            request,
            action='toggle_hospital_status',
            target=f'hospital:{hospital.id}:{hospital.name}:is_active={hospital.is_active}',
            action_type='governance',
            hospital=hospital,
        )

        return Response({'status': 'success', 'is_active': hospital.is_active})
    except Hospital.DoesNotExist:
        return Response({'error': 'Hospital not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def update_hospital_plan(request):
    """Update hospital subscription plan"""
    if not _ensure_platform_super_admin(request):
        return Response({'error': 'Only platform super admins can access this endpoint'}, status=403)

    hospital_id = request.data.get('hospital_id')
    plan = request.data.get('plan')
    try:
        hospital = Hospital.objects.get(id=hospital_id)
        old_plan = hospital.subscription_plan
        hospital.subscription_plan = plan
        hospital.save()
        _create_superadmin_audit_log(
            request,
            action='update_hospital_plan',
            target=f'hospital:{hospital.id}:{hospital.name}:plan:{old_plan}->{plan}',
            action_type='governance',
            hospital=hospital,
        )
        return Response({'status': 'success', 'plan': plan})
    except Hospital.DoesNotExist:
        return Response({'error': 'Hospital not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def switch_hospital(request):
    """Super admin switches to view a hospital"""
    if not _ensure_platform_super_admin(request):
        return Response({'error': 'Only platform super admins can access this endpoint'}, status=403)

    hospital_id = request.data.get('hospital_id')
    try:
        hospital = Hospital.objects.get(id=hospital_id)
        _create_superadmin_audit_log(
            request,
            action='switch_hospital',
            target=f'hospital:{hospital.id}:{hospital.name}',
            action_type='access',
            hospital=hospital,
        )
        
        # Generate new token with hospital info
        refresh = RefreshToken.for_user(request.user)
        
        return Response({
            'token': str(refresh.access_token),
            'user': {
                'id': request.user.id,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
                'role': 'admin',  # Acting as hospital admin
                'is_superuser': request.user.is_superuser,
            },
            'hospital': {
                'id': hospital.id,
                'name': hospital.name,
                'slug': hospital.slug if hasattr(hospital, 'slug') else '',
            }
        })
    except Hospital.DoesNotExist:
        return Response({'error': 'Hospital not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def switch_back_to_superadmin(request):
    """Switch back to super admin view"""
    if not _ensure_platform_super_admin(request):
        return Response({'error': 'Only platform super admins can access this endpoint'}, status=403)

    return Response({
        'success': True,
        'message': 'Switched back to super admin view'
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_platform_super_admins(request):
    if not _ensure_platform_super_admin(request):
        return Response({'error': 'Only platform super admins can access this endpoint'}, status=403)

    super_users = User.objects.filter(is_superuser=True).order_by('id')
    users = []
    for user in super_users:
        admin_type = _get_platform_admin_type(user)
        if not getattr(user, 'platform_super_admin_profile', None):
            _upsert_platform_admin_profile(user, admin_type)
        users.append(
            {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_active': user.is_active,
                'is_primary': admin_type == 'primary',
                'admin_type': admin_type,
                'date_joined': user.date_joined,
            }
        )
    return Response({'results': users})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_platform_super_admin(request):
    if not _ensure_primary_system_super_admin(request):
        return Response({'error': 'Only primary system super admin can access this endpoint'}, status=403)

    email = str(request.data.get('email', '')).strip().lower()
    first_name = str(request.data.get('first_name', '')).strip()
    last_name = str(request.data.get('last_name', '')).strip()
    password = str(request.data.get('password', '')).strip()
    admin_type = str(request.data.get('admin_type', 'secondary')).strip().lower()

    if not email or not password:
        return Response({'error': 'email and password are required'}, status=400)

    if admin_type not in {'primary', 'secondary'}:
        return Response({'error': 'admin_type must be primary or secondary'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'A user with this email already exists'}, status=400)

    try:
        validate_password(password)
    except DjangoValidationError as exc:
        return Response({'error': ' '.join(exc.messages)}, status=400)

    user = User.objects.create_superuser(
        username=email,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    _upsert_platform_admin_profile(user, admin_type)
    _create_superadmin_audit_log(
        request,
        action='create_platform_super_admin',
        target=f'user:{user.id}:{user.email}:admin_type={admin_type}',
        action_type='governance',
        hospital=None,
    )

    return Response(
        {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_active': user.is_active,
            'is_primary': admin_type == 'primary',
            'admin_type': admin_type,
        },
        status=201,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def toggle_platform_super_admin_status(request):
    if not _ensure_primary_system_super_admin(request):
        return Response({'error': 'Only primary system super admin can access this endpoint'}, status=403)

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'error': 'user_id is required'}, status=400)

    try:
        user = User.objects.get(id=user_id, is_superuser=True)
    except User.DoesNotExist:
        return Response({'error': 'Super admin user not found'}, status=404)

    if _get_platform_admin_type(user) == 'primary':
        return Response({'error': 'Primary system super admin cannot be deactivated'}, status=400)

    user.is_active = not user.is_active
    user.save(update_fields=['is_active'])

    _create_superadmin_audit_log(
        request,
        action='toggle_platform_super_admin_status',
        target=f'user:{user.id}:{user.email}:is_active={user.is_active}',
        action_type='governance',
        hospital=None,
    )

    return Response(
        {
            'success': True,
            'is_active': user.is_active,
            'message': 'Super admin activated' if user.is_active else 'Super admin deactivated',
        }
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_notification_failures(request):
    if not _ensure_platform_super_admin(request):
        return Response({'error': 'Only platform super admins can access this endpoint'}, status=403)

    limit = int(request.query_params.get('limit', 50) or 50)
    limit = max(1, min(limit, 200))

    failed_events = NotificationEvent.objects.filter(status='failed').order_by('-created_at')[:limit]
    failed_receipt_jobs = ReceiptEmailJob.objects.filter(status='failed').select_related('payment__hospital').order_by('-updated_at')[:limit]

    return Response(
        {
            'failed_notifications': [
                {
                    'id': event.id,
                    'type': event.notification_type,
                    'recipient': event.recipient,
                    'subject': event.subject,
                    'attempts': event.attempts,
                    'error_message': event.error_message,
                    'reference': event.reference,
                    'created_at': event.created_at,
                }
                for event in failed_events
            ],
            'failed_receipt_jobs': [
                {
                    'id': job.id,
                    'payment_id': job.payment_id,
                    'hospital_name': job.payment.hospital.name,
                    'attempts': job.attempts,
                    'max_attempts': job.max_attempts,
                    'last_error': job.last_error,
                    'next_attempt_at': job.next_attempt_at,
                    'updated_at': job.updated_at,
                }
                for job in failed_receipt_jobs
            ],
        }
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def retry_failed_receipt_jobs(request):
    if not _ensure_platform_super_admin(request):
        return Response({'error': 'Only platform super admins can access this endpoint'}, status=403)

    retried_count = ReceiptEmailJob.objects.filter(status='failed').update(
        status='pending',
        next_attempt_at=timezone.now(),
        processed_at=None,
        locked_at=None,
    )

    _create_superadmin_audit_log(
        request,
        action='retry_failed_receipt_jobs',
        target=f'retried_count={retried_count}',
        action_type='operations',
        hospital=None,
    )

    return Response({'success': True, 'retried_count': retried_count})