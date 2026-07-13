from datetime import timedelta

from django.utils import timezone

from .models import HospitalSubscription


GRACE_PERIOD_DAYS = 7


def refresh_subscription_status(subscription):
    """
    Update a subscription according to its trial, grace and active dates.
    """
    now = timezone.now()

    if subscription.status == HospitalSubscription.STATUS_TRIAL:
        if subscription.trial_ends_at and now > subscription.trial_ends_at:
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

    if subscription.status == HospitalSubscription.STATUS_GRACE:
        if (
            subscription.grace_period_ends_at
            and now > subscription.grace_period_ends_at
        ):
            subscription.status = HospitalSubscription.STATUS_EXPIRED

            subscription.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

    return subscription


def get_subscription_access(subscription):
    subscription = refresh_subscription_status(subscription)

    now = timezone.now()

    trial_days_remaining = 0
    grace_days_remaining = 0

    if subscription.trial_ends_at and now <= subscription.trial_ends_at:
        remaining = subscription.trial_ends_at - now
        trial_days_remaining = max(
            0,
            remaining.days + (1 if remaining.seconds else 0),
        )

    if (
        subscription.grace_period_ends_at
        and now <= subscription.grace_period_ends_at
    ):
        remaining = subscription.grace_period_ends_at - now
        grace_days_remaining = max(
            0,
            remaining.days + (1 if remaining.seconds else 0),
        )

    full_access = subscription.status in {
        HospitalSubscription.STATUS_TRIAL,
        HospitalSubscription.STATUS_ACTIVE,
        HospitalSubscription.STATUS_GRACE,
    }

    billing_only = subscription.status in {
        HospitalSubscription.STATUS_EXPIRED,
        HospitalSubscription.STATUS_SUSPENDED,
        HospitalSubscription.STATUS_CANCELLED,
    }

    return {
        "subscription": subscription,
        "full_access": full_access,
        "billing_only": billing_only,
        "trial_days_remaining": trial_days_remaining,
        "grace_days_remaining": grace_days_remaining,
    }
