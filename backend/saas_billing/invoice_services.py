from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import HospitalSubscription, Invoice


INITIAL_INVOICE_DUE_DAYS = 7


def generate_unique_invoice_number():
    while True:
        invoice_number = Invoice.generate_invoice_number()

        if not Invoice.objects.filter(
            invoice_number=invoice_number
        ).exists():
            return invoice_number


@transaction.atomic
def create_initial_invoice(subscription):
    """
    Create the hospital's initial commercial invoice.

    If the one-time platform service fee has not been paid, the invoice
    contains both the service fee and the first monthly subscription.

    If an unpaid initial invoice already exists, return it instead of
    creating a duplicate.
    """
    if not isinstance(subscription, HospitalSubscription):
        raise ValueError(
            "A valid HospitalSubscription instance is required."
        )

    subscription = (
        HospitalSubscription.objects
        .select_for_update()
        .select_related("hospital", "plan")
        .get(pk=subscription.pk)
    )

    existing_invoice = (
        Invoice.objects
        .filter(
            subscription=subscription,
            invoice_type=Invoice.TYPE_COMBINED,
            status__in=[
                Invoice.STATUS_DRAFT,
                Invoice.STATUS_PENDING,
                Invoice.STATUS_OVERDUE,
            ],
        )
        .order_by("-created_at")
        .first()
    )

    if existing_invoice:
        return existing_invoice, False

    if subscription.service_fee_paid:
        invoice_type = Invoice.TYPE_SUBSCRIPTION
        service_fee_amount = Decimal("0.00")
    else:
        invoice_type = Invoice.TYPE_COMBINED
        service_fee_amount = subscription.current_service_fee

    subscription_amount = subscription.current_monthly_price

    subtotal = (
        service_fee_amount
        + subscription_amount
    )

    tax_amount = Decimal("0.00")
    total_amount = subtotal + tax_amount

    today = timezone.localdate()
    due_date = today + timedelta(
        days=INITIAL_INVOICE_DUE_DAYS
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
        issued_at=timezone.now(),
        due_date=due_date,
        description=(
            f"Initial MediCore invoice for "
            f"{subscription.hospital.name} — "
            f"{subscription.plan.name} plan."
        ),
        metadata={
            "plan_code": subscription.plan.code,
            "plan_name": subscription.plan.name,
            "monthly_price": str(
                subscription.current_monthly_price
            ),
            "service_fee": str(
                subscription.current_service_fee
            ),
            "service_fee_included": (
                not subscription.service_fee_paid
            ),
            "billing_period": "first_month",
        },
    )

    return invoice, True
