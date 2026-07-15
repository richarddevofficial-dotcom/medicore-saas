from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import HospitalSubscription, Invoice


GRACE_PERIOD_DAYS = 7
INVOICE_DUE_DAYS = 7


def generate_unique_invoice_number():
    while True:
        invoice_number = Invoice.generate_invoice_number()

        if not Invoice.objects.filter(
            invoice_number=invoice_number
        ).exists():
            return invoice_number


def has_open_initial_invoice(subscription):
    return Invoice.objects.filter(
        subscription=subscription,
        status__in=[
            Invoice.STATUS_DRAFT,
            Invoice.STATUS_PENDING,
            Invoice.STATUS_OVERDUE,
        ],
        invoice_type__in=[
            Invoice.TYPE_COMBINED,
            Invoice.TYPE_SERVICE_FEE,
            Invoice.TYPE_SUBSCRIPTION,
        ],
        metadata__billing_period="first_month",
    ).exists()


def has_open_renewal_invoice(subscription, billing_date):
    return Invoice.objects.filter(
        subscription=subscription,
        status__in=[
            Invoice.STATUS_DRAFT,
            Invoice.STATUS_PENDING,
            Invoice.STATUS_OVERDUE,
        ],
        invoice_type=Invoice.TYPE_SUBSCRIPTION,
        metadata__billing_period="monthly_renewal",
        metadata__billing_date=billing_date.isoformat(),
    ).exists()


@transaction.atomic
def process_expired_trial(subscription):
    """
    Move an expired trial into grace and create its initial invoice.

    Returns:
        subscription,
        invoice or None,
        invoice_created
    """
    subscription = (
        HospitalSubscription.objects
        .select_for_update()
        .select_related("hospital", "plan")
        .get(pk=subscription.pk)
    )

    now = timezone.now()
    today = timezone.localdate()

    if subscription.status != HospitalSubscription.STATUS_TRIAL:
        return subscription, None, False

    if not subscription.trial_ends_at:
        return subscription, None, False

    if subscription.trial_ends_at > now:
        return subscription, None, False

    subscription.status = HospitalSubscription.STATUS_GRACE
    subscription.grace_period_ends_at = (
        subscription.trial_ends_at
        + timedelta(days=GRACE_PERIOD_DAYS)
    )

    subscription.save(
        update_fields=[
            "status",
            "grace_period_ends_at",
            "updated_at",
        ]
    )

    hospital = subscription.hospital
    hospital.subscription_status = "grace"

    hospital.save(
        update_fields=[
            "subscription_status",
            "updated_at",
        ]
    )

    existing_invoice = (
        Invoice.objects
        .filter(
            subscription=subscription,
            status__in=[
                Invoice.STATUS_DRAFT,
                Invoice.STATUS_PENDING,
                Invoice.STATUS_OVERDUE,
            ],
            metadata__billing_period="first_month",
        )
        .order_by("-created_at")
        .first()
    )

    if existing_invoice:
        return subscription, existing_invoice, False

    service_fee_amount = (
        Decimal("0.00")
        if subscription.service_fee_paid
        else subscription.current_service_fee
    )

    subscription_amount = subscription.current_monthly_price
    subtotal = service_fee_amount + subscription_amount
    tax_amount = Decimal("0.00")
    total_amount = subtotal + tax_amount

    invoice_type = (
        Invoice.TYPE_SUBSCRIPTION
        if subscription.service_fee_paid
        else Invoice.TYPE_COMBINED
    )

    invoice = Invoice.objects.create(
        invoice_number=generate_unique_invoice_number(),
        hospital=subscription.hospital,
        subscription=subscription,
        invoice_type=invoice_type,
        status=Invoice.STATUS_PENDING,
        service_fee_amount=service_fee_amount,
        subscription_amount=subscription_amount,
        adjustment_amount=Decimal("0.00"),
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        amount_paid=Decimal("0.00"),
        currency=subscription.currency,
        issued_at=now,
        due_date=today + timedelta(days=INVOICE_DUE_DAYS),
        description=(
            f"Initial MediCore subscription invoice for "
            f"{subscription.hospital.name} — "
            f"{subscription.plan.name} plan."
        ),
        metadata={
            "billing_period": "first_month",
            "billing_date": today.isoformat(),
            "plan_code": subscription.plan.code,
            "plan_name": subscription.plan.name,
            "service_fee_included": (
                not subscription.service_fee_paid
            ),
            "generated_automatically": True,
        },
    )

    return subscription, invoice, True


@transaction.atomic
def create_monthly_renewal_invoice(subscription):
    """
    Create one monthly renewal invoice for a due subscription.

    Returns:
        invoice or None,
        created
    """
    subscription = (
        HospitalSubscription.objects
        .select_for_update()
        .select_related("hospital", "plan")
        .get(pk=subscription.pk)
    )

    today = timezone.localdate()
    now = timezone.now()

    if subscription.status != HospitalSubscription.STATUS_ACTIVE:
        return None, False

    if not subscription.next_billing_date:
        return None, False

    if subscription.next_billing_date > today:
        return None, False

    billing_date = subscription.next_billing_date

    existing_invoice = (
        Invoice.objects
        .filter(
            subscription=subscription,
            invoice_type=Invoice.TYPE_SUBSCRIPTION,
            metadata__billing_period="monthly_renewal",
            metadata__billing_date=billing_date.isoformat(),
        )
        .order_by("-created_at")
        .first()
    )

    if existing_invoice:
        return existing_invoice, False

    subscription_amount = subscription.current_monthly_price
    subtotal = subscription_amount
    tax_amount = Decimal("0.00")
    total_amount = subtotal + tax_amount

    invoice = Invoice.objects.create(
        invoice_number=generate_unique_invoice_number(),
        hospital=subscription.hospital,
        subscription=subscription,
        invoice_type=Invoice.TYPE_SUBSCRIPTION,
        status=Invoice.STATUS_PENDING,
        service_fee_amount=Decimal("0.00"),
        subscription_amount=subscription_amount,
        adjustment_amount=Decimal("0.00"),
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        amount_paid=Decimal("0.00"),
        currency=subscription.currency,
        issued_at=now,
        due_date=today + timedelta(days=INVOICE_DUE_DAYS),
        description=(
            f"Monthly MediCore subscription renewal for "
            f"{subscription.hospital.name} — "
            f"{subscription.plan.name} plan."
        ),
        metadata={
            "billing_period": "monthly_renewal",
            "billing_date": billing_date.isoformat(),
            "plan_code": subscription.plan.code,
            "plan_name": subscription.plan.name,
            "generated_automatically": True,
        },
    )

    return invoice, True
