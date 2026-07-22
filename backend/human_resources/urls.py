from django.urls import include, path
from rest_framework.routers import DefaultRouter

from departments.views import DepartmentViewSet
from .views import (
    AttendanceViewSet,
    EmployeeDocumentViewSet,
    EmployeeViewSet,
    EmploymentContractViewSet,
    JobPositionViewSet,
    LeaveBalanceViewSet,
    LeaveRequestViewSet,
    LeaveTypeViewSet,
    ShiftAssignmentViewSet,
    ShiftViewSet,
    hr_dashboard,
)


router = DefaultRouter()

router.register(
    "employees",
    EmployeeViewSet,
    basename="hr-employee",
)

router.register(
    "positions",
    JobPositionViewSet,
    basename="hr-position",
)

router.register(
    "contracts",
    EmploymentContractViewSet,
    basename="hr-contract",
)

router.register(
    "documents",
    EmployeeDocumentViewSet,
    basename="hr-document",
)

router.register(
    "shifts",
    ShiftViewSet,
    basename="hr-shift",
)

router.register(
    "shift-assignments",
    ShiftAssignmentViewSet,
    basename="hr-shift-assignment",
)

router.register(
    "attendance",
    AttendanceViewSet,
    basename="hr-attendance",
)

router.register(
    "leave-types",
    LeaveTypeViewSet,
    basename="hr-leave-type",
)

router.register(
    "leave-balances",
    LeaveBalanceViewSet,
    basename="hr-leave-balance",
)

router.register(
    "leave-requests",
    LeaveRequestViewSet,
    basename="hr-leave-request",
)

router.register(
    "departments",
    DepartmentViewSet,
    basename="hr-department",
)


urlpatterns = [
    path("dashboard/", hr_dashboard, name="hr-dashboard"),
    path("", include(router.urls)),
]
