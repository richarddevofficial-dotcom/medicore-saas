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
