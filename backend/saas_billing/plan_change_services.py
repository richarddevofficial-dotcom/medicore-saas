from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .entitlements import (
    get_patient_count,
    get_staff_count,
)
from .models import (
    HospitalSubscription,
    Invoice,
    SubscriptionPlan,
)


class PlanChangeError(Exception):
    pass


def validate_target_plan(subscription, target_plan):
    if subscription.plan_id == target_plan.id:
        raise PlanChangeError(
            "The selected plan is already active."
        )

    current_staff = get_staff_count(
        subscription.hospital
    )
    current_patients = get_patient_count(
        subscription.hospital
    )

    if (
        target_plan.max_staff is not None
        and current_staff > target_plan.max_staff
    ):
        raise PlanChangeError(
            (
                f"Cannot change to {target_plan.name}. "
                f"The hospital currently has {current_staff} "
                f"active staff, but the plan limit is "
                f"{target_plan.max_staff}."
            )
        )

    if (
        target_plan.max_patients is not None
        and current_patients > target_plan.max_patients
    ):
        raise PlanChangeError(
            (
                f"Cannot change to {target_plan.name}. "
                f"The hospital currently has "
                f"{current_patients} patients, but the "
                f"plan limit is {target_plan.max_patients}."
            )
        )

    return {
        "staff_used": current_staff,
        "staff_limit": target_plan.max_staff,
        "patients_used": current_patients,
        "patients_limit": target_plan.max_patients,
    }


def determine_plan_change_type(
    current_plan,
    target_plan,
):
    if target_plan.monthly_price > current_plan.monthly_price:
        return "upgrade"

    return "downgrade"


def generate_plan_change_invoice_number():
    return Invoice.generate_invoice_number()


@transaction.atomic
def create_plan_change_invoice(
    *,
    subscription,
    target_plan,
):
    subscription = (
        HospitalSubscription.objects
        .select_for_update()
        .select_related(
            "hospital",
            "plan",
        )
        .get(pk=subscription.pk)
    )

    target_plan = SubscriptionPlan.objects.get(
        pk=target_plan.pk,
        is_active=True,
    )

    usage = validate_target_plan(
        subscription,
        target_plan,
    )

    existing_invoice = (
        Invoice.objects
        .filter(
            hospital=subscription.hospital,
            status__in=[
                Invoice.STATUS_DRAFT,
                Invoice.STATUS_PENDING,
                Invoice.STATUS_OVERDUE,
            ],
            metadata__change_type__in=[
                "upgrade",
                "downgrade",
            ],
        )
        .order_by("-created_at")
        .first()
    )

    if existing_invoice:
        return existing_invoice, False

    change_type = determine_plan_change_type(
        subscription.plan,
        target_plan,
    )

    monthly_difference = (
        target_plan.monthly_price
        - subscription.current_monthly_price
    )

    if change_type == "upgrade":
        subscription_amount = max(
            Decimal("0.00"),
            monthly_difference,
        )
    else:
        subscription_amount = Decimal("0.00")

    service_fee_amount = Decimal("0.00")

    subtotal = subscription_amount
    tax_amount = Decimal("0.00")
    total_amount = subtotal

    invoice = Invoice.objects.create(
        invoice_number=(
            generate_plan_change_invoice_number()
        ),
        hospital=subscription.hospital,
        subscription=subscription,
        invoice_type=Invoice.TYPE_ADJUSTMENT,
        status=(
            Invoice.STATUS_PENDING
            if total_amount > Decimal("0.00")
            else Invoice.STATUS_PAID
        ),
        service_fee_amount=service_fee_amount,
        subscription_amount=subscription_amount,
        adjustment_amount=Decimal("0.00"),
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        amount_paid=(
            total_amount
            if total_amount == Decimal("0.00")
            else Decimal("0.00")
        ),
        currency=target_plan.currency,
        issued_at=timezone.now(),
        due_date=(
            timezone.localdate()
            + timedelta(days=7)
        ),
        paid_at=(
            timezone.now()
            if total_amount == Decimal("0.00")
            else None
        ),
        description=(
            f"{change_type.title()} from "
            f"{subscription.plan.name} to "
            f"{target_plan.name}."
        ),
        metadata={
            "change_type": change_type,
            "current_plan_id": subscription.plan.id,
            "current_plan_code": subscription.plan.code,
            "current_plan_name": subscription.plan.name,
            "target_plan_id": target_plan.id,
            "target_plan_code": target_plan.code,
            "target_plan_name": target_plan.name,
            "target_monthly_price": str(
                target_plan.monthly_price
            ),
            "target_service_fee": str(
                target_plan.service_fee
            ),
            "staff_used": usage["staff_used"],
            "staff_limit": usage["staff_limit"],
            "patients_used": usage["patients_used"],
            "patients_limit": usage["patients_limit"],
        },
    )

    if total_amount == Decimal("0.00"):
        activate_plan_change(
            subscription=subscription,
            invoice=invoice,
        )

    return invoice, True


@transaction.atomic
def activate_plan_change(
    *,
    subscription,
    invoice,
):
    subscription = (
        HospitalSubscription.objects
        .select_for_update()
        .select_related(
            "hospital",
            "plan",
        )
        .get(pk=subscription.pk)
    )

    target_plan_id = (
        invoice.metadata or {}
    ).get("target_plan_id")

    if not target_plan_id:
        raise PlanChangeError(
            "Target plan information is missing."
        )

    target_plan = SubscriptionPlan.objects.get(
        id=target_plan_id,
        is_active=True,
    )

    validate_target_plan(
        subscription,
        target_plan,
    )

    subscription.plan = target_plan
    subscription.current_monthly_price = (
        target_plan.monthly_price
    )
    subscription.current_service_fee = (
        target_plan.service_fee
    )
    subscription.currency = target_plan.currency
    subscription.status = (
        HospitalSubscription.STATUS_ACTIVE
    )

    subscription.save(
        update_fields=[
            "plan",
            "current_monthly_price",
            "current_service_fee",
            "currency",
            "status",
            "updated_at",
        ]
    )

    hospital = subscription.hospital
    hospital.subscription_plan = target_plan.code
    hospital.max_staff = (
        target_plan.max_staff or 0
    )
    hospital.max_patients = (
        target_plan.max_patients or 0
    )

    hospital.save(
        update_fields=[
            "subscription_plan",
            "max_staff",
            "max_patients",
            "updated_at",
        ]
    )

    return subscription
