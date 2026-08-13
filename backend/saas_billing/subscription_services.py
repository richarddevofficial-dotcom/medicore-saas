from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.utils import timezone

from .models import HospitalSubscription


BILLING_CYCLE_MONTHLY = "monthly"
BILLING_CYCLE_SIX_MONTHS = "six_months"
BILLING_CYCLE_ANNUAL = "annual"

BILLING_CYCLE_MONTHS = {
    BILLING_CYCLE_MONTHLY: 1,
    BILLING_CYCLE_SIX_MONTHS: 6,
    BILLING_CYCLE_ANNUAL: 12,
}

# Billing-period discounts applied on top of the base monthly rate.
# Monthly has no discount; six-month and annual commitments are
# discounted to reward longer commitments.
BILLING_CYCLE_DISCOUNT_PERCENT = {
    BILLING_CYCLE_MONTHLY: Decimal("0"),
    BILLING_CYCLE_SIX_MONTHS: Decimal("5"),
    BILLING_CYCLE_ANNUAL: Decimal("10"),
}


def calculate_subscription_end_date(start_date, billing_cycle):
    if not isinstance(start_date, date):
        raise ValueError("start_date must be a date.")

    try:
        months = BILLING_CYCLE_MONTHS[billing_cycle]
    except KeyError as exc:
        raise ValueError("Unsupported billing cycle.") from exc

    return start_date + relativedelta(months=months)


def get_renewal_period(current_end_date, billing_cycle, today):
    if not isinstance(today, date):
        raise ValueError("today must be a date.")

    if current_end_date and current_end_date >= today:
        start_date = current_end_date
    else:
        start_date = today

    return (
        start_date,
        calculate_subscription_end_date(start_date, billing_cycle),
    )


def get_plan_cycle_price(plan, billing_cycle):
    if billing_cycle == BILLING_CYCLE_MONTHLY:
        return plan.monthly_price

    if billing_cycle == BILLING_CYCLE_SIX_MONTHS:
        return (
            plan.six_month_price
            if plan.six_month_price is not None
            else plan.monthly_price * Decimal("6")
        )

    if billing_cycle == BILLING_CYCLE_ANNUAL:
        return (
            plan.annual_price
            if plan.annual_price is not None
            else plan.monthly_price * Decimal("12")
        )

    raise ValueError("Unsupported billing cycle.")


def get_cycle_pricing(plan, billing_cycle):
    """
    Return the full price breakdown for a billing period.

    ``original_amount`` is the undiscounted price (monthly rate times the
    number of months), ``discount_percent`` is the period discount and
    ``final_amount`` is what the hospital actually pays for the cycle
    (the plan's explicit cycle price when set, otherwise the discounted
    amount).
    """
    try:
        months = BILLING_CYCLE_MONTHS[billing_cycle]
    except KeyError as exc:
        raise ValueError("Unsupported billing cycle.") from exc

    original_amount = (
        plan.monthly_price * Decimal(months)
    ).quantize(Decimal("0.01"))
    discount_percent = BILLING_CYCLE_DISCOUNT_PERCENT[billing_cycle]
    final_amount = get_plan_cycle_price(
        plan,
        billing_cycle,
    ).quantize(Decimal("0.01"))

    discount_amount = max(
        Decimal("0.00"),
        original_amount - final_amount,
    )

    return {
        "billing_cycle": billing_cycle,
        "months": months,
        "original_amount": original_amount,
        "discount_percent": discount_percent,
        "discount_amount": discount_amount,
        "final_amount": final_amount,
    }


def renew_subscription(subscription, billing_cycle, payment_date=None):
    today = payment_date or timezone.localdate()
    current_end_date = subscription.end_date or subscription.next_billing_date
    start_date, end_date = get_renewal_period(
        current_end_date=current_end_date,
        billing_cycle=billing_cycle,
        today=today,
    )

    subscription.billing_cycle = billing_cycle
    subscription.start_date = start_date
    subscription.end_date = end_date
    subscription.next_billing_date = end_date
    subscription.last_payment_date = today
    subscription.status = HospitalSubscription.STATUS_ACTIVE
    subscription.grace_period_ends_at = None

    if not subscription.activated_at:
        subscription.activated_at = timezone.now()

    subscription.save(
        update_fields=[
            "billing_cycle",
            "start_date",
            "end_date",
            "next_billing_date",
            "last_payment_date",
            "status",
            "grace_period_ends_at",
            "activated_at",
            "updated_at",
        ]
    )

    hospital = subscription.hospital
    hospital.subscription_status = "active"
    hospital.is_active = True
    hospital.save(
        update_fields=[
            "subscription_status",
            "is_active",
            "updated_at",
        ]
    )

    return subscription


def extend_subscription(subscription, billing_cycle, reason, today=None):
    extension_date = today or timezone.localdate()
    current_end_date = subscription.end_date or subscription.next_billing_date
    start_date, end_date = get_renewal_period(
        current_end_date=current_end_date,
        billing_cycle=billing_cycle,
        today=extension_date,
    )

    subscription.billing_cycle = billing_cycle
    subscription.start_date = start_date
    subscription.end_date = end_date
    subscription.next_billing_date = end_date
    subscription.status = HospitalSubscription.STATUS_ACTIVE
    subscription.grace_period_ends_at = None
    subscription.notes = "\n".join(
        part
        for part in [
            subscription.notes.strip(),
            f"Manual extension ({billing_cycle}): {reason}",
        ]
        if part
    )
    subscription.save(
        update_fields=[
            "billing_cycle",
            "start_date",
            "end_date",
            "next_billing_date",
            "status",
            "grace_period_ends_at",
            "notes",
            "updated_at",
        ]
    )

    hospital = subscription.hospital
    hospital.subscription_status = "active"
    hospital.is_active = True
    hospital.save(
        update_fields=["subscription_status", "is_active", "updated_at"]
    )

    return subscription