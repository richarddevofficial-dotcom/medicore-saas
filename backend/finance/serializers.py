from rest_framework import serializers
from django.db import transaction
from finance.models import (
    PayrollYear, AllowanceType, DeductionType,
    SalaryStructure, SalaryStructureAllowance, SalaryStructureDeduction,
    EmployeeSalary, SalarySlip, SalarySlipEarning, SalarySlipDeduction,
    SalaryPayment
)


class AllowanceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowanceType
        fields = ['id', 'code', 'name', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class DeductionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeductionType
        fields = ['id', 'code', 'name', 'description', 'is_mandatory', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class SalaryStructureAllowanceSerializer(serializers.ModelSerializer):
    allowance_type = AllowanceTypeSerializer(read_only=True)
    allowance_type_id = serializers.PrimaryKeyRelatedField(
        queryset=AllowanceType.objects.all(),
        write_only=True,
        source='allowance_type'
    )
    
    class Meta:
        model = SalaryStructureAllowance
        fields = ['id', 'allowance_type', 'allowance_type_id', 'amount', 'is_percentage', 'created_at']
        read_only_fields = ['created_at']


class SalaryStructureDeductionSerializer(serializers.ModelSerializer):
    deduction_type = DeductionTypeSerializer(read_only=True)
    deduction_type_id = serializers.PrimaryKeyRelatedField(
        queryset=DeductionType.objects.all(),
        write_only=True,
        source='deduction_type'
    )
    
    class Meta:
        model = SalaryStructureDeduction
        fields = ['id', 'deduction_type', 'deduction_type_id', 'amount', 'is_percentage', 'created_at']
        read_only_fields = ['created_at']


class SalaryStructureSerializer(serializers.ModelSerializer):
    allowances = SalaryStructureAllowanceSerializer(many=True, read_only=True)
    deductions = SalaryStructureDeductionSerializer(many=True, read_only=True)
    total_allowances_amount = serializers.SerializerMethodField()
    total_deductions_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = SalaryStructure
        fields = [
            'id', 'name', 'description', 'base_salary', 'is_active',
            'allowances', 'deductions', 'total_allowances_amount', 'total_deductions_amount',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_total_allowances_amount(self, obj):
        """Calculate total allowances"""
        total = 0
        for allowance in obj.allowances.all():
            if allowance.is_percentage:
                total += (obj.base_salary * allowance.amount) / 100
            else:
                total += allowance.amount
        return total
    
    def get_total_deductions_amount(self, obj):
        """Calculate total deductions"""
        total = 0
        for deduction in obj.deductions.all():
            if deduction.is_percentage:
                total += (obj.base_salary * deduction.amount) / 100
            else:
                total += deduction.amount
        return total


class PayrollYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollYear
        fields = ['id', 'year', 'start_date', 'end_date', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class EmployeeSalarySerializer(serializers.ModelSerializer):
    salary_structure = SalaryStructureSerializer(read_only=True)
    salary_structure_id = serializers.PrimaryKeyRelatedField(
        queryset=SalaryStructure.objects.all(),
        write_only=True,
        source='salary_structure'
    )
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    
    class Meta:
        model = EmployeeSalary
        fields = [
            'id', 'employee', 'employee_name', 'salary_structure', 'salary_structure_id',
            'effective_from', 'effective_to', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class SalarySlipEarningSerializer(serializers.ModelSerializer):
    allowance_type = AllowanceTypeSerializer(read_only=True)
    allowance_type_id = serializers.PrimaryKeyRelatedField(
        queryset=AllowanceType.objects.all(),
        write_only=True,
        source='allowance_type'
    )
    
    class Meta:
        model = SalarySlipEarning
        fields = ['id', 'allowance_type', 'allowance_type_id', 'amount']


class SalarySlipDeductionSerializer(serializers.ModelSerializer):
    deduction_type = DeductionTypeSerializer(read_only=True)
    deduction_type_id = serializers.PrimaryKeyRelatedField(
        queryset=DeductionType.objects.all(),
        write_only=True,
        source='deduction_type'
    )
    
    class Meta:
        model = SalarySlipDeduction
        fields = ['id', 'deduction_type', 'deduction_type_id', 'amount']


class SalaryPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryPayment
        fields = ['id', 'salary_slip', 'payment_date', 'payment_method', 'reference_number', 'status', 'notes']


class SalarySlipDetailSerializer(serializers.ModelSerializer):
    """Detailed salary slip with earnings and deductions"""
    earnings = SalarySlipEarningSerializer(many=True, read_only=True)
    deductions = SalarySlipDeductionSerializer(many=True, read_only=True)
    payment = SalaryPaymentSerializer(read_only=True)
    salary_structure = SalaryStructureSerializer(read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    employee_id_number = serializers.CharField(source='employee.id_number', read_only=True)
    
    class Meta:
        model = SalarySlip
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_number', 'month',
            'salary_structure', 'base_salary', 'total_allowances', 'gross_salary',
            'total_deductions', 'net_salary', 'status', 'notes',
            'earnings', 'deductions', 'payment', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class SalarySlipSerializer(serializers.ModelSerializer):
    """List/create salary slip"""
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    
    class Meta:
        model = SalarySlip
        fields = [
            'id', 'employee', 'employee_name', 'month', 'salary_structure',
            'base_salary', 'total_allowances', 'gross_salary', 'total_deductions',
            'net_salary', 'status', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['base_salary', 'total_allowances', 'gross_salary', 'total_deductions', 'net_salary', 'created_at', 'updated_at']
    
    @transaction.atomic
    def create(self, validated_data):
        """Create salary slip with earnings and deductions"""
        employee = validated_data['employee']
        salary_structure = validated_data['salary_structure']
        
        # Calculate salary
        base_salary = salary_structure.base_salary
        total_allowances = 0
        total_deductions = 0
        
        # Create salary slip
        salary_slip = SalarySlip.objects.create(
            base_salary=base_salary,
            total_allowances=0,  # Will update below
            gross_salary=0,
            total_deductions=0,
            **validated_data
        )
        
        # Add allowances
        for structure_allowance in salary_structure.allowances.all():
            if structure_allowance.is_percentage:
                amount = (base_salary * structure_allowance.amount) / 100
            else:
                amount = structure_allowance.amount
            
            SalarySlipEarning.objects.create(
                salary_slip=salary_slip,
                allowance_type=structure_allowance.allowance_type,
                amount=amount
            )
            total_allowances += amount
        
        # Add deductions
        for structure_deduction in salary_structure.deductions.all():
            if structure_deduction.is_percentage:
                amount = (base_salary * structure_deduction.amount) / 100
            else:
                amount = structure_deduction.amount
            
            SalarySlipDeduction.objects.create(
                salary_slip=salary_slip,
                deduction_type=structure_deduction.deduction_type,
                amount=amount
            )
            total_deductions += amount
        
        # Update totals
        gross_salary = base_salary + total_allowances
        net_salary = gross_salary - total_deductions
        
        salary_slip.total_allowances = total_allowances
        salary_slip.gross_salary = gross_salary
        salary_slip.total_deductions = total_deductions
        salary_slip.net_salary = net_salary
        salary_slip.status = 'generated'
        salary_slip.save()
        
        return salary_slip
