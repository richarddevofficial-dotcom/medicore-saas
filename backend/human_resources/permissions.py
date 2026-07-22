from rest_framework.permissions import BasePermission


def get_user_hospital_id(user):
    if not user or not user.is_authenticated:
        return None

    direct_hospital_id = getattr(user, "hospital_id", None)
    if direct_hospital_id:
        return direct_hospital_id

    employee_profile = getattr(user, "employee_profile", None)
    if employee_profile:
        return employee_profile.hospital_id

    staff_profile = getattr(user, "staff_profile", None)
    if staff_profile:
        return getattr(staff_profile, "hospital_id", None)

    staff = getattr(user, "staff", None)
    if staff:
        return getattr(staff, "hospital_id", None)

    return None


class IsHRUser(BasePermission):
    message = "You do not have permission to access Human Resources."

    allowed_roles = {
        "SUPER_ADMIN",
        "ADMIN",
        "HOSPITAL_ADMIN",
        "HR",
        "HR_MANAGER",
        "HR_OFFICER",
    }

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        role = str(getattr(user, "role", "") or "").upper()
        return role in self.allowed_roles


class IsHRManager(BasePermission):
    message = "HR manager permission is required."

    allowed_roles = {
        "SUPER_ADMIN",
        "ADMIN",
        "HOSPITAL_ADMIN",
        "HR_MANAGER",
    }

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        role = str(getattr(user, "role", "") or "").upper()
        return role in self.allowed_roles
