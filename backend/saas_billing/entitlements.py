from django.core.exceptions import ValidationError

from patients.models import Patient
from staff.models import StaffProfile

from .models import HospitalSubscription, PlanFeature


class SubscriptionEntitlementError(ValidationError):
    pass


def get_hospital_subscription(hospital):
    try:
        return (
            HospitalSubscription.objects
            .select_related("hospital", "plan")
            .get(hospital=hospital)
        )
    except HospitalSubscription.DoesNotExist:
        return None


def get_plan_feature(subscription, feature_code):
    if not subscription:
        return None

    return PlanFeature.objects.filter(
        plan=subscription.plan,
        feature_code=feature_code,
    ).first()


def feature_is_enabled(hospital, feature_code):
    subscription = get_hospital_subscription(hospital)

    if not subscription:
        return False

    feature = get_plan_feature(
        subscription,
        feature_code,
    )

    return bool(
        feature
        and feature.is_enabled
    )


def get_feature_limit(hospital, feature_code):
    subscription = get_hospital_subscription(hospital)

    if not subscription:
        return 0

    feature = get_plan_feature(
        subscription,
        feature_code,
    )

    if not feature or not feature.is_enabled:
        return 0

    return feature.limit_value


def get_staff_count(hospital):
    queryset = StaffProfile.objects.filter(
        hospital=hospital
    )

    field_names = {
        field.name
        for field in StaffProfile._meta.fields
    }

    if "is_active" in field_names:
        queryset = queryset.filter(is_active=True)

    return queryset.count()


def get_patient_count(hospital):
    queryset = Patient.objects.filter(
        hospital=hospital
    )

    return queryset.count()


def get_staff_limit(hospital):
    subscription = get_hospital_subscription(hospital)

    if not subscription:
        return 0

    return subscription.plan.max_staff


def get_patient_limit(hospital):
    subscription = get_hospital_subscription(hospital)

    if not subscription:
        return 0

    return subscription.plan.max_patients


def can_create_staff(hospital):
    limit = get_staff_limit(hospital)
    current = get_staff_count(hospital)

    if limit is None:
        return True, current, None

    return current < limit, current, limit


def can_create_patient(hospital):
    limit = get_patient_limit(hospital)
    current = get_patient_count(hospital)

    if limit is None:
        return True, current, None

    return current < limit, current, limit


def enforce_staff_limit(hospital):
    allowed, current, limit = can_create_staff(
        hospital
    )

    if not allowed:
        raise SubscriptionEntitlementError(
            (
                f"Your subscription permits a maximum "
                f"of {limit} active staff members. "
                f"Current usage: {current}. "
                "Upgrade your subscription to add more staff."
            ),
            code="staff_limit_reached",
        )


def enforce_patient_limit(hospital):
    allowed, current, limit = can_create_patient(
        hospital
    )

    if not allowed:
        raise SubscriptionEntitlementError(
            (
                f"Your subscription permits a maximum "
                f"of {limit} patients. "
                f"Current usage: {current}. "
                "Upgrade your subscription to register more patients."
            ),
            code="patient_limit_reached",
        )


def build_hospital_entitlements(hospital):
    subscription = get_hospital_subscription(
        hospital
    )

    if not subscription:
        return {
            "subscription_configured": False,
            "features": {},
            "limits": {},
        }

    staff_allowed, staff_used, staff_limit = (
        can_create_staff(hospital)
    )

    patient_allowed, patient_used, patient_limit = (
        can_create_patient(hospital)
    )

    features = {}

    for feature in PlanFeature.objects.filter(
        plan=subscription.plan
    ):
        features[feature.feature_code] = {
            "name": feature.feature_name,
            "enabled": feature.is_enabled,
            "limit": feature.limit_value,
            "configuration": feature.configuration,
        }

    return {
        "subscription_configured": True,
        "plan": {
            "code": subscription.plan.code,
            "name": subscription.plan.name,
            "status": subscription.status,
        },
        "limits": {
            "staff": {
                "used": staff_used,
                "limit": staff_limit,
                "unlimited": staff_limit is None,
                "can_create": staff_allowed,
            },
            "patients": {
                "used": patient_used,
                "limit": patient_limit,
                "unlimited": patient_limit is None,
                "can_create": patient_allowed,
            },
        },
        "features": features,
    }
