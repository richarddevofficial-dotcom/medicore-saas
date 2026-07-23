from django.urls import include, path
from rest_framework.routers import DefaultRouter

from finance.views import (
    PayrollYearViewSet,
    AllowanceTypeViewSet,
    DeductionTypeViewSet,
    SalaryStructureViewSet,
    EmployeeSalaryViewSet,
    SalarySlipViewSet,
    SalaryPaymentViewSet,
)

router = DefaultRouter()

router.register(
    r'payroll-years',
    PayrollYearViewSet,
    basename='payroll-year'
)

router.register(
    r'allowance-types',
    AllowanceTypeViewSet,
    basename='allowance-type'
)

router.register(
    r'deduction-types',
    DeductionTypeViewSet,
    basename='deduction-type'
)

router.register(
    r'salary-structures',
    SalaryStructureViewSet,
    basename='salary-structure'
)

router.register(
    r'employee-salaries',
    EmployeeSalaryViewSet,
    basename='employee-salary'
)

router.register(
    r'salary-slips',
    SalarySlipViewSet,
    basename='salary-slip'
)

router.register(
    r'salary-payments',
    SalaryPaymentViewSet,
    basename='salary-payment'
)

urlpatterns = [
    path("", include(router.urls)),

    # Accounting API
    path(
        "accounting/",
        include("finance.accounting_urls"),
    ),
]
