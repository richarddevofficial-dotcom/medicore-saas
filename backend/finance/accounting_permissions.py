from rest_framework.permissions import BasePermission


FINANCE_ROLE_NAMES = {
    "admin",
    "superadmin",
    "superuser",
    "finance",
    "finance_manager",
    "accountant",
    "cashier",
}

FINANCE_MANAGER_ROLE_NAMES = {
    "admin",
    "superadmin",
    "superuser",
    "finance_manager",
    "accountant",
}


def get_user_role_name(user):
    """
    Resolve a role name from common MediCore user structures.
    """

    if not user or not user.is_authenticated:
        return ""

    if user.is_superuser:
        return "superuser"

    role = getattr(user, "role", None)

    if isinstance(role, str):
        return role.strip().lower()

    if role is not None:
        role_name = getattr(role, "name", "")
        if role_name:
            return str(role_name).strip().lower()

        role_code = getattr(role, "code", "")
        if role_code:
            return str(role_code).strip().lower()

    try:
        staff_profile = user.staff_profile
    except Exception:
        staff_profile = None

    if staff_profile and staff_profile.role:
        return str(staff_profile.role).strip().lower()

    return ""


class IsFinanceUser(BasePermission):
    """
    Allows authenticated finance users.
    """

    message = "You do not have permission to access finance records."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        role_name = get_user_role_name(user)

        if role_name in FINANCE_ROLE_NAMES:
            return True

        return False


class IsFinanceManager(BasePermission):
    """
    Allows posting, reversal, deletion and sensitive accounting actions.
    """

    message = (
        "Only a finance manager, accountant, administrator, "
        "or superuser may perform this action."
    )

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        return get_user_role_name(user) in FINANCE_MANAGER_ROLE_NAMES
