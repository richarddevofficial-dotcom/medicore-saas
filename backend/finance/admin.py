from django.contrib import admin

from .models import (
    # Payroll Models
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
    # Accounting Models
    AccountCategory,
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
    JournalSequence,
)


@admin.register(AccountCategory)
class AccountCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "account_type",
        "hospital",
        "is_active",
    )
    list_filter = (
        "account_type",
        "is_active",
        "hospital",
    )
    search_fields = (
        "name",
        "code",
    )
    ordering = (
        "hospital",
        "account_type",
        "code",
    )


@admin.register(ChartOfAccount)
class ChartOfAccountAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "category",
        "hospital",
        "is_active",
        "allow_manual_posting",
    )
    list_filter = (
        "category",
        "is_active",
        "allow_manual_posting",
        "hospital",
    )
    search_fields = (
        "code",
        "name",
        "description",
    )
    ordering = (
        "hospital",
        "code",
    )


class JournalEntryLineInline(admin.TabularInline):
    model = JournalEntryLine
    extra = 2
    fields = (
        "account",
        "description",
        "debit",
        "credit",
    )


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = (
        "journal_number",
        "entry_date",
        "entry_type",
        "hospital",
        "status",
        "total_debit",
        "total_credit",
    )
    list_filter = (
        "status",
        "entry_type",
        "entry_date",
        "hospital",
    )
    search_fields = (
        "journal_number",
        "reference",
        "description",
        "source_module",
        "source_id",
    )
    readonly_fields = (
        "journal_number",
        "posted_by",
        "posted_at",
        "voided_by",
        "voided_at",
        "created_at",
        "updated_at",
    )
    ordering = (
        "-entry_date",
        "-created_at",
    )
    inlines = [
        JournalEntryLineInline,
    ]

    fieldsets = (
        (
            "Journal Information",
            {
                "fields": (
                    "hospital",
                    "journal_number",
                    "entry_date",
                    "entry_type",
                    "reference",
                    "description",
                    "status",
                )
            },
        ),
        (
            "Source Transaction",
            {
                "fields": (
                    "source_module",
                    "source_id",
                )
            },
        ),
        (
            "Posting Information",
            {
                "fields": (
                    "created_by",
                    "posted_by",
                    "posted_at",
                    "voided_by",
                    "voided_at",
                    "void_reason",
                )
            },
        ),
        (
            "Audit Information",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
                "classes": (
                    "collapse",
                ),
            },
        ),
    )


@admin.register(JournalEntryLine)
class JournalEntryLineAdmin(admin.ModelAdmin):
    list_display = (
        "journal_entry",
        "account",
        "debit",
        "credit",
    )
    list_filter = (
        "account",
        "journal_entry__status",
        "journal_entry__hospital",
    )
    search_fields = (
        "journal_entry__journal_number",
        "account__code",
        "account__name",
        "description",
    )


@admin.register(JournalSequence)
class JournalSequenceAdmin(admin.ModelAdmin):
    list_display = (
        "hospital",
        "year",
        "month",
        "last_number",
    )
    list_filter = (
        "year",
        "month",
        "hospital",
    )
    readonly_fields = (
        "hospital",
        "year",
        "month",
        "last_number",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ============================================================
# PAYROLL ADMIN CLASSES
# ============================================================


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
        "year",
        "is_active",
        "hospital",
    )
    search_fields = (
        "year",
    )
    ordering = (
        "-year",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
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
    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(DeductionType)
class DeductionTypeAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "hospital",
        "is_mandatory",
        "is_active",
    )
    list_filter = (
        "is_mandatory",
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
    readonly_fields = (
        "created_at",
        "updated_at",
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
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    inlines = [
        SalaryStructureAllowanceInline,
        SalaryStructureDeductionInline,
    ]


@admin.register(EmployeeSalary)
class EmployeeSalaryAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "salary_structure",
        "effective_from",
        "effective_to",
    )
    list_filter = (
        "salary_structure",
        "effective_from",
    )
    search_fields = (
        "employee__user__first_name",
        "employee__user__last_name",
        "employee__employee_id",
    )
    ordering = (
        "-effective_from",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )


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

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


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

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SalarySlip)
class SalarySlipAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "month",
        "salary_structure",
        "gross_salary",
        "net_salary",
        "status",
    )
    list_filter = (
        "status",
        "month",
        "salary_structure",
    )
    search_fields = (
        "employee__user__first_name",
        "employee__user__last_name",
        "employee__employee_id",
    )
    ordering = (
        "-month",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    inlines = [
        SalarySlipEarningInline,
        SalarySlipDeductionInline,
    ]
    fieldsets = (
        (
            "Employee Information",
            {
                "fields": (
                    "employee",
                    "month",
                    "salary_structure",
                )
            },
        ),
        (
            "Earnings",
            {
                "fields": (
                    "base_salary",
                    "total_allowances",
                    "gross_salary",
                )
            },
        ),
        (
            "Deductions",
            {
                "fields": (
                    "total_deductions",
                )
            },
        ),
        (
            "Net Salary",
            {
                "fields": (
                    "net_salary",
                )
            },
        ),
        (
            "Status",
            {
                "fields": (
                    "status",
                    "notes",
                )
            },
        ),
        (
            "Audit Information",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
                "classes": (
                    "collapse",
                ),
            },
        ),
    )


@admin.register(SalaryPayment)
class SalaryPaymentAdmin(admin.ModelAdmin):
    list_display = (
        "salary_slip",
        "payment_date",
        "payment_method",
        "status",
    )
    list_filter = (
        "status",
        "payment_date",
        "payment_method",
    )
    search_fields = (
        "salary_slip__employee__user__first_name",
        "salary_slip__employee__user__last_name",
        "reference_number",
    )
    ordering = (
        "-payment_date",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "Payment Information",
            {
                "fields": (
                    "salary_slip",
                    "payment_date",
                    "payment_method",
                    "reference_number",
                )
            },
        ),
        (
            "Status",
            {
                "fields": (
                    "status",
                    "notes",
                )
            },
        ),
        (
            "Audit Information",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
                "classes": (
                    "collapse",
                ),
            },
        ),
    )
