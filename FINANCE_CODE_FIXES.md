# Finance Module - Recommended Code Fixes

**Priority**: 🔴 HIGH - Standardize architecture to match HR module pattern  
**Estimated Time**: 2-3 hours  
**Risk**: LOW - These are refactoring changes, no functional changes

---

## Fix #1: Replace Custom ViewSet Base Class

### File: `backend/finance/accounting_views.py`

**Current Code (Lines 210-248)**:

```python
class HospitalScopedAccountingViewSet(viewsets.ModelViewSet):
    """
    Base ViewSet for hospital-owned accounting records.
    """

    permission_classes = (
        IsAuthenticated,
        IsFinanceUser,
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_hospital_scope(queryset, self.request)

    def perform_create(self, serializer):
        hospital = serializer.validated_data.get("hospital")

        if hospital is not None:
            validate_requested_hospital(
                self.request,
                hospital,
            )

        serializer.save()

    def perform_update(self, serializer):
        hospital = serializer.validated_data.get(
            "hospital",
            getattr(serializer.instance, "hospital", None),
        )

        if hospital is not None:
            validate_requested_hospital(
                self.request,
                hospital,
            )

        serializer.save()
```

**Replacement Code**:

```python
from human_resources.views import HospitalScopedViewSet

class FinanceScopedViewSet(HospitalScopedViewSet):
    """
    Finance module ViewSet with finance-specific permissions.
    Inherits hospital scoping from HR module.
    """
    permission_classes = (
        IsAuthenticated,
        IsFinanceUser,
    )

    def perform_create(self, serializer):
        hospital = serializer.validated_data.get("hospital")

        if hospital is not None:
            validate_requested_hospital(
                self.request,
                hospital,
            )

        serializer.save()

    def perform_update(self, serializer):
        hospital = serializer.validated_data.get(
            "hospital",
            getattr(serializer.instance, "hospital", None),
        )

        if hospital is not None:
            validate_requested_hospital(
                self.request,
                hospital,
            )

        serializer.save()
```

**Then update ViewSet registrations**:

```python
class AccountCategoryViewSet(FinanceScopedViewSet):  # Changed from HospitalScopedAccountingViewSet
    serializer_class = AccountCategorySerializer
    queryset = AccountCategory.objects.all().order_by("account_type", "code")
    # ... rest unchanged

class ChartOfAccountViewSet(FinanceScopedViewSet):  # Changed
    serializer_class = ChartOfAccountSerializer
    # ... rest unchanged

class JournalEntryViewSet(FinanceScopedViewSet):  # Changed
    # ... rest unchanged
```

**Benefits**:

- ✅ Uses standard HR ViewSet base
- ✅ Keeps finance-specific permissions
- ✅ Single source of truth for hospital scoping

---

## Fix #2: Remove Duplicate Hospital Resolution Logic

### File: `backend/finance/accounting_views.py`

**Current Code (Lines 45-80)** - DELETE:

```python
def get_request_hospital(request):
    """
    Resolve the active hospital from common MediCore request/user patterns.
    """
    request_hospital = getattr(request, "hospital", None)
    if request_hospital is not None:
        return request_hospital

    user = request.user
    user_hospital = getattr(user, "hospital", None)
    if user_hospital is not None:
        return user_hospital

    profile = getattr(user, "profile", None)
    if profile is not None:
        profile_hospital = getattr(profile, "hospital", None)
        if profile_hospital is not None:
            return profile_hospital

    employee = getattr(user, "employee", None)
    if employee is not None:
        employee_hospital = getattr(employee, "hospital", None)
        if employee_hospital is not None:
            return employee_hospital

    return None


def apply_hospital_scope(queryset, request):
    """
    Restrict ordinary users to their assigned hospital.
    Superusers may optionally filter using ?hospital=<uuid-or-id>.
    """
    hospital_param = request.query_params.get("hospital")
    user = request.user

    if user.is_superuser:
        if hospital_param:
            return queryset.filter(hospital_id=hospital_param)
        return queryset

    hospital = get_request_hospital(request)
    if hospital is None:
        return queryset.none()

    return queryset.filter(hospital=hospital)
```

**Replacement Code** - ADD THIS IMPORT:

```python
from human_resources.permissions import get_user_hospital_id
```

**Keep only these helper functions**:

```python
def validate_requested_hospital(request, hospital):
    """
    Prevent users from submitting records for another hospital.
    Finance-specific validation.
    """
    if request.user.is_superuser:
        return

    hospital_id = get_user_hospital_id(request.user)

    if hospital_id is None:
        raise PermissionDenied(
            "Your account is not assigned to a hospital."
        )

    if hospital_id != hospital.id:
        raise PermissionDenied(
            "You cannot create finance records for another hospital."
        )
```

