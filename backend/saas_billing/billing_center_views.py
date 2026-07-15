from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.decorators import (
    api_view,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from hospitals.models import Hospital

from .models import (
    BillingReminderLog,
    HospitalSubscription,
    Invoice,
    Payment,
)


def is_platform_super_admin(user):
    return bool(
        user
        and user.is_authenticated
        and user.is_superuser
    )


def decimal_value(value):
    return str(value or Decimal("0.00"))


def serialize_recent_hospital(hospital):
    subscription = getattr(
        hospital,
        "saas_subscription",
        None,
    )

    return {
        "id": hospital.id,
        "name": hospital.name,
        "slug": hospital.slug,
        "email": hospital.email,
        "phone": hospital.phone,
        "country": hospital.country,
        "is_active": hospital.is_active,
        "is_verified": hospital.is_verified,
        "subscription_plan": (
            subscription.plan.name
            if subscription
            else None
        ),
        "subscription_plan_code": (
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
        "next_billing_date": (
            subscription.next_billing_date.isoformat()
            if subscription
            and subscription.next_billing_date
            else None
        ),
        "created_at": (
            hospital.created_at.isoformat()
            if hospital.created_at
            else None
        ),
    }


def serialize_pending_payment(payment):
    return {
        "id": payment.id,
        "payment_reference": payment.payment_reference,
        "transaction_id": payment.transaction_id,
        "hospital": {
            "id": payment.hospital.id,
            "name": payment.hospital.name,
            "slug": payment.hospital.slug,
        },
        "invoice": {
            "id": payment.invoice.id,
            "invoice_number": (
                payment.invoice.invoice_number
            ),
        },
        "plan": (
            payment.subscription.plan.name
            if payment.subscription
            and payment.subscription.plan
            else None
        ),
        "amount": decimal_value(payment.amount),
        "currency": payment.currency,
        "payment_method": payment.payment_method,
        "gateway": payment.gateway,
        "status": payment.status,
        "created_at": payment.created_at.isoformat(),
    }


def serialize_recent_payment(payment):
    return {
        "id": payment.id,
        "payment_reference": payment.payment_reference,
        "hospital_name": payment.hospital.name,
        "hospital_slug": payment.hospital.slug,
        "invoice_number": payment.invoice.invoice_number,
        "amount": decimal_value(payment.amount),
        "currency": payment.currency,
        "status": payment.status,
        "paid_at": (
            payment.paid_at.isoformat()
            if payment.paid_at
            else None
        ),
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_center_dashboard(request):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can access the billing center."
                )
            },
            status=403,
        )

    now = timezone.now()
    today = timezone.localdate()

    month_start = today.replace(day=1)
    twelve_months_ago = today - timedelta(days=365)

    subscriptions = (
        HospitalSubscription.objects
        .select_related("hospital", "plan")
    )

    successful_payments = Payment.objects.filter(
        status=Payment.STATUS_SUCCESS
    )

    total_revenue = successful_payments.aggregate(
        total=Sum("amount")
    )["total"] or Decimal("0.00")

    revenue_this_month = successful_payments.filter(
        paid_at__date__gte=month_start,
        paid_at__date__lte=today,
    ).aggregate(
        total=Sum("amount")
    )["total"] or Decimal("0.00")

    service_fee_revenue = Invoice.objects.filter(
        status=Invoice.STATUS_PAID
    ).aggregate(
        total=Sum("service_fee_amount")
    )["total"] or Decimal("0.00")

    subscription_revenue = Invoice.objects.filter(
        status=Invoice.STATUS_PAID
    ).aggregate(
        total=Sum("subscription_amount")
    )["total"] or Decimal("0.00")

    estimated_mrr = subscriptions.filter(
        status=HospitalSubscription.STATUS_ACTIVE
    ).aggregate(
        total=Sum("current_monthly_price")
    )["total"] or Decimal("0.00")

    estimated_arr = estimated_mrr * Decimal("12")

    revenue_by_month = list(
        successful_payments.filter(
            paid_at__date__gte=twelve_months_ago
        )
        .annotate(month=TruncMonth("paid_at"))
        .values("month")
        .annotate(total=Sum("amount"))
        .order_by("month")
    )

    plan_distribution = list(
        subscriptions.values(
            "plan__code",
            "plan__name",
        )
        .annotate(total=Count("id"))
        .order_by("plan__display_order")
    )

    subscription_status_distribution = list(
        subscriptions.values("status")
        .annotate(total=Count("id"))
        .order_by("status")
    )

    pending_invoices = Invoice.objects.filter(
        status=Invoice.STATUS_PENDING
    ).count()

    overdue_invoices = Invoice.objects.filter(
        status=Invoice.STATUS_OVERDUE
    ).count()

    open_invoice_totals = Invoice.objects.filter(
        status__in=[
            Invoice.STATUS_PENDING,
            Invoice.STATUS_OVERDUE,
        ]
    ).aggregate(
        total_amount=Sum("total_amount"),
        amount_paid=Sum("amount_paid"),
    )

    unpaid_balance = (
        (
            open_invoice_totals["total_amount"]
            or Decimal("0.00")
        )
        - (
            open_invoice_totals["amount_paid"]
            or Decimal("0.00")
        )
    )

    recent_hospitals = [
        serialize_recent_hospital(hospital)
        for hospital in Hospital.objects.order_by(
            "-created_at"
        )[:10]
    ]

    pending_payment_items = [
        serialize_pending_payment(payment)
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
        )
    ]

    recent_successful_payments = [
        serialize_recent_payment(payment)
        for payment in (
            successful_payments
            .select_related(
                "hospital",
                "invoice",
            )
            .order_by("-paid_at", "-created_at")[:10]
        )
    ]

    trial_ending_soon = subscriptions.filter(
        status=HospitalSubscription.STATUS_TRIAL,
        trial_ends_at__date__gte=today,
        trial_ends_at__date__lte=(
            today + timedelta(days=7)
        ),
    ).count()

    grace_ending_soon = subscriptions.filter(
        status=HospitalSubscription.STATUS_GRACE,
        grace_period_ends_at__date__gte=today,
        grace_period_ends_at__date__lte=(
            today + timedelta(days=3)
        ),
    ).count()

    reminders_sent_today = (
        BillingReminderLog.objects
        .filter(sent_at__date=today)
        .count()
    )

    return Response(
        {
            "generated_at": now.isoformat(),
            "summary": {
                "total_hospitals": Hospital.objects.count(),
                "configured_subscriptions": subscriptions.count(),
                "active_subscriptions": subscriptions.filter(
                    status=(
                        HospitalSubscription.STATUS_ACTIVE
                    )
                ).count(),
                "trial_subscriptions": subscriptions.filter(
                    status=(
                        HospitalSubscription.STATUS_TRIAL
                    )
                ).count(),
                "grace_subscriptions": subscriptions.filter(
                    status=(
                        HospitalSubscription.STATUS_GRACE
                    )
                ).count(),
                "expired_subscriptions": subscriptions.filter(
                    status=(
                        HospitalSubscription.STATUS_EXPIRED
                    )
                ).count(),
                "suspended_subscriptions": (
                    subscriptions.filter(
                        status=(
                            HospitalSubscription
                            .STATUS_SUSPENDED
                        )
                    ).count()
                ),
                "pending_payments": Payment.objects.filter(
                    status=Payment.STATUS_PENDING
                ).count(),
                "pending_invoices": pending_invoices,
                "overdue_invoices": overdue_invoices,
                "trial_ending_soon": trial_ending_soon,
                "grace_ending_soon": grace_ending_soon,
                "reminders_sent_today": reminders_sent_today,
            },
            "revenue": {
                "currency": "USD",
                "total_revenue": decimal_value(
                    total_revenue
                ),
                "revenue_this_month": decimal_value(
                    revenue_this_month
                ),
                "service_fee_revenue": decimal_value(
                    service_fee_revenue
                ),
                "subscription_revenue": decimal_value(
                    subscription_revenue
                ),
                "estimated_mrr": decimal_value(
                    estimated_mrr
                ),
                "estimated_arr": decimal_value(
                    estimated_arr
                ),
                "unpaid_balance": decimal_value(
                    unpaid_balance
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
            "subscription_status_distribution": [
                {
                    "status": item["status"],
                    "total": item["total"],
                }
                for item in (
                    subscription_status_distribution
                )
            ],
            "revenue_by_month": [
                {
                    "month": (
                        item["month"].strftime("%Y-%m")
                        if item["month"]
                        else None
                    ),
                    "total": decimal_value(
                        item["total"]
                    ),
                }
                for item in revenue_by_month
            ],
            "recent_hospitals": recent_hospitals,
            "pending_payments": pending_payment_items,
            "recent_successful_payments": (
                recent_successful_payments
            ),
        }
    )
