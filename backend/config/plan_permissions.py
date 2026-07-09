from rest_framework.permissions import BasePermission


class RequiresHospitalPlan(BasePermission):
    allowed_plans = ()
    message = "Your hospital subscription plan does not allow this module."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        staff_profile = getattr(user, "staff_profile", None)
        if not staff_profile or not staff_profile.hospital:
            return False

        hospital_plan = (staff_profile.hospital.subscription_plan or "trial").lower()
        return hospital_plan in self.allowed_plans


class RequiresProPlan(RequiresHospitalPlan):
    allowed_plans = ("pro", "enterprise")


class RequiresEnterprisePlan(RequiresHospitalPlan):
    allowed_plans = ("enterprise",)