**Benefits**:

- ✅ Eliminates 50 lines of duplicate code
- ✅ Uses single source of truth (HR module)
- ✅ Consistent hospital resolution logic

---

## Fix #3: Add Payroll Models to Admin

### File: `backend/finance/admin.py`

**Add These Registrations** (after existing accounting registrations):

```python
# ============== PAYROLL MODELS ==============

@admin.register(PayrollYear)
class PayrollYearAdmin(admin.ModelAdmin):
    list_display = (
        "year",
        "hospital",
        "start_date",
        "end_date",
        "is_active",
    )
    list_filter = (
        "is_active",
        "hospital",
        "year",
    )
    search_fields = (
        "year",
    )
    ordering = (
        "-year",
    )


@admin.register(AllowanceType)
class AllowanceTypeAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "hospital",
        "is_active",
    )
    list_filter = (
        "is_active",
        "hospital",
    )
    search_fields = (
        "code",
        "name",
    )
    ordering = (
        "hospital",
        "code",
    )


@admin.register(DeductionType)
class DeductionTypeAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "is_mandatory",
        "hospital",
        "is_active",
    )
    list_filter = (
        "is_active",
        "is_mandatory",
        "hospital",
    )
    search_fields = (
        "code",
        "name",
    )
    ordering = (
        "hospital",
        "code",
    )


class SalaryStructureAllowanceInline(admin.TabularInline):
    model = SalaryStructureAllowance
    extra = 1
    fields = (
        "allowance_type",
        "amount",
        "is_percentage",
    )


class SalaryStructureDeductionInline(admin.TabularInline):
    model = SalaryStructureDeduction
    extra = 1
    fields = (
        "deduction_type",
        "amount",
        "is_percentage",
    )


@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "hospital",
        "base_salary",
        "is_active",
    )
    list_filter = (
        "is_active",
        "hospital",
    )
    search_fields = (
        "name",
    )
    ordering = (
        "hospital",
        "name",
    )
    inlines = [
        SalaryStructureAllowanceInline,
        SalaryStructureDeductionInline,
    ]


@admin.register(EmployeeSalary)
class EmployeeSalaryAdmin(admin.ModelAdmin):
    list_display = (
        "get_employee_name",
        "hospital",
        "salary_structure",
        "effective_date",
    )
    list_filter = (
        "hospital",
        "effective_date",
    )
    search_fields = (
        "employee__user__first_name",
        "employee__user__last_name",
    )
    ordering = (
        "-effective_date",
    )

    def get_employee_name(self, obj):
        return f"{obj.employee.user.first_name} {obj.employee.user.last_name}"
    get_employee_name.short_description = "Employee"


class SalarySlipEarningInline(admin.TabularInline):
    model = SalarySlipEarning
    extra = 0
    fields = (
        "allowance_type",
        "amount",
    )
    readonly_fields = (
        "allowance_type",
        "amount",
    )
    can_delete = False


class SalarySlipDeductionInline(admin.TabularInline):
    model = SalarySlipDeduction
    extra = 0
    fields = (
        "deduction_type",
        "amount",
    )
    readonly_fields = (
        "deduction_type",
        "amount",
    )
    can_delete = False


@admin.register(SalarySlip)
class SalarySlipAdmin(admin.ModelAdmin):
    list_display = (
        "get_employee_name",
        "month",
        "hospital",
        "status",
        "net_salary",
    )
    list_filter = (
        "status",
        "month",
        "hospital",
    )
    search_fields = (
        "employee__user__first_name",
        "employee__user__last_name",
    )
    ordering = (
        "-month",
    )
    inlines = [
        SalarySlipEarningInline,
        SalarySlipDeductionInline,
    ]
    readonly_fields = (
        "employee",
        "month",
        "gross_salary",
        "total_deductions",
        "net_salary",
    )

    def get_employee_name(self, obj):
        return f"{obj.employee.user.first_name} {obj.employee.user.last_name}"
    get_employee_name.short_description = "Employee"


@admin.register(SalaryPayment)
class SalaryPaymentAdmin(admin.ModelAdmin):
    list_display = (
        "payment_date",
        "hospital",
        "get_employee_name",
        "amount",
        "payment_method",
        "status",
    )
    list_filter = (
        "status",
        "payment_method",
        "payment_date",
        "hospital",
    )
    search_fields = (
        "salary_slip__employee__user__first_name",
        "salary_slip__employee__user__last_name",
        "payment_reference",
    )
    ordering = (
        "-payment_date",
    )
    readonly_fields = (
        "payment_date",
        "amount",
    )

    def get_employee_name(self, obj):
        return f"{obj.salary_slip.employee.user.first_name} {obj.salary_slip.employee.user.last_name}"
    get_employee_name.short_description = "Employee"
```

