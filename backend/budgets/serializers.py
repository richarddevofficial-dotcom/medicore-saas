from rest_framework import serializers
from django.db import transaction
from django.db.models import Sum
from human_resources.permissions import get_user_hospital_id
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


def validate_request_hospital(serializer, hospital_ids):
    hospital_ids = {hospital_id for hospital_id in hospital_ids if hospital_id}
    if len(hospital_ids) > 1:
        raise serializers.ValidationError(
            "All selected records must belong to the same hospital."
        )

    request = serializer.context.get('request')
    user = getattr(request, 'user', None)
    if user and user.is_authenticated and not user.is_superuser:
        user_hospital_id = get_user_hospital_id(user)
        if not user_hospital_id or hospital_ids != {user_hospital_id}:
            raise serializers.ValidationError(
                "The selected record belongs to another hospital."
            )


class BudgetYearSerializer(serializers.ModelSerializer):
    total_allocated = serializers.SerializerMethodField()
    formatted_total_budget = serializers.SerializerMethodField()
    formatted_total_allocated = serializers.SerializerMethodField()
    
    class Meta:
        model = BudgetYear
        fields = ['id', 'year', 'start_date', 'end_date', 'total_budget', 'formatted_total_budget', 'total_allocated', 'formatted_total_allocated', 'is_active', 'is_locked', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_total_allocated(self, obj):
        """Calculate total allocated across all departments"""
        total = obj.allocations.aggregate(Sum('allocated_amount'))['allocated_amount__sum'] or 0
        return total
    
    def get_formatted_total_budget(self, obj):
        return format_currency(obj.total_budget)
    
    def get_formatted_total_allocated(self, obj):
        total = self.get_total_allocated(obj)
        return format_currency(total)

    def validate(self, attrs):
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError(
                {'end_date': 'End date must be on or after start date.'}
            )
        if self.instance and self.instance.is_locked:
            changed_fields = set(attrs) - {'is_locked'}
            if changed_fields:
                raise serializers.ValidationError(
                    'Unlock this budget year before changing its details.'
                )
        return attrs


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
    formatted_allocated_amount = serializers.SerializerMethodField()
    formatted_actual_spent = serializers.SerializerMethodField()
    formatted_variance = serializers.SerializerMethodField()
    
    class Meta:
        model = BudgetAllocation
        fields = [
            'id', 'budget_year', 'department', 'department_name', 'category', 'category_name',
            'period_type', 'period_start', 'period_end', 'allocated_amount', 'formatted_allocated_amount',
            'actual_spent', 'formatted_actual_spent', 'variance', 'formatted_variance', 'variance_percentage', 'is_exceeded',
            'status', 'notes', 'submitted_by', 'approved_by', 'approved_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['status', 'submitted_by', 'approved_by', 'approved_date', 'created_at', 'updated_at']

    def validate(self, attrs):
        budget_year = attrs.get('budget_year', getattr(self.instance, 'budget_year', None))
        department = attrs.get('department', getattr(self.instance, 'department', None))
        category = attrs.get('category', getattr(self.instance, 'category', None))
        validate_request_hospital(
            self,
            [
                getattr(budget_year, 'hospital_id', None),
                getattr(department, 'hospital_id', None),
                getattr(category, 'hospital_id', None),
            ],
        )
        if budget_year and budget_year.is_locked:
            raise serializers.ValidationError(
                'Allocations cannot be changed in a locked budget year.'
            )
        if self.instance and self.instance.status != 'draft':
            raise serializers.ValidationError(
                'Only draft allocations can be edited.'
            )
        period_start = attrs.get('period_start', getattr(self.instance, 'period_start', None))
        period_end = attrs.get('period_end', getattr(self.instance, 'period_end', None))
        if period_start and period_end and period_start > period_end:
            raise serializers.ValidationError(
                {'period_end': 'Period end must be on or after period start.'}
            )
        if budget_year and period_start and period_end and (
            period_start < budget_year.start_date
            or period_end > budget_year.end_date
        ):
            raise serializers.ValidationError(
                'The allocation period must fall within its budget year.'
            )
        return attrs
    
    def get_actual_spent(self, obj):
        return obj.get_actual_spent()
    
    def get_variance(self, obj):
        return obj.get_variance()
    
    def get_variance_percentage(self, obj):
        return obj.get_variance_percentage()
    
    def get_is_exceeded(self, obj):
        return obj.is_exceeded()
    
    def get_formatted_allocated_amount(self, obj):
        return format_currency(obj.allocated_amount)
    
    def get_formatted_actual_spent(self, obj):
        return format_currency(obj.get_actual_spent())
    
    def get_formatted_variance(self, obj):
        return format_currency(obj.get_variance())


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
    formatted_allocated_amount = serializers.SerializerMethodField()
    formatted_actual_spent = serializers.SerializerMethodField()
    formatted_variance = serializers.SerializerMethodField()
    
    class Meta:
        model = BudgetAllocation
        fields = [
            'id', 'budget_year', 'department', 'department_name', 'category', 'category_name',
            'period_type', 'period_start', 'period_end', 'allocated_amount', 'formatted_allocated_amount',
            'actual_spent', 'formatted_actual_spent', 'variance', 'formatted_variance', 'variance_percentage', 'is_exceeded',
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
    
    def get_formatted_allocated_amount(self, obj):
        return format_currency(obj.allocated_amount)
    
    def get_formatted_actual_spent(self, obj):
        return format_currency(obj.get_actual_spent())
    
    def get_formatted_variance(self, obj):
        return format_currency(obj.get_variance())


class BudgetVarianceSerializer(serializers.ModelSerializer):
    allocation_detail = BudgetAllocationSerializer(source='allocation', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    formatted_actual_amount = serializers.SerializerMethodField()
    formatted_variance_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = BudgetVariance
        fields = ['id', 'allocation', 'allocation_detail', 'actual_amount', 'formatted_actual_amount', 'variance_amount', 'formatted_variance_amount', 'variance_percentage', 'analysis', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['created_at']
    
    def get_formatted_actual_amount(self, obj):
        return format_currency(obj.actual_amount)
    
    def get_formatted_variance_amount(self, obj):
        return format_currency(obj.variance_amount)


class BudgetRevisionSerializer(serializers.ModelSerializer):
    """Budget revision request"""
    allocation_detail = BudgetAllocationSerializer(source='allocation', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    formatted_original_amount = serializers.SerializerMethodField()
    formatted_revised_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = BudgetRevision
        fields = [
            'id', 'allocation', 'allocation_detail', 'original_amount', 'formatted_original_amount', 'revised_amount', 'formatted_revised_amount',
            'reason', 'status', 'requested_by', 'requested_by_name', 'requested_date',
            'approved_by', 'approved_by_name', 'approved_date', 'approval_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['original_amount', 'status', 'requested_by', 'requested_date', 'approved_by', 'approved_date', 'created_at', 'updated_at']

    def validate(self, attrs):
        allocation = attrs.get('allocation', getattr(self.instance, 'allocation', None))
        if allocation:
            validate_request_hospital(
                self,
                [allocation.budget_year.hospital_id],
            )
            if allocation.budget_year.is_locked:
                raise serializers.ValidationError(
                    'Revisions cannot be changed in a locked budget year.'
                )
        if self.instance and self.instance.status != 'draft':
            raise serializers.ValidationError(
                'Only draft revisions can be edited.'
            )
        return attrs
    
    def get_formatted_original_amount(self, obj):
        return format_currency(obj.original_amount)
    
    def get_formatted_revised_amount(self, obj):
        return format_currency(obj.revised_amount)


class BudgetForecastSerializer(serializers.ModelSerializer):
    """Budget forecasting"""
    department_name = serializers.CharField(source='department.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    formatted_forecasted_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = BudgetForecast
        fields = [
            'id', 'budget_year', 'department', 'department_name', 'category', 'category_name',
            'month', 'forecasted_amount', 'formatted_forecasted_amount', 'confidence_level', 'basis', 'notes',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        budget_year = attrs.get('budget_year', getattr(self.instance, 'budget_year', None))
        department = attrs.get('department', getattr(self.instance, 'department', None))
        category = attrs.get('category', getattr(self.instance, 'category', None))
        validate_request_hospital(
            self,
            [
                getattr(budget_year, 'hospital_id', None),
                getattr(department, 'hospital_id', None),
                getattr(category, 'hospital_id', None),
            ],
        )
        if budget_year and budget_year.is_locked:
            raise serializers.ValidationError(
                'Forecasts cannot be changed in a locked budget year.'
            )
        month = attrs.get('month', getattr(self.instance, 'month', None))
        if budget_year and month and not (
            budget_year.start_date <= month <= budget_year.end_date
        ):
            raise serializers.ValidationError(
                {'month': 'Forecast month must fall within its budget year.'}
            )
        return attrs
    
    def get_formatted_forecasted_amount(self, obj):
        return format_currency(obj.forecasted_amount)


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
        read_only_fields = [
            'status', 'acknowledged_by', 'acknowledged_at',
            'triggered_at', 'created_at',
        ]

    def validate(self, attrs):
        allocation = attrs.get('allocation', getattr(self.instance, 'allocation', None))
        if allocation:
            validate_request_hospital(
                self,
                [allocation.budget_year.hospital_id],
            )
        return attrs
