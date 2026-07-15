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


# ============================================================
# Super Admin Hospital Billing Management
# ============================================================

from django.core.paginator import EmptyPage, Paginator


def parse_boolean_query(value):
    if value is None or value == "":
        return None

    normalized = str(value).strip().lower()

    if normalized in {"true", "1", "yes"}:
        return True

    if normalized in {"false", "0", "no"}:
        return False

    return None


def hospital_billing_row(
    hospital,
    subscription,
    invoice_summary,
    payment_summary,
):
    outstanding_balance = (
        invoice_summary.get("total_amount", Decimal("0.00"))
        - invoice_summary.get("amount_paid", Decimal("0.00"))
    )

    if outstanding_balance < Decimal("0.00"):
        outstanding_balance = Decimal("0.00")

    return {
        "id": hospital.id,
        "name": hospital.name,
        "slug": hospital.slug,
        "hospital_type": hospital.hospital_type,
        "email": hospital.email,
        "phone": hospital.phone,
        "city": hospital.city,
        "state": hospital.state,
        "country": hospital.country,
        "is_active": hospital.is_active,
        "is_verified": hospital.is_verified,
        "created_at": (
            hospital.created_at.isoformat()
            if hospital.created_at
            else None
        ),
        "subscription": (
            {
                "id": subscription.id,
                "plan": {
                    "id": subscription.plan.id,
                    "code": subscription.plan.code,
                    "name": subscription.plan.name,
                },
                "status": subscription.status,
                "currency": subscription.currency,
                "monthly_price": decimal_value(
                    subscription.current_monthly_price
                ),
                "service_fee": decimal_value(
                    subscription.current_service_fee
                ),
                "service_fee_paid": (
                    subscription.service_fee_paid
                ),
                "trial_ends_at": (
                    subscription.trial_ends_at.isoformat()
                    if subscription.trial_ends_at
                    else None
                ),
                "grace_period_ends_at": (
                    subscription
                    .grace_period_ends_at
                    .isoformat()
                    if subscription.grace_period_ends_at
                    else None
                ),
                "next_billing_date": (
                    subscription
                    .next_billing_date
                    .isoformat()
                    if subscription.next_billing_date
                    else None
                ),
            }
            if subscription
            else None
        ),
        "billing": {
            "outstanding_balance": decimal_value(
                outstanding_balance
            ),
            "pending_invoices": invoice_summary.get(
                "pending_invoices",
                0,
            ),
            "overdue_invoices": invoice_summary.get(
                "overdue_invoices",
                0,
            ),
            "pending_payments": payment_summary.get(
                "pending_payments",
                0,
            ),
            "successful_payments": payment_summary.get(
                "successful_payments",
                0,
            ),
            "total_paid": decimal_value(
                payment_summary.get(
                    "total_paid",
                    Decimal("0.00"),
                )
            ),
        },
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_center_hospitals(request):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can access hospital billing management."
                )
            },
            status=403,
        )

    queryset = Hospital.objects.all()

    search = str(
        request.query_params.get("search", "")
    ).strip()

    status_filter = str(
        request.query_params.get("status", "")
    ).strip().lower()

    plan_filter = str(
        request.query_params.get("plan", "")
    ).strip().lower()

    country_filter = str(
        request.query_params.get("country", "")
    ).strip()

    active_filter = parse_boolean_query(
        request.query_params.get("is_active")
    )

    verified_filter = parse_boolean_query(
        request.query_params.get("is_verified")
    )

    if search:
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(slug__icontains=search)
            | Q(email__icontains=search)
            | Q(phone__icontains=search)
            | Q(city__icontains=search)
            | Q(registration_number__icontains=search)
        )

    if country_filter:
        queryset = queryset.filter(
            country__iexact=country_filter
        )

    if active_filter is not None:
        queryset = queryset.filter(
            is_active=active_filter
        )

    if verified_filter is not None:
        queryset = queryset.filter(
            is_verified=verified_filter
        )

    if status_filter:
        queryset = queryset.filter(
            saas_subscription__status=status_filter
        )

    if plan_filter:
        queryset = queryset.filter(
            saas_subscription__plan__code=plan_filter
        )

    allowed_ordering = {
        "name": "name",
        "-name": "-name",
        "created_at": "created_at",
        "-created_at": "-created_at",
        "country": "country",
        "-country": "-country",
        "trial_ends_at": (
            "saas_subscription__trial_ends_at"
        ),
        "-trial_ends_at": (
            "-saas_subscription__trial_ends_at"
        ),
        "next_billing_date": (
            "saas_subscription__next_billing_date"
        ),
        "-next_billing_date": (
            "-saas_subscription__next_billing_date"
        ),
    }

    ordering_request = str(
        request.query_params.get(
            "ordering",
            "-created_at",
        )
    ).strip()

    ordering = allowed_ordering.get(
        ordering_request,
        "-created_at",
    )

    queryset = queryset.order_by(
        ordering,
        "id",
    ).distinct()

    try:
        page_size = int(
            request.query_params.get(
                "page_size",
                20,
            )
        )
    except (TypeError, ValueError):
        page_size = 20

    page_size = max(1, min(page_size, 100))

    try:
        page_number = int(
            request.query_params.get(
                "page",
                1,
            )
        )
    except (TypeError, ValueError):
        page_number = 1

    page_number = max(page_number, 1)

    paginator = Paginator(
        queryset,
        page_size,
    )

    try:
        page = paginator.page(page_number)
    except EmptyPage:
        page = paginator.page(
            paginator.num_pages
            if paginator.num_pages
            else 1
        )

    hospitals = list(page.object_list)
    hospital_ids = [
        hospital.id
        for hospital in hospitals
    ]

    subscriptions = (
        HospitalSubscription.objects
        .filter(hospital_id__in=hospital_ids)
        .select_related("plan", "hospital")
    )

    subscription_by_hospital = {
        subscription.hospital_id: subscription
        for subscription in subscriptions
    }

    invoice_rows = (
        Invoice.objects
        .filter(
            hospital_id__in=hospital_ids,
            status__in=[
                Invoice.STATUS_PENDING,
                Invoice.STATUS_OVERDUE,
            ],
        )
        .values("hospital_id")
        .annotate(
            total_amount=Sum("total_amount"),
            amount_paid=Sum("amount_paid"),
            pending_invoices=Count(
                "id",
                filter=Q(
                    status=Invoice.STATUS_PENDING
                ),
            ),
            overdue_invoices=Count(
                "id",
                filter=Q(
                    status=Invoice.STATUS_OVERDUE
                ),
            ),
        )
    )

    invoice_by_hospital = {
        item["hospital_id"]: {
            "total_amount": (
                item["total_amount"]
                or Decimal("0.00")
            ),
            "amount_paid": (
                item["amount_paid"]
                or Decimal("0.00")
            ),
            "pending_invoices": (
                item["pending_invoices"]
            ),
            "overdue_invoices": (
                item["overdue_invoices"]
            ),
        }
        for item in invoice_rows
    }

    payment_rows = (
        Payment.objects
        .filter(hospital_id__in=hospital_ids)
        .values("hospital_id")
        .annotate(
            pending_payments=Count(
                "id",
                filter=Q(
                    status=Payment.STATUS_PENDING
                ),
            ),
            successful_payments=Count(
                "id",
                filter=Q(
                    status=Payment.STATUS_SUCCESS
                ),
            ),
            total_paid=Sum(
                "amount",
                filter=Q(
                    status=Payment.STATUS_SUCCESS
                ),
            ),
        )
    )

    payment_by_hospital = {
        item["hospital_id"]: {
            "pending_payments": (
                item["pending_payments"]
            ),
            "successful_payments": (
                item["successful_payments"]
            ),
            "total_paid": (
                item["total_paid"]
                or Decimal("0.00")
            ),
        }
        for item in payment_rows
    }

    results = [
        hospital_billing_row(
            hospital=hospital,
            subscription=(
                subscription_by_hospital.get(
                    hospital.id
                )
            ),
            invoice_summary=(
                invoice_by_hospital.get(
                    hospital.id,
                    {},
                )
            ),
            payment_summary=(
                payment_by_hospital.get(
                    hospital.id,
                    {},
                )
            ),
        )
        for hospital in hospitals
    ]

    all_subscriptions = (
        HospitalSubscription.objects.all()
    )

    summary = {
        "total_hospitals": Hospital.objects.count(),
        "matching_hospitals": paginator.count,
        "active": all_subscriptions.filter(
            status=HospitalSubscription.STATUS_ACTIVE
        ).count(),
        "trial": all_subscriptions.filter(
            status=HospitalSubscription.STATUS_TRIAL
        ).count(),
        "grace": all_subscriptions.filter(
            status=HospitalSubscription.STATUS_GRACE
        ).count(),
        "expired": all_subscriptions.filter(
            status=HospitalSubscription.STATUS_EXPIRED
        ).count(),
        "suspended": all_subscriptions.filter(
            status=(
                HospitalSubscription.STATUS_SUSPENDED
            )
        ).count(),
        "unconfigured": (
            Hospital.objects.filter(
                saas_subscription__isnull=True
            ).count()
        ),
    }

    return Response(
        {
            "summary": summary,
            "filters": {
                "search": search,
                "status": status_filter or None,
                "plan": plan_filter or None,
                "country": country_filter or None,
                "is_active": active_filter,
                "is_verified": verified_filter,
                "ordering": ordering_request,
            },
            "pagination": {
                "page": page.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "total_items": paginator.count,
                "has_next": page.has_next(),
                "has_previous": page.has_previous(),
            },
            "results": results,
        }
    )


