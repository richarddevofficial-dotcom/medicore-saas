from datetime import datetime, time, timedelta

from django.conf import settings
from django.utils import timezone

from .models import HospitalSubscription


GRACE_PERIOD_DAYS = settings.SUBSCRIPTION_GRACE_PERIOD_DAYS
EXPIRING_SOON_DAYS = settings.SUBSCRIPTION_EXPIRING_SOON_DAYS


def _save_status_transition(subscription, old_status, update_fields):
    subscription.save(update_fields=[*update_fields, "updated_at"])

    if old_status == subscription.status:
        return

    from config.audit_logger import AuditLogger

    AuditLogger.log_audit(
        user=None,
        action=f"SUBSCRIPTION_{subscription.status.upper()}",
        target=f"hospital_subscription:{subscription.id}",
        hospital=subscription.hospital,
        old_values={"status": old_status},
        new_values={"status": subscription.status},
    )


def refresh_subscription_status(subscription):
    """
    Update a subscription according to its trial, grace and active dates.
    """
    now = timezone.now()
    old_status = subscription.status

    if subscription.status == HospitalSubscription.STATUS_TRIAL:
        if subscription.trial_ends_at and now > subscription.trial_ends_at:
            subscription.status = HospitalSubscription.STATUS_GRACE
            subscription.grace_period_ends_at = (
                subscription.trial_ends_at
                + timedelta(days=GRACE_PERIOD_DAYS)
            )

            _save_status_transition(
                subscription,
                old_status,
                [
                    "status",
                    "grace_period_ends_at",
                ],
            )
            old_status = subscription.status

    if subscription.status == HospitalSubscription.STATUS_GRACE:
        if (
            subscription.grace_period_ends_at
            and now > subscription.grace_period_ends_at
        ):
            subscription.status = HospitalSubscription.STATUS_EXPIRED

            _save_status_transition(
                subscription,
                old_status,
                ["status"],
            )
            old_status = subscription.status

    if subscription.status in {
        HospitalSubscription.STATUS_ACTIVE,
        HospitalSubscription.STATUS_EXPIRING_SOON,
    }:
        today = timezone.localdate()
        end_date = subscription.end_date or subscription.next_billing_date

        if end_date and today <= end_date:
            days_remaining = (end_date - today).days
            expected_status = (
                HospitalSubscription.STATUS_EXPIRING_SOON
                if days_remaining <= EXPIRING_SOON_DAYS
                else HospitalSubscription.STATUS_ACTIVE
            )
            if subscription.status != expected_status:
                subscription.status = expected_status
                _save_status_transition(
                    subscription,
                    old_status,
                    ["status"],
                )
                old_status = subscription.status
        elif end_date:
            grace_end_date = end_date + timedelta(days=GRACE_PERIOD_DAYS)
            if today <= grace_end_date:
                subscription.status = HospitalSubscription.STATUS_GRACE
                subscription.grace_period_ends_at = timezone.make_aware(
                    datetime.combine(grace_end_date, time.max)
                )
                _save_status_transition(
                    subscription,
                    old_status,
                    [
                        "status",
                        "grace_period_ends_at",
                    ],
                )
                old_status = subscription.status
            else:
                subscription.status = HospitalSubscription.STATUS_EXPIRED
                _save_status_transition(
                    subscription,
                    old_status,
                    ["status"],
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
        HospitalSubscription.STATUS_EXPIRING_SOON,
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


def get_hospital_plan_limits(hospital):
    """Return effective limits for a hospital from SaaS plan (fallback to legacy hospital fields)."""
    limits = {
        "plan_code": (getattr(hospital, "subscription_plan", "trial") or "trial").lower(),
        "max_staff": getattr(hospital, "max_staff", None),
        "max_patients": getattr(hospital, "max_patients", None),
    }

    if not hospital:
        return limits

    subscription = (
        HospitalSubscription.objects
        .select_related("plan")
        .filter(hospital=hospital)
        .first()
    )
    if subscription and subscription.plan:
        limits["plan_code"] = (subscription.plan.code or limits["plan_code"]).lower()
        limits["max_staff"] = subscription.plan.max_staff
        limits["max_patients"] = subscription.plan.max_patients

    return limits


def check_hospital_limit(hospital, resource_type):
    """Check if a hospital can create another resource within plan limits."""
    if resource_type not in {"staff", "patients"}:
        raise ValueError("resource_type must be 'staff' or 'patients'")

    limits = get_hospital_plan_limits(hospital)
    plan_code = limits["plan_code"]

    if resource_type == "staff":
        from staff.models import StaffProfile

        current_count = StaffProfile.objects.filter(hospital=hospital, is_active=True).count()
        max_allowed = limits.get("max_staff")
        label = "staff"
    else:
        from patients.models import Patient

        current_count = Patient.objects.filter(hospital=hospital).count()
        max_allowed = limits.get("max_patients")
        label = "patients"

    allowed = max_allowed is None or current_count < max_allowed
    return {
        "allowed": allowed,
        "resource_type": resource_type,
        "label": label,
        "current": current_count,
        "limit": max_allowed,
        "plan_code": plan_code,
    }
