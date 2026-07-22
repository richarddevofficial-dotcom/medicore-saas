from rest_framework import serializers
from django.db import transaction
from django.db.models import Sum
from budgets.models import (
    BudgetYear, BudgetTemplate, BudgetAllocation,
    BudgetVariance, BudgetRevision, BudgetForecast,
    BudgetAlert
)


class BudgetYearSerializer(serializers.ModelSerializer):
    total_allocated = serializers.SerializerMethodField()
    
    class Meta:
        model = BudgetYear
        fields = ['id', 'year', 'start_date', 'end_date', 'total_budget', 'total_allocated', 'is_active', 'is_locked', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_total_allocated(self, obj):
        """Calculate total allocated across all departments"""
        total = obj.allocations.aggregate(Sum('allocated_amount'))['allocated_amount__sum'] or 0
        return total


class BudgetTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetTemplate
        fields = ['id', 'name', 'description', 'allocation_type', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class BudgetAllocationSerializer(serializers.ModelSerializer):
    """List/Create budget allocations"""
    department_name = serializers.CharField(source='department.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    actual_spent = serializers.SerializerMethodField()
    variance = serializers.SerializerMethodField()
    variance_percentage = serializers.SerializerMethodField()
    is_exceeded = serializers.SerializerMethodField()
    
    class Meta:
        model = BudgetAllocation
        fields = [
            'id', 'budget_year', 'department', 'department_name', 'category', 'category_name',
            'period_type', 'period_start', 'period_end', 'allocated_amount',
            'actual_spent', 'variance', 'variance_percentage', 'is_exceeded',
            'status', 'notes', 'submitted_by', 'approved_by', 'approved_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['submitted_by', 'approved_by', 'approved_date', 'created_at', 'updated_at']
    
    def get_actual_spent(self, obj):
        return obj.get_actual_spent()
    
    def get_variance(self, obj):
        return obj.get_variance()
    
    def get_variance_percentage(self, obj):
        return obj.get_variance_percentage()
    
    def get_is_exceeded(self, obj):
        return obj.is_exceeded()


class BudgetAllocationDetailSerializer(serializers.ModelSerializer):
    """Detailed view with variance analysis"""
    department_name = serializers.CharField(source='department.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    actual_spent = serializers.SerializerMethodField()
    variance = serializers.SerializerMethodField()
    variance_percentage = serializers.SerializerMethodField()
    is_exceeded = serializers.SerializerMethodField()
    submitted_by_name = serializers.CharField(source='submitted_by.get_full_name', read_only=True, allow_null=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = BudgetAllocation
        fields = [
            'id', 'budget_year', 'department', 'department_name', 'category', 'category_name',
            'period_type', 'period_start', 'period_end', 'allocated_amount',
            'actual_spent', 'variance', 'variance_percentage', 'is_exceeded',
            'status', 'notes', 'submitted_by', 'submitted_by_name', 'approved_by',
            'approved_by_name', 'approved_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['submitted_by', 'approved_by', 'approved_date', 'created_at', 'updated_at']
    
    def get_actual_spent(self, obj):
        return obj.get_actual_spent()
    
    def get_variance(self, obj):
        return obj.get_variance()
    
    def get_variance_percentage(self, obj):
        return obj.get_variance_percentage()
    
    def get_is_exceeded(self, obj):
        return obj.is_exceeded()


class BudgetVarianceSerializer(serializers.ModelSerializer):
    allocation_detail = BudgetAllocationSerializer(source='allocation', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = BudgetVariance
        fields = ['id', 'allocation', 'allocation_detail', 'actual_amount', 'variance_amount', 'variance_percentage', 'analysis', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['created_at']


class BudgetRevisionSerializer(serializers.ModelSerializer):
    """Budget revision request"""
    allocation_detail = BudgetAllocationSerializer(source='allocation', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = BudgetRevision
        fields = [
            'id', 'allocation', 'allocation_detail', 'original_amount', 'revised_amount',
            'reason', 'status', 'requested_by', 'requested_by_name', 'requested_date',
            'approved_by', 'approved_by_name', 'approved_date', 'approval_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['original_amount', 'requested_by', 'requested_date', 'approved_by', 'approved_date', 'created_at', 'updated_at']


class BudgetForecastSerializer(serializers.ModelSerializer):
    """Budget forecasting"""
    department_name = serializers.CharField(source='department.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = BudgetForecast
        fields = [
            'id', 'budget_year', 'department', 'department_name', 'category', 'category_name',
            'month', 'forecasted_amount', 'confidence_level', 'basis', 'notes',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class BudgetAlertSerializer(serializers.ModelSerializer):
    """Budget alerts"""
    allocation_detail = BudgetAllocationSerializer(source='allocation', read_only=True)
    acknowledged_by_name = serializers.CharField(source='acknowledged_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = BudgetAlert
        fields = [
            'id', 'allocation', 'allocation_detail', 'title', 'description',
            'severity', 'status', 'triggered_at', 'acknowledged_by',
            'acknowledged_by_name', 'acknowledged_at', 'created_at'
        ]
        read_only_fields = ['triggered_at', 'created_at']