def serialize_billing_invoice(invoice):
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "invoice_type": invoice.invoice_type,
        "status": invoice.status,
        "currency": invoice.currency,
        "service_fee_amount": decimal_value(
            invoice.service_fee_amount
        ),
        "subscription_amount": decimal_value(
            invoice.subscription_amount
        ),
        "adjustment_amount": decimal_value(
            invoice.adjustment_amount
        ),
        "subtotal": decimal_value(invoice.subtotal),
        "tax_amount": decimal_value(invoice.tax_amount),
        "total_amount": decimal_value(
            invoice.total_amount
        ),
        "amount_paid": decimal_value(
            invoice.amount_paid
        ),
        "balance_due": decimal_value(
            invoice.balance_due
        ),
        "issued_at": (
            invoice.issued_at.isoformat()
            if invoice.issued_at
            else None
        ),
        "due_date": (
            invoice.due_date.isoformat()
            if invoice.due_date
            else None
        ),
        "paid_at": (
            invoice.paid_at.isoformat()
            if invoice.paid_at
            else None
        ),
        "description": invoice.description,
        "metadata": invoice.metadata or {},
        "created_at": invoice.created_at.isoformat(),
    }


def serialize_billing_payment(payment):
    return {
        "id": payment.id,
        "payment_reference": payment.payment_reference,
        "transaction_id": payment.transaction_id,
        "invoice_id": payment.invoice_id,
        "invoice_number": payment.invoice.invoice_number,
        "payment_type": payment.payment_type,
        "amount": decimal_value(payment.amount),
        "currency": payment.currency,
        "gateway": payment.gateway,
        "payment_method": payment.payment_method,
        "status": payment.status,
        "paid_at": (
            payment.paid_at.isoformat()
            if payment.paid_at
            else None
        ),
        "notes": payment.notes,
        "created_at": payment.created_at.isoformat(),
        "gateway_response": payment.gateway_response or {},
    }


def serialize_billing_reminder(reminder):
    return {
        "id": reminder.id,
        "reminder_type": reminder.reminder_type,
        "reminder_label": (
            reminder.get_reminder_type_display()
        ),
        "recipient_email": reminder.recipient_email,
        "subject": reminder.subject,
        "billing_date": (
            reminder.billing_date.isoformat()
            if reminder.billing_date
            else None
        ),
        "sent_at": (
            reminder.sent_at.isoformat()
            if reminder.sent_at
            else None
        ),
        "invoice_id": reminder.invoice_id,
        "subscription_id": reminder.subscription_id,
        "metadata": reminder.metadata or {},
    }


