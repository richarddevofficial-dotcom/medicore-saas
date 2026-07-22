from django.contrib import admin
from django.utils.html import format_html
from finance.models import (
    PayrollYear, AllowanceType, DeductionType,
    SalaryStructure, SalaryStructureAllowance, SalaryStructureDeduction,
    EmployeeSalary, SalarySlip, SalarySlipEarning, SalarySlipDeduction,
    SalaryPayment
)


@admin.register(PayrollYear)
class PayrollYearAdmin(admin.ModelAdmin):
    list_display = ('year', 'hospital', 'start_date', 'end_date', 'is_active')
    list_filter = ('is_active', 'year')
    search_fields = ('hospital__name', 'year')
    date_hierarchy = 'start_date'
    fieldsets = (
        ('Basic Information', {
            'fields': ('hospital', 'year', 'is_active')
        }),
        ('Dates', {
            'fields': ('start_date', 'end_date')
        }),
    )


@admin.register(AllowanceType)
class AllowanceTypeAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'hospital', 'is_active')
    list_filter = ('is_active', 'hospital')
    search_fields = ('code', 'name', 'hospital__name')
    fieldsets = (
        ('Basic Information', {
            'fields': ('hospital', 'code', 'name', 'description', 'is_active')
        }),
    )


@admin.register(DeductionType)
class DeductionTypeAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'hospital', 'is_mandatory', 'is_active')
    list_filter = ('is_mandatory', 'is_active', 'hospital')
    search_fields = ('code', 'name', 'hospital__name')
    fieldsets = (
        ('Basic Information', {
            'fields': ('hospital', 'code', 'name', 'description', 'is_mandatory', 'is_active')
        }),
    )


class SalaryStructureAllowanceInline(admin.TabularInline):
    model = SalaryStructureAllowance
    extra = 1
    fields = ('allowance_type', 'amount', 'is_percentage')


class SalaryStructureDeductionInline(admin.TabularInline):
    model = SalaryStructureDeduction
    extra = 1
    fields = ('deduction_type', 'amount', 'is_percentage')


@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    list_display = ('name', 'hospital', 'base_salary', 'is_active', 'total_deductions_display')
    list_filter = ('is_active', 'hospital')
    search_fields = ('name', 'hospital__name')
    fieldsets = (
        ('Basic Information', {
            'fields': ('hospital', 'name', 'description', 'base_salary', 'is_active')
        }),
    )
    inlines = [SalaryStructureAllowanceInline, SalaryStructureDeductionInline]
    
    def total_deductions_display(self, obj):
        total = 0
        for deduction in obj.deductions.all():
            if deduction.is_percentage:
                total += (obj.base_salary * deduction.amount) / 100
            else:
                total += deduction.amount
        return f"₹{total:.2f}"
    total_deductions_display.short_description = 'Total Deductions'


@admin.register(EmployeeSalary)
class EmployeeSalaryAdmin(admin.ModelAdmin):
    list_display = ('employee', 'salary_structure', 'effective_from', 'effective_to')
    list_filter = ('salary_structure', 'effective_from')
    search_fields = ('employee__user__first_name', 'employee__user__last_name', 'employee__id_number')
    date_hierarchy = 'effective_from'
    fieldsets = (
        ('Employee & Structure', {
            'fields': ('employee', 'salary_structure')
        }),
        ('Validity', {
            'fields': ('effective_from', 'effective_to')
        }),
    )


class SalarySlipEarningInline(admin.TabularInline):
    model = SalarySlipEarning
    extra = 0
    fields = ('allowance_type', 'amount')
    readonly_fields = ('allowance_type', 'amount')
    can_delete = False


class SalarySlipDeductionInline(admin.TabularInline):
    model = SalarySlipDeduction
    extra = 0
    fields = ('deduction_type', 'amount')
    readonly_fields = ('deduction_type', 'amount')
    can_delete = False


@admin.register(SalarySlip)
class SalarySlipAdmin(admin.ModelAdmin):
    list_display = ('employee', 'month', 'gross_salary', 'status', 'status_badge')
    list_filter = ('status', 'month')
    search_fields = ('employee__user__first_name', 'employee__user__last_name', 'employee__id_number')
    date_hierarchy = 'month'
    readonly_fields = ('base_salary', 'total_allowances', 'gross_salary', 'total_deductions', 'net_salary')
    
    fieldsets = (
        ('Employee Information', {
            'fields': ('employee', 'month', 'salary_structure')
        }),
        ('Earnings', {
            'fields': ('base_salary', 'total_allowances', 'gross_salary')
        }),
        ('Deductions', {
            'fields': ('total_deductions',)
        }),
        ('Net Salary', {
            'fields': ('net_salary',),
            'classes': ('wide',)
        }),
        ('Status', {
            'fields': ('status', 'notes')
        }),
    )
    
    inlines = [SalarySlipEarningInline, SalarySlipDeductionInline]
    
    def status_badge(self, obj):
        colors = {
            'draft': '#808080',
            'generated': '#0066cc',
            'approved': '#009900',
            'processed': '#ff9900',
            'paid': '#00cc00'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            colors.get(obj.status, '#808080'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(SalaryPayment)
class SalaryPaymentAdmin(admin.ModelAdmin):
    list_display = ('salary_slip', 'payment_date', 'payment_method', 'status')
    list_filter = ('status', 'payment_method', 'payment_date')
    search_fields = ('reference_number', 'salary_slip__employee__user__first_name')
    date_hierarchy = 'payment_date'
    fieldsets = (
        ('Salary Slip', {
            'fields': ('salary_slip',)
        }),
        ('Payment Details', {
            'fields': ('payment_date', 'payment_method', 'reference_number', 'status')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
    )
