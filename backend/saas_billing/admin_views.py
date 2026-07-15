from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from hospitals.models import Hospital

from .models import (
    HospitalSubscription,
    Invoice,
    Payment,
)


def require_platform_super_admin(user):
    return bool(
        user
        and user.is_authenticated
        and user.is_superuser
    )


def decimal_string(value):
    return str(value or Decimal("0.00"))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def saas_admin_dashboard(request):
    if not require_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can access this dashboard."
                )
            },
            status=403,
        )

    now = timezone.now()
    today = timezone.localdate()
    twelve_months_ago = today - timedelta(days=365)

    subscriptions = (
        HospitalSubscription.objects
        .select_related("hospital", "plan")
    )

    total_hospitals = Hospital.objects.count()

    active_hospitals = subscriptions.filter(
        status=HospitalSubscription.STATUS_ACTIVE
    ).count()

    trial_hospitals = subscriptions.filter(
        status=HospitalSubscription.STATUS_TRIAL
    ).count()

    grace_hospitals = subscriptions.filter(
        status=HospitalSubscription.STATUS_GRACE
    ).count()

    expired_hospitals = subscriptions.filter(
        status=HospitalSubscription.STATUS_EXPIRED
    ).count()

    suspended_hospitals = subscriptions.filter(
        status=HospitalSubscription.STATUS_SUSPENDED
    ).count()

    pending_payments = Payment.objects.filter(
        status=Payment.STATUS_PENDING
    ).count()

    successful_payments = Payment.objects.filter(
        status=Payment.STATUS_SUCCESS
    )

    overdue_invoices = Invoice.objects.filter(
        status=Invoice.STATUS_OVERDUE
    ).count()

    pending_invoices = Invoice.objects.filter(
        status=Invoice.STATUS_PENDING
    ).count()

    total_revenue = successful_payments.aggregate(
        amount=Sum("amount")
    )["amount"] or Decimal("0.00")

    monthly_revenue = successful_payments.filter(
        paid_at__year=today.year,
        paid_at__month=today.month,
    ).aggregate(
        amount=Sum("amount")
    )["amount"] or Decimal("0.00")

    monthly_subscription_revenue = (
        successful_payments
        .filter(
            paid_at__year=today.year,
            paid_at__month=today.month,
            payment_type__in=[
                Payment.TYPE_SUBSCRIPTION,
                Payment.TYPE_COMBINED,
            ],
        )
        .aggregate(amount=Sum("amount"))["amount"]
        or Decimal("0.00")
    )

    service_fee_revenue = (
        Invoice.objects
        .filter(
            status=Invoice.STATUS_PAID,
            paid_at__isnull=False,
        )
        .aggregate(
            amount=Sum("service_fee_amount")
        )["amount"]
        or Decimal("0.00")
    )

    estimated_mrr = subscriptions.filter(
        status=HospitalSubscription.STATUS_ACTIVE
    ).aggregate(
        amount=Sum("current_monthly_price")
    )["amount"] or Decimal("0.00")

    estimated_arr = estimated_mrr * Decimal("12")

    plan_distribution = list(
        subscriptions.values(
            "plan__code",
            "plan__name",
        )
        .annotate(total=Count("id"))
        .order_by("plan__display_order")
    )

    revenue_by_month = list(
        successful_payments.filter(
            paid_at__date__gte=twelve_months_ago
        )
        .annotate(month=TruncMonth("paid_at"))
        .values("month")
        .annotate(total=Sum("amount"))
        .order_by("month")
    )

    registrations_by_month = list(
        Hospital.objects.filter(
            created_at__date__gte=twelve_months_ago
        )
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(total=Count("id"))
        .order_by("month")
    )

    recent_hospitals = []

    for hospital in (
        Hospital.objects
        .order_by("-created_at")[:10]
    ):
        subscription = getattr(
            hospital,
            "saas_subscription",
            None,
        )

        recent_hospitals.append(
            {
                "id": hospital.id,
                "name": hospital.name,
                "slug": hospital.slug,
                "email": hospital.email,
                "is_active": hospital.is_active,
                "created_at": (
                    hospital.created_at.isoformat()
                    if hospital.created_at
                    else None
                ),
                "plan": (
                    subscription.plan.name
                    if subscription
                    else None
                ),
                "plan_code": (
                    subscription.plan.code
                    if subscription
                    else None
                ),
                "subscription_status": (
                    subscription.status
                    if subscription
                    else "not_configured"
                ),
                "trial_ends_at": (
                    subscription.trial_ends_at.isoformat()
                    if subscription
                    and subscription.trial_ends_at
                    else None
                ),
            }
        )

    pending_payment_items = []

    for payment in (
        Payment.objects
        .filter(status=Payment.STATUS_PENDING)
        .select_related(
            "hospital",
            "invoice",
            "subscription",
            "subscription__plan",
        )
        .order_by("-created_at")[:10]
    ):
        pending_payment_items.append(
            {
                "id": payment.id,
                "payment_reference": (
                    payment.payment_reference
                ),
                "transaction_id": payment.transaction_id,
                "hospital": {
                    "id": payment.hospital.id,
                    "name": payment.hospital.name,
                    "slug": payment.hospital.slug,
                },
                "invoice_number": (
                    payment.invoice.invoice_number
                ),
                "plan": payment.subscription.plan.name,
                "amount": decimal_string(payment.amount),
                "currency": payment.currency,
                "gateway": payment.gateway,
                "payment_method": payment.payment_method,
                "created_at": payment.created_at.isoformat(),
            }
        )

    trial_conversion_total = (
        active_hospitals
        + trial_hospitals
        + grace_hospitals
        + expired_hospitals
    )

    trial_conversion_rate = (
        round(
            (
                active_hospitals
                / trial_conversion_total
            ) * 100,
            2,
        )
        if trial_conversion_total
        else 0
    )

    return Response(
        {
            "generated_at": now.isoformat(),
            "summary": {
                "total_hospitals": total_hospitals,
                "active_hospitals": active_hospitals,
                "trial_hospitals": trial_hospitals,
                "grace_hospitals": grace_hospitals,
                "expired_hospitals": expired_hospitals,
                "suspended_hospitals": suspended_hospitals,
                "pending_payments": pending_payments,
                "pending_invoices": pending_invoices,
                "overdue_invoices": overdue_invoices,
                "trial_conversion_rate": (
                    trial_conversion_rate
                ),
            },
            "revenue": {
                "currency": "USD",
                "total_revenue": decimal_string(
                    total_revenue
                ),
                "monthly_revenue": decimal_string(
                    monthly_revenue
                ),
                "monthly_subscription_revenue": (
                    decimal_string(
                        monthly_subscription_revenue
                    )
                ),
                "service_fee_revenue": decimal_string(
                    service_fee_revenue
                ),
                "estimated_mrr": decimal_string(
                    estimated_mrr
                ),
                "estimated_arr": decimal_string(
                    estimated_arr
                ),
            },
            "plan_distribution": [
                {
                    "code": item["plan__code"],
                    "name": item["plan__name"],
                    "total": item["total"],
                }
                for item in plan_distribution
            ],
            "revenue_by_month": [
                {
                    "month": (
                        item["month"].strftime("%Y-%m")
                        if item["month"]
                        else None
                    ),
                    "total": decimal_string(
                        item["total"]
                    ),
                }
                for item in revenue_by_month
            ],
            "registrations_by_month": [
                {
                    "month": (
                        item["month"].strftime("%Y-%m")
                        if item["month"]
                        else None
                    ),
                    "total": item["total"],
                }
                for item in registrations_by_month
            ],
            "recent_hospitals": recent_hospitals,
            "pending_payment_items": (
                pending_payment_items
            ),
        }
    )