def build_billing_timeline(
    hospital,
    subscription,
    invoices,
    payments,
    reminders,
):
    events = []

    events.append(
        {
            "type": "hospital_created",
            "title": "Hospital registered",
            "description": (
                f"{hospital.name} was registered "
                "on MediCore."
            ),
            "timestamp": (
                hospital.created_at.isoformat()
                if hospital.created_at
                else None
            ),
        }
    )

    if subscription:
        if subscription.trial_started_at:
            events.append(
                {
                    "type": "trial_started",
                    "title": "Trial started",
                    "description": (
                        f"{subscription.plan.name} "
                        "trial started."
                    ),
                    "timestamp": (
                        subscription
                        .trial_started_at
                        .isoformat()
                    ),
                }
            )

        if subscription.activated_at:
            events.append(
                {
                    "type": "subscription_activated",
                    "title": "Subscription activated",
                    "description": (
                        f"{subscription.plan.name} "
                        "subscription activated."
                    ),
                    "timestamp": (
                        subscription
                        .activated_at
                        .isoformat()
                    ),
                }
            )

    for invoice in invoices:
        events.append(
            {
                "type": "invoice_created",
                "title": "Invoice generated",
                "description": (
                    f"{invoice.invoice_number} — "
                    f"{invoice.currency} "
                    f"{invoice.total_amount}"
                ),
                "timestamp": invoice.created_at.isoformat(),
                "invoice_id": invoice.id,
            }
        )

        if invoice.paid_at:
            events.append(
                {
                    "type": "invoice_paid",
                    "title": "Invoice paid",
                    "description": (
                        f"{invoice.invoice_number} "
                        "was marked paid."
                    ),
                    "timestamp": invoice.paid_at.isoformat(),
                    "invoice_id": invoice.id,
                }
            )

    for payment in payments:
        events.append(
            {
                "type": "payment_submitted",
                "title": "Payment submitted",
                "description": (
                    f"{payment.payment_reference} — "
                    f"{payment.currency} "
                    f"{payment.amount} — "
                    f"{payment.status}"
                ),
                "timestamp": payment.created_at.isoformat(),
                "payment_id": payment.id,
            }
        )

        if payment.paid_at:
            events.append(
                {
                    "type": "payment_approved",
                    "title": "Payment approved",
                    "description": (
                        f"{payment.payment_reference} "
                        "was approved."
                    ),
                    "timestamp": payment.paid_at.isoformat(),
                    "payment_id": payment.id,
                }
            )

    for reminder in reminders:
        events.append(
            {
                "type": "reminder_sent",
                "title": reminder.get_reminder_type_display(),
                "description": (
                    f"Reminder sent to "
                    f"{reminder.recipient_email}."
                ),
                "timestamp": reminder.sent_at.isoformat(),
                "reminder_id": reminder.id,
            }
        )

    events = [
        event
        for event in events
        if event.get("timestamp")
    ]

    events.sort(
        key=lambda event: event["timestamp"],
        reverse=True,
    )

    return events[:50]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_center_hospital_detail(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can access hospital billing details."
                )
            },
            status=403,
        )

    hospital = Hospital.objects.filter(
        id=hospital_id
    ).first()

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    subscription = (
        HospitalSubscription.objects
        .filter(hospital=hospital)
        .select_related("plan", "hospital")
        .first()
    )

    invoices = list(
        Invoice.objects
        .filter(hospital=hospital)
        .select_related(
            "hospital",
            "subscription",
        )
        .order_by("-created_at")[:100]
    )

    payments = list(
        Payment.objects
        .filter(hospital=hospital)
        .select_related(
            "hospital",
            "invoice",
            "subscription",
            "subscription__plan",
        )
        .order_by("-created_at")[:100]
    )

    reminders = list(
        BillingReminderLog.objects
        .filter(hospital=hospital)
        .select_related(
            "subscription",
            "invoice",
        )
        .order_by("-sent_at")[:100]
    )

    open_invoice_totals = (
        Invoice.objects
        .filter(
            hospital=hospital,
            status__in=[
                Invoice.STATUS_PENDING,
                Invoice.STATUS_OVERDUE,
            ],
        )
        .aggregate(
            total_amount=Sum("total_amount"),
            amount_paid=Sum("amount_paid"),
        )
    )

    outstanding_balance = (
        (
            open_invoice_totals["total_amount"]
            or Decimal("0.00")
        )
        - (
            open_invoice_totals["amount_paid"]
            or Decimal("0.00")
        )
    )

    if outstanding_balance < Decimal("0.00"):
        outstanding_balance = Decimal("0.00")

    successful_payment_total = (
        Payment.objects
        .filter(
            hospital=hospital,
            status=Payment.STATUS_SUCCESS,
        )
        .aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )

    pending_invoice_count = (
        Invoice.objects
        .filter(
            hospital=hospital,
            status=Invoice.STATUS_PENDING,
        )
        .count()
    )

    overdue_invoice_count = (
        Invoice.objects
        .filter(
            hospital=hospital,
            status=Invoice.STATUS_OVERDUE,
        )
        .count()
    )

    pending_payment_count = (
        Payment.objects
        .filter(
            hospital=hospital,
            status=Payment.STATUS_PENDING,
        )
        .count()
    )

    staff_count = 0
    patient_count = 0

    try:
        from staff.models import StaffProfile

        staff_count = StaffProfile.objects.filter(
            hospital=hospital,
            is_active=True,
        ).count()
    except Exception:
        staff_count = 0

    try:
        from patients.models import Patient

        patient_count = Patient.objects.filter(
            hospital=hospital
        ).count()
    except Exception:
        patient_count = 0

    subscription_data = None

    if subscription:
        subscription_data = {
            "id": subscription.id,
            "status": subscription.status,
            "plan": {
                "id": subscription.plan.id,
                "code": subscription.plan.code,
                "name": subscription.plan.name,
                "description": (
                    subscription.plan.description
                ),
                "max_staff": (
                    subscription.plan.max_staff
                ),
                "max_patients": (
                    subscription.plan.max_patients
                ),
                "storage_gb": (
                    subscription.plan.storage_gb
                ),
            },
            "currency": subscription.currency,
            "monthly_price": decimal_value(
                subscription.current_monthly_price
            ),
            "service_fee": decimal_value(
                subscription.current_service_fee
            ),
            "service_fee_paid": (
                subscription.service_fee_paid
            ),
            "service_fee_paid_at": (
                subscription
                .service_fee_paid_at
                .isoformat()
                if subscription.service_fee_paid_at
                else None
            ),
            "trial_started_at": (
                subscription
                .trial_started_at
                .isoformat()
                if subscription.trial_started_at
                else None
            ),
            "trial_ends_at": (
                subscription
                .trial_ends_at
                .isoformat()
                if subscription.trial_ends_at
                else None
            ),
            "activated_at": (
                subscription
                .activated_at
                .isoformat()
                if subscription.activated_at
                else None
            ),
            "next_billing_date": (
                subscription
                .next_billing_date
                .isoformat()
                if subscription.next_billing_date
                else None
            ),
            "grace_period_ends_at": (
                subscription
                .grace_period_ends_at
                .isoformat()
                if subscription.grace_period_ends_at
                else None
            ),
            "auto_renew": subscription.auto_renew,
        }

    timeline = build_billing_timeline(
        hospital=hospital,
        subscription=subscription,
        invoices=invoices,
        payments=payments,
        reminders=reminders,
    )

    return Response(
        {
            "hospital": {
                "id": hospital.id,
                "name": hospital.name,
                "slug": hospital.slug,
                "hospital_type": hospital.hospital_type,
                "registration_number": (
                    hospital.registration_number
                ),
                "email": hospital.email,
                "phone": hospital.phone,
                "website": hospital.website,
                "address": hospital.address,
                "city": hospital.city,
                "state": hospital.state,
                "country": hospital.country,
                "timezone": hospital.timezone,
                "currency": hospital.currency,
                "is_active": hospital.is_active,
                "is_verified": hospital.is_verified,
                "custom_domain": hospital.custom_domain,
                "domain_status": hospital.domain_status,
                "created_at": (
                    hospital.created_at.isoformat()
                    if hospital.created_at
                    else None
                ),
            },
            "subscription": subscription_data,
            "usage": {
                "staff": {
                    "used": staff_count,
                    "limit": (
                        subscription.plan.max_staff
                        if subscription
                        else hospital.max_staff
                    ),
                },
                "patients": {
                    "used": patient_count,
                    "limit": (
                        subscription.plan.max_patients
                        if subscription
                        else hospital.max_patients
                    ),
                },
            },
            "summary": {
                "outstanding_balance": decimal_value(
                    outstanding_balance
                ),
                "total_paid": decimal_value(
                    successful_payment_total
                ),
                "pending_invoices": (
                    pending_invoice_count
                ),
                "overdue_invoices": (
                    overdue_invoice_count
                ),
                "pending_payments": (
                    pending_payment_count
                ),
                "total_invoices": len(invoices),
                "total_payments": len(payments),
                "total_reminders": len(reminders),
            },
            "invoices": [
                serialize_billing_invoice(invoice)
                for invoice in invoices
            ],
            "payments": [
                serialize_billing_payment(payment)
                for payment in payments
            ],
            "reminders": [
                serialize_billing_reminder(reminder)
                for reminder in reminders
            ],
            "timeline": timeline,
        }
    )


