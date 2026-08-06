from rest_framework.permissions import BasePermission
from django.utils import timezone


class RequiresHospitalPlan(BasePermission):
    allowed_plans = ()
    message = "Your hospital subscription plan does not allow this module."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        staff_profile = getattr(user, "staff_profile", None)
        if not staff_profile or not staff_profile.hospital:
            return False

        hospital = staff_profile.hospital
        subscription = getattr(hospital, "saas_subscription", None)
        if subscription:
            from saas_billing.models import HospitalSubscription
            from saas_billing.services import get_subscription_access

            access = get_subscription_access(subscription)
            if (
                access["full_access"]
                and subscription.status
                in {
                    HospitalSubscription.STATUS_TRIAL,
                    HospitalSubscription.STATUS_GRACE,
                }
            ):
                return True

        hospital_plan = (
            subscription.plan.code
            if subscription and subscription.plan_id
            else hospital.subscription_plan
        )
        hospital_plan = (hospital_plan or "trial").lower()

        if hospital_plan == "trial":
            trial_end = hospital.trial_end
            return (
                hospital.subscription_status == "active"
                and (trial_end is None or timezone.now() <= trial_end)
            )

        return hospital_plan in self.allowed_plans


class RequiresProPlan(RequiresHospitalPlan):
    allowed_plans = ("pro", "enterprise")


class RequiresEnterprisePlan(RequiresHospitalPlan):
    allowed_plans = ("enterprise",)
