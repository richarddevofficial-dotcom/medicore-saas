from django.contrib import admin
from django.utils.html import format_html
from expenses.models import (
    ExpenseCategory, Expense, ExpenseApprovalLog,
    ExpenseBudget, ExpensePayment
)


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'hospital', 'budget_limit', 'is_active')
    list_filter = ('is_active', 'hospital')
    search_fields = ('code', 'name', 'hospital__name')
    fieldsets = (
        ('Basic Information', {
            'fields': ('hospital', 'code', 'name', 'description', 'is_active')
        }),
        ('Budget', {
            'fields': ('budget_limit',)
        }),
    )


class ExpenseApprovalLogInline(admin.TabularInline):
    model = ExpenseApprovalLog
    extra = 0
    fields = ('action', 'approved_by', 'comments', 'created_at')
    readonly_fields = ('action', 'approved_by', 'comments', 'created_at')
    can_delete = False


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('expense_date', 'category', 'amount', 'status', 'status_badge', 'vendor_name')
    list_filter = ('status', 'category', 'expense_date', 'hospital')
    search_fields = ('description', 'vendor_name', 'invoice_number')
    date_hierarchy = 'expense_date'
    
    readonly_fields = ('submitted_by', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('hospital', 'category', 'department', 'expense_date', 'description')
        }),
        ('Vendor & Invoice', {
            'fields': ('vendor_name', 'invoice_number', 'bill_attachment')
        }),
        ('Amount', {
            'fields': ('amount',)
        }),
        ('Submission', {
            'fields': ('submitted_by', 'notes', 'created_at', 'updated_at')
        }),
        ('Approval', {
            'fields': ('status', 'approved_by', 'approval_date', 'approval_notes'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [ExpenseApprovalLogInline]
    
    def status_badge(self, obj):
        colors = {
            'draft': '#808080',
            'submitted': '#0066cc',
            'approved': '#009900',
            'rejected': '#ff0000',
            'paid': '#00cc00'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            colors.get(obj.status, '#808080'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(ExpenseApprovalLog)
class ExpenseApprovalLogAdmin(admin.ModelAdmin):
    list_display = ('expense', 'action', 'approved_by', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('expense__description', 'approved_by__username')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'expense', 'action', 'approved_by', 'comments')


@admin.register(ExpenseBudget)
class ExpenseBudgetAdmin(admin.ModelAdmin):
    list_display = ('month', 'category', 'budgeted_amount', 'spent_display', 'remaining_display', 'status_badge')
    list_filter = ('month', 'category', 'hospital')
    search_fields = ('category__name', 'hospital__name')
    date_hierarchy = 'month'
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('hospital', 'category', 'department', 'month')
        }),
        ('Budget Amount', {
            'fields': ('budgeted_amount',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def spent_display(self, obj):
        spent = obj.get_spent_amount()
        return f"₹{spent:.2f}"
    spent_display.short_description = 'Spent'
    
    def remaining_display(self, obj):
        remaining = obj.get_remaining_budget()
        color = 'green' if remaining >= 0 else 'red'
        return format_html(
            '<span style="color: {};">₹{}</span>',
            color,
            f'{remaining:.2f}'
        )
    remaining_display.short_description = 'Remaining'
    
    def status_badge(self, obj):
        if obj.is_exceeded():
            color = '#ff0000'
            label = 'Exceeded'
        elif obj.get_remaining_budget() < (obj.budgeted_amount * 0.2):
            color = '#ff9900'
            label = 'Low Budget'
        else:
            color = '#00cc00'
            label = 'OK'
        
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color,
            label
        )
    status_badge.short_description = 'Budget Status'


@admin.register(ExpensePayment)
class ExpensePaymentAdmin(admin.ModelAdmin):
    list_display = ('expense', 'payment_date', 'payment_method', 'status')
    list_filter = ('status', 'payment_method', 'payment_date')
    search_fields = ('reference_number', 'expense__description')
    date_hierarchy = 'payment_date'
    
    fieldsets = (
        ('Expense', {
            'fields': ('expense',)
        }),
        ('Payment Details', {
            'fields': ('payment_date', 'payment_method', 'reference_number', 'status')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
    )