**Add these imports at top of file**:

```python
from .models import (
    AccountCategory,
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
    JournalSequence,
    # Payroll models
    PayrollYear,
    AllowanceType,
    DeductionType,
    SalaryStructure,
    SalaryStructureAllowance,
    SalaryStructureDeduction,
    EmployeeSalary,
    SalarySlip,
    SalarySlipEarning,
    SalarySlipDeduction,
    SalaryPayment,
)
```

**Benefits**:

- ✅ All payroll models accessible through Django admin
- ✅ Inlines for related objects (allowances, deductions, earnings)
- ✅ Easy data management and debugging

---

## Fix #4: Standardize Role Name Convention

### File: `backend/finance/accounting_permissions.py`

**Keep consistent with other modules using lowercase**:

```python
# Match the lowercase convention used in HR and IPD modules
FINANCE_ROLE_NAMES = {
    "admin",              # lowercase (matches IPD/other modules)
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
```

**Note**: This is already lowercase in current code ✅

---

## Implementation Checklist

```
[ ] Fix #1: Replace HospitalScopedAccountingViewSet
  [ ] Add import: from human_resources.views import HospitalScopedViewSet
  [ ] Create FinanceScopedViewSet class
  [ ] Update AccountCategoryViewSet inheritance
  [ ] Update ChartOfAccountViewSet inheritance
  [ ] Update JournalEntryViewSet inheritance
  [ ] Test accounting endpoints work

[ ] Fix #2: Remove duplicate hospital logic
  [ ] Delete get_request_hospital() function
  [ ] Delete apply_hospital_scope() function
  [ ] Add import: from human_resources.permissions import get_user_hospital_id
  [ ] Update validate_requested_hospital() to use get_user_hospital_id()
  [ ] Test that hospital scoping still works correctly

[ ] Fix #3: Add payroll admin registrations
  [ ] Add all imports for payroll models
  [ ] Register PayrollYear
  [ ] Register AllowanceType
  [ ] Register DeductionType
  [ ] Register SalaryStructure (with inlines)
  [ ] Register EmployeeSalary
  [ ] Register SalarySlip (with inlines)
  [ ] Register SalaryPayment
  [ ] Test all models appear in Django admin
  [ ] Test admin interface works correctly

[ ] Testing
  [ ] Run Django system check: python manage.py check
  [ ] Test accounting viewset endpoints
  [ ] Test payroll viewset endpoints
  [ ] Test hospital scoping (multitenancy)
  [ ] Test permissions (finance user vs finance manager)
  [ ] Test admin interface loads all models
```

---

## Testing Commands

After making changes:

```bash
# 1. Check for errors
python manage.py check

# 2. Test API endpoints
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/finance/accounting/accounts/

# 3. Test admin interface
# Visit http://localhost:8000/admin
# Check that Payroll Year, Allowance Type, Salary Structure, etc. appear

# 4. Run tests
python manage.py test finance

# 5. Run integration tests
python manage.py test finance.accounting_views
python manage.py test finance.views
```

---

## Migration Notes

**⚠️ IMPORTANT**: These are code changes only, no database migrations needed

- No model changes
- No field changes
- Only refactoring existing code
- Backwards compatible with existing API

---

## Estimated Impact

| Component          | Impact                        | Risk        |
| ------------------ | ----------------------------- | ----------- |
| Code Size          | -50 lines (duplicate removed) | ✅ LOW      |
| Performance        | No change                     | ✅ LOW      |
| API                | No change                     | ✅ LOW      |
| Functionality      | No change                     | ✅ LOW      |
| Maintainability    | ⬆️ Better                     | ✅ POSITIVE |
| Testing Complexity | ⬇️ Simpler                    | ✅ POSITIVE |

---

## Rollback Plan

If issues occur:

1. Revert changes from Git
2. No database rollback needed (code changes only)
3. Clear Django cache if needed: `python manage.py clear_cache`

---

**Report Generated**: July 23, 2026  
**Module**: Finance (Payroll + Accounting)  
**Fixes Required**: 4 major refactorings  
**Estimated Duration**: 2-3 hours  
**Testing**: 1 hour
