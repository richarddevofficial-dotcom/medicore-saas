from django.db import transaction
from django.utils import timezone

from .models import HospitalSubscription, Invoice


@transaction.atomic
def suspend_expired_grace_subscription(subscription):
    """
    Suspend a subscription after its grace period has ended.

    The Hospital record remains active so that the tenant domain,
    login page and billing portal continue to work.
    """
    subscription = (
        HospitalSubscription.objects
        .select_for_update()
        .select_related("hospital", "plan")
        .get(pk=subscription.pk)
    )

    now = timezone.now()

    if subscription.status != HospitalSubscription.STATUS_GRACE:
        return subscription, False, "Subscription is not in grace."

    if not subscription.grace_period_ends_at:
        return subscription, False, "Grace-period end date is missing."

    if subscription.grace_period_ends_at > now:
        return subscription, False, "Grace period is still active."

    subscription.status = HospitalSubscription.STATUS_SUSPENDED

    subscription.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    hospital = subscription.hospital
    hospital.subscription_status = "suspended"

    # Do not set hospital.is_active=False.
    # Tenant middleware requires the hospital to remain active
    # so the billing portal can still resolve and load.
    hospital.save(
        update_fields=[
            "subscription_status",
            "updated_at",
        ]
    )

    overdue_invoices = Invoice.objects.filter(
        subscription=subscription,
        status=Invoice.STATUS_PENDING,
        due_date__lt=timezone.localdate(),
    )

    overdue_invoices.update(
        status=Invoice.STATUS_OVERDUE,
        updated_at=now,
    )

    return subscription, True, "Subscription suspended."


@transaction.atomic
def reactivate_subscription_after_payment(subscription):
    """
    Restore a suspended, expired or grace subscription after payment.
    """
    subscription = (
        HospitalSubscription.objects
        .select_for_update()
        .select_related("hospital", "plan")
        .get(pk=subscription.pk)
    )

    previous_status = subscription.status

    subscription.status = HospitalSubscription.STATUS_ACTIVE
    subscription.grace_period_ends_at = None

    if not subscription.activated_at:
        subscription.activated_at = timezone.now()

    subscription.save(
        update_fields=[
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

    changed = previous_status != HospitalSubscription.STATUS_ACTIVE

    return subscription, changed
