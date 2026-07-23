from django.contrib import admin
from django.utils.html import format_html
from decimal import Decimal
from budgets.models import (
    BudgetYear, BudgetTemplate, BudgetAllocation,
    BudgetVariance, BudgetRevision, BudgetForecast,
    BudgetAlert
)


def format_currency(amount):
    """Format amount as SSP currency"""
    if amount is None or amount == 0:
        return 'SSP 0.00'
    return f"SSP {amount:,.2f}"


@admin.register(BudgetYear)
class BudgetYearAdmin(admin.ModelAdmin):
    list_display = ('year', 'hospital', 'start_date', 'end_date', 'formatted_total_budget', 'is_active', 'is_locked')
    list_filter = ('is_active', 'is_locked', 'year')
    search_fields = ('hospital__name', 'year')
    date_hierarchy = 'start_date'
    fieldsets = (
        ('Basic Information', {
            'fields': ('hospital', 'year', 'total_budget')
        }),
        ('Dates', {
            'fields': ('start_date', 'end_date')
        }),
        ('Status', {
            'fields': ('is_active', 'is_locked')
        }),
    )
    
    def formatted_total_budget(self, obj):
        return format_currency(obj.total_budget)
    formatted_total_budget.short_description = 'Total Budget'


@admin.register(BudgetTemplate)
class BudgetTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'hospital', 'allocation_type', 'is_active')
    list_filter = ('allocation_type', 'is_active', 'hospital')
    search_fields = ('name', 'hospital__name')
    fieldsets = (
        ('Basic Information', {
            'fields': ('hospital', 'name', 'description', 'allocation_type', 'is_active')
        }),
    )


@admin.register(BudgetAllocation)
class BudgetAllocationAdmin(admin.ModelAdmin):
    list_display = ('budget_year', 'department', 'formatted_allocated_amount', 'status', 'status_badge', 'period_start')
    list_filter = ('status', 'period_type', 'budget_year')
    search_fields = ('department__name', 'budget_year__year')
    date_hierarchy = 'period_start'
    readonly_fields = ('submitted_by', 'approved_by', 'approved_date')
    
    fieldsets = (
        ('Budget Information', {
            'fields': ('budget_year', 'department', 'category', 'allocated_amount')
        }),
        ('Period', {
            'fields': ('period_type', 'period_start', 'period_end')
        }),
        ('Status & Approval', {
            'fields': ('status', 'submitted_by', 'approved_by', 'approved_date')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
    )
    
    def formatted_allocated_amount(self, obj):
        return format_currency(obj.allocated_amount)
    formatted_allocated_amount.short_description = 'Allocated Amount'
    
    def status_badge(self, obj):
        colors = {
            'draft': '#808080',
            'submitted': '#0066cc',
            'approved': '#009900',
            'rejected': '#ff0000',
            'active': '#00cc00'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            colors.get(obj.status, '#808080'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(BudgetVariance)
class BudgetVarianceAdmin(admin.ModelAdmin):
    list_display = ('allocation', 'formatted_actual_amount', 'formatted_variance_amount', 'variance_percentage')
    list_filter = ('created_at', 'allocation__budget_year')
    search_fields = ('allocation__department__name', 'analysis')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)
    
    fieldsets = (
        ('Budget Information', {
            'fields': ('allocation', 'actual_amount', 'variance_amount', 'variance_percentage')
        }),
        ('Analysis', {
            'fields': ('analysis', 'created_by')
        }),
        ('Metadata', {
            'fields': ('created_at',)
        }),
    )
    
    def formatted_actual_amount(self, obj):
        return format_currency(obj.actual_amount)
    formatted_actual_amount.short_description = 'Actual Amount'
    
    def formatted_variance_amount(self, obj):
        return format_currency(obj.variance_amount)
    formatted_variance_amount.short_description = 'Variance Amount'


@admin.register(BudgetRevision)
class BudgetRevisionAdmin(admin.ModelAdmin):
    list_display = ('allocation', 'formatted_original_amount', 'formatted_revised_amount', 'status', 'requested_date')
    list_filter = ('status', 'requested_date')
    search_fields = ('allocation__department__name', 'reason')
    date_hierarchy = 'requested_date'
    readonly_fields = ('requested_date', 'requested_by', 'approved_date')
    
    fieldsets = (
        ('Revision Details', {
            'fields': ('allocation', 'original_amount', 'revised_amount', 'reason')
        }),
        ('Request', {
            'fields': ('requested_by', 'requested_date')
        }),
        ('Approval', {
            'fields': ('status', 'approved_by', 'approved_date', 'approval_notes')
        }),
    )
    
    def formatted_original_amount(self, obj):
        return format_currency(obj.original_amount)
    formatted_original_amount.short_description = 'Original Amount'
    
    def formatted_revised_amount(self, obj):
        return format_currency(obj.revised_amount)
    formatted_revised_amount.short_description = 'Revised Amount'


@admin.register(BudgetForecast)
class BudgetForecastAdmin(admin.ModelAdmin):
    list_display = ('budget_year', 'department', 'month', 'formatted_forecasted_amount', 'confidence_level')
    list_filter = ('confidence_level', 'budget_year', 'month')
    search_fields = ('department__name', 'basis')
    date_hierarchy = 'month'
    readonly_fields = ('created_by',)
    
    fieldsets = (
        ('Forecast Details', {
            'fields': ('budget_year', 'department', 'category', 'month', 'forecasted_amount')
        }),
        ('Analysis', {
            'fields': ('confidence_level', 'basis', 'notes')
        }),
        ('Metadata', {
            'fields': ('created_by',)
        }),
    )
    
    def formatted_forecasted_amount(self, obj):
        return format_currency(obj.forecasted_amount)
    formatted_forecasted_amount.short_description = 'Forecasted Amount'


@admin.register(BudgetAlert)
class BudgetAlertAdmin(admin.ModelAdmin):
    list_display = ('allocation', 'title', 'severity_badge', 'status', 'triggered_at')
    list_filter = ('severity', 'status', 'triggered_at')
    search_fields = ('title', 'description', 'allocation__department__name')
    date_hierarchy = 'triggered_at'
    readonly_fields = ('triggered_at', 'acknowledged_at')
    
    fieldsets = (
        ('Alert Details', {
            'fields': ('allocation', 'title', 'description')
        }),
        ('Alert Status', {
            'fields': ('severity', 'status')
        }),
        ('Acknowledgment', {
            'fields': ('acknowledged_by', 'acknowledged_at')
        }),
        ('Metadata', {
            'fields': ('triggered_at',)
        }),
    )
    
    def severity_badge(self, obj):
        colors = {
            'info': '#0066cc',
            'warning': '#ff9900',
            'critical': '#ff0000'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            colors.get(obj.severity, '#808080'),
            obj.get_severity_display()
        )
    severity_badge.short_description = 'Severity'
