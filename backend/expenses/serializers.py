from rest_framework import serializers
from django.db import transaction
from django.db.models import Sum
from expenses.models import (
    ExpenseCategory, Expense, ExpenseApprovalLog,
    ExpenseBudget, ExpensePayment
)


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ['id', 'code', 'name', 'description', 'is_active', 'budget_limit', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class ExpenseApprovalLogSerializer(serializers.ModelSerializer):
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    
    class Meta:
        model = ExpenseApprovalLog
        fields = ['id', 'action', 'approved_by', 'approved_by_name', 'comments', 'created_at']
        read_only_fields = ['created_at']


class ExpensePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpensePayment
        fields = ['id', 'payment_date', 'payment_method', 'reference_number', 'status', 'notes']


class ExpenseSerializer(serializers.ModelSerializer):
    """List/Create expense"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = Expense
        fields = [
            'id', 'category', 'category_name', 'department', 'submitted_by', 'submitted_by_name',
            'description', 'amount', 'expense_date', 'vendor_name', 'invoice_number',
            'status', 'notes', 'approved_by', 'approved_by_name', 'approval_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['submitted_by', 'approved_by', 'approval_date', 'created_at', 'updated_at']


class ExpenseDetailSerializer(serializers.ModelSerializer):
    """Detailed expense view with approval logs and payment"""
    category = ExpenseCategorySerializer(read_only=True)
    approval_logs = ExpenseApprovalLogSerializer(many=True, read_only=True)
    payment = ExpensePaymentSerializer(read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = Expense
        fields = [
            'id', 'hospital', 'category', 'department', 'submitted_by', 'submitted_by_name',
            'description', 'amount', 'expense_date', 'vendor_name', 'invoice_number',
            'bill_attachment', 'status', 'notes', 'approved_by', 'approved_by_name',
            'approval_date', 'approval_notes', 'approval_logs', 'payment',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['hospital', 'submitted_by', 'approved_by', 'approval_date', 'created_at', 'updated_at']


class ExpenseBudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    spent_amount = serializers.SerializerMethodField()
    remaining_budget = serializers.SerializerMethodField()
    is_exceeded = serializers.SerializerMethodField()
    spent_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = ExpenseBudget
        fields = [
            'id', 'category', 'category_name', 'department', 'department_name',
            'month', 'budgeted_amount', 'spent_amount', 'remaining_budget',
            'spent_percentage', 'is_exceeded', 'created_at', 'updated_at'
        ]
        read_only_fields = ['spent_amount', 'remaining_budget', 'spent_percentage', 'is_exceeded', 'created_at', 'updated_at']
    
    def get_spent_amount(self, obj):
        return obj.get_spent_amount()
    
    def get_remaining_budget(self, obj):
        return obj.get_remaining_budget()
    
    def get_is_exceeded(self, obj):
        return obj.is_exceeded()
    
    def get_spent_percentage(self, obj):
        """Calculate spent percentage"""
        if obj.budgeted_amount == 0:
            return 0
        spent = obj.get_spent_amount()
        return (spent / obj.budgeted_amount) * 100


class ExpenseBudgetDetailSerializer(serializers.ModelSerializer):
    """Detailed budget view with expense breakdown"""
    category = ExpenseCategorySerializer(read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    spent_amount = serializers.SerializerMethodField()
    remaining_budget = serializers.SerializerMethodField()
    is_exceeded = serializers.SerializerMethodField()
    spent_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = ExpenseBudget
        fields = [
            'id', 'category', 'department', 'department_name',
            'month', 'budgeted_amount', 'spent_amount', 'remaining_budget',
            'spent_percentage', 'is_exceeded', 'created_at', 'updated_at'
        ]
        read_only_fields = ['spent_amount', 'remaining_budget', 'spent_percentage', 'is_exceeded', 'created_at', 'updated_at']
    
    def get_spent_amount(self, obj):
        return obj.get_spent_amount()
    
    def get_remaining_budget(self, obj):
        return obj.get_remaining_budget()
    
    def get_is_exceeded(self, obj):
        return obj.is_exceeded()
    
    def get_spent_percentage(self, obj):
        if obj.budgeted_amount == 0:
            return 0
        spent = obj.get_spent_amount()
        return (spent / obj.budgeted_amount) * 100