# ============================================================
# Super Admin Subscription Management Actions
# ============================================================

from datetime import timedelta

from django.db import transaction

from .models import SubscriptionPlan
from .plan_change_services import (
    PlanChangeError,
    validate_target_plan,
)


def get_billing_center_hospital(hospital_id):
    return Hospital.objects.filter(
        id=hospital_id
    ).first()


def get_billing_center_subscription(hospital):
    return (
        HospitalSubscription.objects
        .filter(hospital=hospital)
        .select_related(
            "hospital",
            "plan",
        )
        .first()
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def billing_center_extend_trial(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can extend trials."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(
        hospital_id
    )

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    subscription = get_billing_center_subscription(
        hospital
    )

    if not subscription:
        return Response(
            {
                "error": (
                    "Hospital subscription is not configured."
                )
            },
            status=404,
        )

    try:
        days = int(
            request.data.get("days", 0)
        )
    except (TypeError, ValueError):
        days = 0

    if days < 1 or days > 365:
        return Response(
            {
                "error": (
                    "days must be between 1 and 365."
                )
            },
            status=400,
        )

    now = timezone.now()

    if (
        subscription.trial_ends_at
        and subscription.trial_ends_at > now
    ):
        base_date = subscription.trial_ends_at
    else:
        base_date = now

    subscription.status = (
        HospitalSubscription.STATUS_TRIAL
    )

    if not subscription.trial_started_at:
        subscription.trial_started_at = now

    subscription.trial_ends_at = (
        base_date + timedelta(days=days)
    )

    subscription.grace_period_ends_at = None

    subscription.save(
        update_fields=[
            "status",
            "trial_started_at",
            "trial_ends_at",
            "grace_period_ends_at",
            "updated_at",
        ]
    )

    hospital.subscription_status = "trial"
    hospital.is_active = True

    hospital.save(
        update_fields=[
            "subscription_status",
            "is_active",
            "updated_at",
        ]
    )

    return Response(
        {
            "success": True,
            "message": (
                f"Trial extended by {days} day(s)."
            ),
            "trial_ends_at": (
                subscription.trial_ends_at
                .isoformat()
            ),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def billing_center_end_trial(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can end trials."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(
        hospital_id
    )

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    subscription = get_billing_center_subscription(
        hospital
    )

    if not subscription:
        return Response(
            {
                "error": (
                    "Hospital subscription is not configured."
                )
            },
            status=404,
        )

    now = timezone.now()

    subscription.status = (
        HospitalSubscription.STATUS_GRACE
    )

    subscription.trial_ends_at = now
    subscription.grace_period_ends_at = (
        now + timedelta(days=7)
    )

    subscription.save(
        update_fields=[
            "status",
            "trial_ends_at",
            "grace_period_ends_at",
            "updated_at",
        ]
    )

    hospital.subscription_status = "grace"
    hospital.is_active = True

    hospital.save(
        update_fields=[
            "subscription_status",
            "is_active",
            "updated_at",
        ]
    )

    return Response(
        {
            "success": True,
            "message": (
                "Trial ended and grace period started."
            ),
            "grace_period_ends_at": (
                subscription
                .grace_period_ends_at
                .isoformat()
            ),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def billing_center_suspend_subscription(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can suspend subscriptions."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(
        hospital_id
    )

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    subscription = get_billing_center_subscription(
        hospital
    )

    if not subscription:
        return Response(
            {
                "error": (
                    "Hospital subscription is not configured."
                )
            },
            status=404,
        )

    subscription.status = (
        HospitalSubscription.STATUS_SUSPENDED
    )

    subscription.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    hospital.subscription_status = "suspended"

    # Keep the hospital active so tenant routing,
    # login and the billing portal continue working.
    hospital.is_active = True

    hospital.save(
        update_fields=[
            "subscription_status",
            "is_active",
            "updated_at",
        ]
    )

    return Response(
        {
            "success": True,
            "message": "Subscription suspended.",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def billing_center_reactivate_subscription(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can reactivate subscriptions."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(
        hospital_id
    )

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    subscription = get_billing_center_subscription(
        hospital
    )

    if not subscription:
        return Response(
            {
                "error": (
                    "Hospital subscription is not configured."
                )
            },
            status=404,
        )

    now = timezone.now()

    subscription.status = (
        HospitalSubscription.STATUS_ACTIVE
    )

    subscription.grace_period_ends_at = None

    if not subscription.activated_at:
        subscription.activated_at = now

    if not subscription.next_billing_date:
        subscription.next_billing_date = (
            timezone.localdate()
            + timedelta(days=30)
        )

    subscription.save(
        update_fields=[
            "status",
            "grace_period_ends_at",
            "activated_at",
            "next_billing_date",
            "updated_at",
        ]
    )

    hospital.subscription_status = "active"
    hospital.is_active = True

    hospital.save(
        update_fields=[
            "subscription_status",
            "is_active",
            "updated_at",
        ]
    )

    return Response(
        {
            "success": True,
            "message": "Subscription reactivated.",
            "next_billing_date": (
                subscription
                .next_billing_date
                .isoformat()
                if subscription.next_billing_date
                else None
            ),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def billing_center_change_plan(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can change subscription plans."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(
        hospital_id
    )

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    subscription = get_billing_center_subscription(
        hospital
    )

    if not subscription:
        return Response(
            {
                "error": (
                    "Hospital subscription is not configured."
                )
            },
            status=404,
        )

    plan_code = str(
        request.data.get("plan_code", "")
    ).strip().lower()

    if not plan_code:
        return Response(
            {"error": "plan_code is required."},
            status=400,
        )

    target_plan = SubscriptionPlan.objects.filter(
        code=plan_code,
        is_active=True,
    ).first()

    if not target_plan:
        return Response(
            {"error": "Subscription plan not found."},
            status=404,
        )

    if target_plan.id == subscription.plan_id:
        return Response(
            {
                "error": (
                    "The selected plan is already active."
                )
            },
            status=409,
        )

    try:
        validate_target_plan(
            subscription,
            target_plan,
        )
    except PlanChangeError as error:
        return Response(
            {"error": str(error)},
            status=400,
        )

    subscription.plan = target_plan
    subscription.current_monthly_price = (
        target_plan.monthly_price
    )
    subscription.current_service_fee = (
        target_plan.service_fee
    )
    subscription.currency = target_plan.currency

    subscription.save(
        update_fields=[
            "plan",
            "current_monthly_price",
            "current_service_fee",
            "currency",
            "updated_at",
        ]
    )

    hospital.subscription_plan = (
        target_plan.code
    )

    if target_plan.max_staff is not None:
        hospital.max_staff = (
            target_plan.max_staff
        )

    if target_plan.max_patients is not None:
        hospital.max_patients = (
            target_plan.max_patients
        )

    hospital.save(
        update_fields=[
            "subscription_plan",
            "max_staff",
            "max_patients",
            "updated_at",
        ]
    )

    return Response(
        {
            "success": True,
            "message": (
                f"Plan changed to "
                f"{target_plan.name}."
            ),
            "plan": {
                "id": target_plan.id,
                "code": target_plan.code,
                "name": target_plan.name,
                "monthly_price": decimal_value(
                    target_plan.monthly_price
                ),
                "service_fee": decimal_value(
                    target_plan.service_fee
                ),
                "currency": target_plan.currency,
            },
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def billing_center_waive_service_fee(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can waive service fees."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(
        hospital_id
    )

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    subscription = get_billing_center_subscription(
        hospital
    )

    if not subscription:
        return Response(
            {
                "error": (
                    "Hospital subscription is not configured."
                )
            },
            status=404,
        )

    now = timezone.now()

    subscription.service_fee_paid = True
    subscription.service_fee_paid_at = now

    subscription.save(
        update_fields=[
            "service_fee_paid",
            "service_fee_paid_at",
            "updated_at",
        ]
    )

    return Response(
        {
            "success": True,
            "message": (
                "Service fee marked as waived/paid."
            ),
            "service_fee_paid": True,
            "service_fee_paid_at": (
                subscription
                .service_fee_paid_at
                .isoformat()
            ),
        }
    )


# ============================================================
# Super Admin Billing Operations
# ============================================================

from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core.mail import send_mail

from .invoice_services import create_initial_invoice
from .models import (
    HospitalBillingNote,
    HospitalCredit,
)
from .renewal_services import (
    create_monthly_renewal_invoice,
)


def serialize_billing_note(note):
    return {
        "id": note.id,
        "title": note.title,
        "note": note.note,
        "is_internal": note.is_internal,
        "author": (
            {
                "id": note.author.id,
                "username": note.author.username,
                "email": note.author.email,
            }
            if note.author
            else None
        ),
        "created_at": note.created_at.isoformat(),
        "updated_at": note.updated_at.isoformat(),
    }


def serialize_credit_entry(entry):
    return {
        "id": entry.id,
        "entry_type": entry.entry_type,
        "amount": decimal_value(entry.amount),
        "currency": entry.currency,
        "reason": entry.reason,
        "reference": entry.reference,
        "metadata": entry.metadata or {},
        "created_by": (
            {
                "id": entry.created_by.id,
                "username": entry.created_by.username,
                "email": entry.created_by.email,
            }
            if entry.created_by
            else None
        ),
        "created_at": entry.created_at.isoformat(),
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def billing_center_generate_invoice(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can generate billing invoices."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(hospital_id)

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    subscription = get_billing_center_subscription(
        hospital
    )

    if not subscription:
        return Response(
            {
                "error": (
                    "Hospital subscription is not configured."
                )
            },
            status=404,
        )

    invoice_type = str(
        request.data.get("invoice_type", "monthly")
    ).strip().lower()

    if invoice_type == "initial":
        invoice, created = create_initial_invoice(
            subscription
        )

    elif invoice_type == "monthly":
        if not subscription.next_billing_date:
            subscription.next_billing_date = (
                timezone.localdate()
            )

            subscription.save(
                update_fields=[
                    "next_billing_date",
                    "updated_at",
                ]
            )

        invoice, created = (
            create_monthly_renewal_invoice(
                subscription
            )
        )

    else:
        return Response(
            {
                "error": (
                    "invoice_type must be either "
                    "'initial' or 'monthly'."
                )
            },
            status=400,
        )

    if not invoice:
        return Response(
            {
                "error": (
                    "Invoice could not be generated for "
                    "the current subscription state."
                )
            },
            status=400,
        )

    return Response(
        {
            "success": True,
            "created": created,
            "message": (
                "Invoice generated successfully."
                if created
                else "An equivalent invoice already exists."
            ),
            "invoice": serialize_billing_invoice(
                invoice
            ),
        },
        status=201 if created else 200,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def billing_center_resend_invoice_reminder(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can resend invoice reminders."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(hospital_id)

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    invoice_id = request.data.get("invoice_id")

    if not invoice_id:
        return Response(
            {"error": "invoice_id is required."},
            status=400,
        )

    invoice = (
        Invoice.objects
        .filter(
            id=invoice_id,
            hospital=hospital,
        )
        .select_related(
            "hospital",
            "subscription",
        )
        .first()
    )

    if not invoice:
        return Response(
            {"error": "Invoice not found."},
            status=404,
        )

    recipient = (
        hospital.email or ""
    ).strip().lower()

    try:
        from staff.models import StaffProfile

        admin_profile = (
            StaffProfile.objects
            .filter(
                hospital=hospital,
                role="admin",
                is_active=True,
                user__is_active=True,
            )
            .select_related("user")
            .first()
        )

        if (
            admin_profile
            and admin_profile.user.email
        ):
            recipient = (
                admin_profile.user.email
                .strip()
                .lower()
            )
    except Exception:
        pass

    if not recipient:
        return Response(
            {
                "error": (
                    "No hospital administrator email "
                    "is configured."
                )
            },
            status=400,
        )

    subject = (
        f"MediCore invoice reminder — "
        f"{invoice.invoice_number}"
    )

    message = (
        f"Hello {hospital.name} Administrator,\n\n"
        f"This is a reminder regarding MediCore invoice "
        f"{invoice.invoice_number}.\n\n"
        f"Invoice total: {invoice.currency} "
        f"{invoice.total_amount}\n"
        f"Amount paid: {invoice.currency} "
        f"{invoice.amount_paid}\n"
        f"Balance due: {invoice.currency} "
        f"{invoice.balance_due}\n"
        f"Due date: {invoice.due_date}\n"
        f"Status: {invoice.status}\n\n"
        f"Open your billing portal:\n"
        f"https://{hospital.slug}.medicorecloud.com/"
        f"settings/billing\n\n"
        f"Support: support@medicorecloud.com\n\n"
        f"Regards,\n"
        f"MediCore HMS Team"
    )

    sent = send_mail(
        subject=subject,
        message=message,
        from_email=getattr(
            settings,
            "DEFAULT_FROM_EMAIL",
            "noreply@medicorecloud.com",
        ),
        recipient_list=[recipient],
        fail_silently=False,
    )

    if sent != 1:
        return Response(
            {"error": "Reminder email was not sent."},
            status=500,
        )

    return Response(
        {
            "success": True,
            "message": "Invoice reminder sent.",
            "recipient": recipient,
            "invoice_number": invoice.invoice_number,
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def billing_center_billing_notes(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can manage billing notes."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(hospital_id)

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    if request.method == "GET":
        notes = (
            HospitalBillingNote.objects
            .filter(hospital=hospital)
            .select_related("author")
            .order_by("-created_at")[:100]
        )

        return Response(
            {
                "results": [
                    serialize_billing_note(note)
                    for note in notes
                ]
            }
        )

    title = str(
        request.data.get("title", "")
    ).strip()

    note_text = str(
        request.data.get("note", "")
    ).strip()

    if not note_text:
        return Response(
            {"error": "note is required."},
            status=400,
        )

    note = HospitalBillingNote.objects.create(
        hospital=hospital,
        author=request.user,
        title=title,
        note=note_text,
        is_internal=True,
    )

    return Response(
        {
            "success": True,
            "message": "Billing note added.",
            "note": serialize_billing_note(note),
        },
        status=201,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def billing_center_hospital_credits(
    request,
    hospital_id,
):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can manage hospital credits."
                )
            },
            status=403,
        )

    hospital = get_billing_center_hospital(hospital_id)

    if not hospital:
        return Response(
            {"error": "Hospital not found."},
            status=404,
        )

    subscription = get_billing_center_subscription(
        hospital
    )

    if request.method == "GET":
        entries = (
            HospitalCredit.objects
            .filter(hospital=hospital)
            .select_related(
                "subscription",
                "created_by",
            )
            .order_by("-created_at")[:100]
        )

        credits = (
            HospitalCredit.objects
            .filter(
                hospital=hospital,
                entry_type=HospitalCredit.CREDIT,
            )
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        debits = (
            HospitalCredit.objects
            .filter(
                hospital=hospital,
                entry_type=HospitalCredit.DEBIT,
            )
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        return Response(
            {
                "balance": decimal_value(
                    credits - debits
                ),
                "currency": (
                    subscription.currency
                    if subscription
                    else hospital.currency
                ),
                "results": [
                    serialize_credit_entry(entry)
                    for entry in entries
                ],
            }
        )

    entry_type = str(
        request.data.get(
            "entry_type",
            HospitalCredit.CREDIT,
        )
    ).strip().lower()

    if entry_type not in {
        HospitalCredit.CREDIT,
        HospitalCredit.DEBIT,
    }:
        return Response(
            {
                "error": (
                    "entry_type must be credit or debit."
                )
            },
            status=400,
        )

    try:
        amount = Decimal(
            str(request.data.get("amount", "0"))
        )
    except (InvalidOperation, TypeError, ValueError):
        return Response(
            {"error": "Invalid amount."},
            status=400,
        )

    if amount <= Decimal("0.00"):
        return Response(
            {
                "error": (
                    "amount must be greater than zero."
                )
            },
            status=400,
        )

    reason = str(
        request.data.get("reason", "")
    ).strip()

    if not reason:
        return Response(
            {"error": "reason is required."},
            status=400,
        )

    entry = HospitalCredit.objects.create(
        hospital=hospital,
        subscription=subscription,
        entry_type=entry_type,
        amount=amount,
        currency=(
            subscription.currency
            if subscription
            else hospital.currency
        ),
        reason=reason,
        reference=str(
            request.data.get("reference", "")
        ).strip(),
        created_by=request.user,
        metadata={
            "source": "billing_center",
        },
    )

    return Response(
        {
            "success": True,
            "message": (
                f"Hospital {entry_type} recorded."
            ),
            "entry": serialize_credit_entry(entry),
        },
        status=201,
    )


# ============================================================
# Super Admin Invoice and Payment Center
# ============================================================

from datetime import datetime


def parse_date_query(value):
    if not value:
        return None

    try:
        return datetime.strptime(
            str(value).strip(),
            "%Y-%m-%d",
        ).date()
    except (TypeError, ValueError):
        return None


def paginate_queryset(request, queryset):
    try:
        page_size = int(
            request.query_params.get(
                "page_size",
                20,
            )
        )
    except (TypeError, ValueError):
        page_size = 20

    page_size = max(1, min(page_size, 100))

    try:
        page_number = int(
            request.query_params.get(
                "page",
                1,
            )
        )
    except (TypeError, ValueError):
        page_number = 1

    page_number = max(1, page_number)

    paginator = Paginator(
        queryset,
        page_size,
    )

    try:
        page = paginator.page(page_number)
    except EmptyPage:
        page = paginator.page(
            paginator.num_pages
            if paginator.num_pages
            else 1
        )

    return paginator, page, page_size


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_center_invoices(request):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can access the invoice center."
                )
            },
            status=403,
        )

    queryset = (
        Invoice.objects
        .select_related(
            "hospital",
            "subscription",
            "subscription__plan",
        )
        .all()
    )

    search = str(
        request.query_params.get("search", "")
    ).strip()

    status_filter = str(
        request.query_params.get("status", "")
    ).strip().lower()

    invoice_type_filter = str(
        request.query_params.get(
            "invoice_type",
            "",
        )
    ).strip().lower()

    hospital_filter = str(
        request.query_params.get(
            "hospital",
            "",
        )
    ).strip()

    date_from = parse_date_query(
        request.query_params.get("date_from")
    )

    date_to = parse_date_query(
        request.query_params.get("date_to")
    )

    if search:
        queryset = queryset.filter(
            Q(invoice_number__icontains=search)
            | Q(hospital__name__icontains=search)
            | Q(hospital__slug__icontains=search)
            | Q(hospital__email__icontains=search)
            | Q(description__icontains=search)
        )

    if status_filter:
        queryset = queryset.filter(
            status=status_filter
        )

    if invoice_type_filter:
        queryset = queryset.filter(
            invoice_type=invoice_type_filter
        )

    if hospital_filter:
        queryset = queryset.filter(
            Q(hospital__name__icontains=hospital_filter)
            | Q(hospital__slug__icontains=hospital_filter)
        )

    if date_from:
        queryset = queryset.filter(
            created_at__date__gte=date_from
        )

    if date_to:
        queryset = queryset.filter(
            created_at__date__lte=date_to
        )

    allowed_ordering = {
        "created_at": "created_at",
        "-created_at": "-created_at",
        "due_date": "due_date",
        "-due_date": "-due_date",
        "total_amount": "total_amount",
        "-total_amount": "-total_amount",
        "invoice_number": "invoice_number",
        "-invoice_number": "-invoice_number",
        "hospital": "hospital__name",
        "-hospital": "-hospital__name",
    }

    ordering_request = str(
        request.query_params.get(
            "ordering",
            "-created_at",
        )
    ).strip()

    ordering = allowed_ordering.get(
        ordering_request,
        "-created_at",
    )

    queryset = queryset.order_by(
        ordering,
        "id",
    )

    paginator, page, page_size = paginate_queryset(
        request,
        queryset,
    )

    totals = queryset.aggregate(
        total_amount=Sum("total_amount"),
        amount_paid=Sum("amount_paid"),
    )

    total_amount = (
        totals["total_amount"]
        or Decimal("0.00")
    )

    amount_paid = (
        totals["amount_paid"]
        or Decimal("0.00")
    )

    return Response(
        {
            "summary": {
                "matching_invoices": paginator.count,
                "pending": queryset.filter(
                    status=Invoice.STATUS_PENDING
                ).count(),
                "overdue": queryset.filter(
                    status=Invoice.STATUS_OVERDUE
                ).count(),
                "paid": queryset.filter(
                    status=Invoice.STATUS_PAID
                ).count(),
                "total_amount": decimal_value(
                    total_amount
                ),
                "amount_paid": decimal_value(
                    amount_paid
                ),
                "outstanding_balance": decimal_value(
                    total_amount - amount_paid
                ),
            },
            "filters": {
                "search": search,
                "status": status_filter or None,
                "invoice_type": (
                    invoice_type_filter or None
                ),
                "hospital": hospital_filter or None,
                "date_from": (
                    date_from.isoformat()
                    if date_from
                    else None
                ),
                "date_to": (
                    date_to.isoformat()
                    if date_to
                    else None
                ),
                "ordering": ordering_request,
            },
            "pagination": {
                "page": page.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "total_items": paginator.count,
                "has_next": page.has_next(),
                "has_previous": page.has_previous(),
            },
            "results": [
                {
                    **serialize_billing_invoice(invoice),
                    "hospital": {
                        "id": invoice.hospital.id,
                        "name": invoice.hospital.name,
                        "slug": invoice.hospital.slug,
                        "email": invoice.hospital.email,
                    },
                    "plan": (
                        {
                            "id": invoice.subscription.plan.id,
                            "code": (
                                invoice.subscription.plan.code
                            ),
                            "name": (
                                invoice.subscription.plan.name
                            ),
                        }
                        if invoice.subscription
                        and invoice.subscription.plan
                        else None
                    ),
                }
                for invoice in page.object_list
            ],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_center_payments(request):
    if not is_platform_super_admin(request.user):
        return Response(
            {
                "error": (
                    "Only a platform super administrator "
                    "can access the payment center."
                )
            },
            status=403,
        )

    queryset = (
        Payment.objects
        .select_related(
            "hospital",
            "invoice",
            "subscription",
            "subscription__plan",
        )
        .all()
    )

    search = str(
        request.query_params.get("search", "")
    ).strip()

    status_filter = str(
        request.query_params.get("status", "")
    ).strip().lower()

    payment_type_filter = str(
        request.query_params.get(
            "payment_type",
            "",
        )
    ).strip().lower()

    gateway_filter = str(
        request.query_params.get("gateway", "")
    ).strip().lower()

    hospital_filter = str(
        request.query_params.get(
            "hospital",
            "",
        )
    ).strip()

    date_from = parse_date_query(
        request.query_params.get("date_from")
    )

    date_to = parse_date_query(
        request.query_params.get("date_to")
    )

    if search:
        queryset = queryset.filter(
            Q(payment_reference__icontains=search)
            | Q(transaction_id__icontains=search)
            | Q(invoice__invoice_number__icontains=search)
            | Q(hospital__name__icontains=search)
            | Q(hospital__slug__icontains=search)
            | Q(hospital__email__icontains=search)
        )

    if status_filter:
        queryset = queryset.filter(
            status=status_filter
        )

    if payment_type_filter:
        queryset = queryset.filter(
            payment_type=payment_type_filter
        )

    if gateway_filter:
        queryset = queryset.filter(
            gateway=gateway_filter
        )

    if hospital_filter:
        queryset = queryset.filter(
            Q(hospital__name__icontains=hospital_filter)
            | Q(hospital__slug__icontains=hospital_filter)
        )

    if date_from:
        queryset = queryset.filter(
            created_at__date__gte=date_from
        )

    if date_to:
        queryset = queryset.filter(
            created_at__date__lte=date_to
        )

    allowed_ordering = {
        "created_at": "created_at",
        "-created_at": "-created_at",
        "paid_at": "paid_at",
        "-paid_at": "-paid_at",
        "amount": "amount",
        "-amount": "-amount",
        "payment_reference": "payment_reference",
        "-payment_reference": "-payment_reference",
        "hospital": "hospital__name",
        "-hospital": "-hospital__name",
    }

    ordering_request = str(
        request.query_params.get(
            "ordering",
            "-created_at",
        )
    ).strip()

    ordering = allowed_ordering.get(
        ordering_request,
        "-created_at",
    )

    queryset = queryset.order_by(
        ordering,
        "id",
    )

    paginator, page, page_size = paginate_queryset(
        request,
        queryset,
    )

    successful_total = (
        queryset.filter(
            status=Payment.STATUS_SUCCESS
        )
        .aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )

    pending_total = (
        queryset.filter(
            status=Payment.STATUS_PENDING
        )
        .aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )

    return Response(
        {
            "summary": {
                "matching_payments": paginator.count,
                "pending": queryset.filter(
                    status=Payment.STATUS_PENDING
                ).count(),
                "successful": queryset.filter(
                    status=Payment.STATUS_SUCCESS
                ).count(),
                "failed": queryset.filter(
                    status=Payment.STATUS_FAILED
                ).count(),
                "successful_amount": decimal_value(
                    successful_total
                ),
                "pending_amount": decimal_value(
                    pending_total
                ),
            },
            "filters": {
                "search": search,
                "status": status_filter or None,
                "payment_type": (
                    payment_type_filter or None
                ),
                "gateway": gateway_filter or None,
                "hospital": hospital_filter or None,
                "date_from": (
                    date_from.isoformat()
                    if date_from
                    else None
                ),
                "date_to": (
                    date_to.isoformat()
                    if date_to
                    else None
                ),
                "ordering": ordering_request,
            },
            "pagination": {
                "page": page.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "total_items": paginator.count,
                "has_next": page.has_next(),
                "has_previous": page.has_previous(),
            },
            "results": [
                {
                    **serialize_billing_payment(payment),
                    "hospital": {
                        "id": payment.hospital.id,
                        "name": payment.hospital.name,
                        "slug": payment.hospital.slug,
                        "email": payment.hospital.email,
                    },
                    "plan": (
                        {
                            "id": payment.subscription.plan.id,
                            "code": (
                                payment.subscription.plan.code
                            ),
                            "name": (
                                payment.subscription.plan.name
                            ),
                        }
                        if payment.subscription
                        and payment.subscription.plan
                        else None
                    ),
                }
                for payment in page.object_list
            ],
        }
    )
