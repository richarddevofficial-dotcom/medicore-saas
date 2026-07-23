from rest_framework import serializers
from django.db import transaction
from finance.models import (
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
    AccountCategory,
    ChartOfAccount,
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

# ============================================================
# ACCOUNTING SERIALIZERS
# ============================================================


class AccountCategorySerializer(serializers.ModelSerializer):
    accounts_count = serializers.IntegerField(
        source="accounts.count",
        read_only=True,
    )

    class Meta:
        model = AccountCategory
        fields = [
            "id",
            "code",
            "name",
            "account_type",
            "normal_balance",
            "description",
            "is_active",
            "accounts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_at",
            "updated_at",
            "accounts_count",
        ]

    def validate(self, attrs):
        account_type = attrs.get(
            "account_type",
            getattr(self.instance, "account_type", None),
        )

        normal_balance = attrs.get(
            "normal_balance",
            getattr(self.instance, "normal_balance", None),
        )

        expected_balance = {
            "asset": "debit",
            "expense": "debit",
            "liability": "credit",
            "equity": "credit",
            "revenue": "credit",
        }

        if (
            account_type
            and normal_balance
            and expected_balance.get(account_type) != normal_balance
        ):
            raise serializers.ValidationError(
                {
                    "normal_balance": (
                        f"{account_type.title()} accounts normally have a "
                        f"{expected_balance[account_type]} balance."
                    )
                }
            )

        return attrs


class ChartOfAccountListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
    )

    category_code = serializers.CharField(
        source="category.code",
        read_only=True,
    )

    account_type = serializers.CharField(read_only=True)
    normal_balance = serializers.CharField(read_only=True)

    parent_name = serializers.CharField(
        source="parent.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = ChartOfAccount
        fields = [
            "id",
            "code",
            "name",
            "category",
            "category_code",
            "category_name",
            "account_type",
            "normal_balance",
            "parent",
            "parent_name",
            "opening_balance",
            "current_balance",
            "allow_manual_posting",
            "is_control_account",
            "is_active",
            "created_at",
            "updated_at",
        ]


class ChartOfAccountSerializer(serializers.ModelSerializer):
    category_details = AccountCategorySerializer(
        source="category",
        read_only=True,
    )

    parent_details = ChartOfAccountListSerializer(
        source="parent",
        read_only=True,
    )

    account_type = serializers.CharField(read_only=True)
    normal_balance = serializers.CharField(read_only=True)

    class Meta:
        model = ChartOfAccount
        fields = [
            "id",
            "code",
            "name",
            "description",
            "category",
            "category_details",
            "parent",
            "parent_details",
            "account_type",
            "normal_balance",
            "opening_balance",
            "current_balance",
            "allow_manual_posting",
            "is_control_account",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "current_balance",
            "account_type",
            "normal_balance",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        category = attrs.get(
            "category",
            getattr(self.instance, "category", None),
        )

        parent = attrs.get(
            "parent",
            getattr(self.instance, "parent", None),
        )

        hospital_id = None

        if user and user.is_authenticated:
            hospital = getattr(user, "hospital", None)

            if hospital:
                hospital_id = hospital.id
            elif hasattr(user, "employee"):
                hospital_id = getattr(
                    user.employee,
                    "hospital_id",
                    None,
                )

        if category and hospital_id:
            if category.hospital_id != hospital_id:
                raise serializers.ValidationError(
                    {
                        "category": (
                            "The selected category belongs to another hospital."
                        )
                    }
                )

        if parent and hospital_id:
            if parent.hospital_id != hospital_id:
                raise serializers.ValidationError(
                    {
                        "parent": (
                            "The parent account belongs to another hospital."
                        )
                    }
                )

        if parent and category:
            if parent.category.account_type != category.account_type:
                raise serializers.ValidationError(
                    {
                        "parent": (
                            "The parent account and child account must have "
                            "the same account type."
                        )
                    }
                )

        return attrs


# ============================================================
# JOURNAL SERIALIZERS
# ============================================================

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import (
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
)


class JournalEntryLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(
        source="account.code",
        read_only=True,
    )
    account_name = serializers.CharField(
        source="account.name",
        read_only=True,
    )

    class Meta:
        model = JournalEntryLine
        fields = [
            "id",
            "account",
            "account_code",
            "account_name",
            "description",
            "debit",
            "credit",
        ]

    def validate(self, attrs):
        debit = attrs.get(
            "debit",
            getattr(self.instance, "debit", Decimal("0.00")),
        )
        credit = attrs.get(
            "credit",
            getattr(self.instance, "credit", Decimal("0.00")),
        )

        if debit < Decimal("0.00"):
            raise serializers.ValidationError(
                {"debit": "Debit cannot be negative."}
            )

        if credit < Decimal("0.00"):
            raise serializers.ValidationError(
                {"credit": "Credit cannot be negative."}
            )

        if debit == Decimal("0.00") and credit == Decimal("0.00"):
            raise serializers.ValidationError(
                "Each line must have a debit or credit."
            )

        if debit > Decimal("0.00") and credit > Decimal("0.00"):
            raise serializers.ValidationError(
                "A line cannot have both debit and credit."
            )

        return attrs


class JournalEntryListSerializer(serializers.ModelSerializer):
    total_debit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        read_only=True,
    )
    total_credit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        read_only=True,
    )
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "journal_number",
            "entry_date",
            "entry_type",
            "reference",
            "description",
            "status",
            "source_module",
            "source_id",
            "total_debit",
            "total_credit",
            "created_by_name",
            "posted_at",
            "created_at",
        ]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None

        full_name = obj.created_by.get_full_name()
        return full_name or obj.created_by.get_username()


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalEntryLineSerializer(many=True)

    total_debit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        read_only=True,
    )
    total_credit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        read_only=True,
    )
    is_balanced = serializers.BooleanField(read_only=True)

    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "hospital",
            "journal_number",
            "entry_date",
            "entry_type",
            "reference",
            "description",
            "status",
            "source_module",
            "source_id",
            "created_by",
            "posted_by",
            "posted_at",
            "voided_by",
            "voided_at",
            "void_reason",
            "total_debit",
            "total_credit",
            "is_balanced",
            "lines",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "journal_number",
            "status",
            "created_by",
            "posted_by",
            "posted_at",
            "voided_by",
            "voided_at",
            "void_reason",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        lines = attrs.get("lines")

        if (
            self.instance
            and self.instance.status != JournalEntry.Status.DRAFT
        ):
            raise serializers.ValidationError(
                "Only draft journals can be edited."
            )

        if self.instance is None and not lines:
            raise serializers.ValidationError(
                {"lines": "At least two lines are required."}
            )

        if lines is not None:
            if len(lines) < 2:
                raise serializers.ValidationError(
                    {"lines": "At least two lines are required."}
                )

            total_debit = sum(
                (
                    line.get("debit", Decimal("0.00"))
                    for line in lines
                ),
                Decimal("0.00"),
            )

            total_credit = sum(
                (
                    line.get("credit", Decimal("0.00"))
                    for line in lines
                ),
                Decimal("0.00"),
            )

            if total_debit <= Decimal("0.00"):
                raise serializers.ValidationError(
                    {"lines": "Journal amount must be greater than zero."}
                )

            if total_debit != total_credit:
                raise serializers.ValidationError(
                    {
                        "lines": (
                            f"Journal is not balanced. "
                            f"Debit: {total_debit}, "
                            f"Credit: {total_credit}."
                        )
                    }
                )

        return attrs

    def validate_account_hospitals(self, hospital, lines):
        account_ids = [line["account"].id for line in lines]

        invalid_accounts = (
            ChartOfAccount.objects
            .filter(id__in=account_ids)
            .exclude(hospital=hospital)
        )

        if invalid_accounts.exists():
            raise serializers.ValidationError(
                {
                    "lines": (
                        "All accounts must belong to the same hospital."
                    )
                }
            )

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        request = self.context.get("request")

        validated_data["created_by"] = (
            request.user
            if request and request.user.is_authenticated
            else None
        )

        hospital = validated_data["hospital"]

        self.validate_account_hospitals(
            hospital,
            lines_data,
        )

        journal = JournalEntry.objects.create(
            **validated_data
        )

        for line_data in lines_data:
            JournalEntryLine.objects.create(
                journal_entry=journal,
                **line_data,
            )

        return journal

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.status != JournalEntry.Status.DRAFT:
            raise serializers.ValidationError(
                "Only draft journals can be edited."
            )

        lines_data = validated_data.pop("lines", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if lines_data is not None:
            self.validate_account_hospitals(
                instance.hospital,
                lines_data,
            )

            instance.lines.all().delete()

            for line_data in lines_data:
                JournalEntryLine.objects.create(
                    journal_entry=instance,
                    **line_data,
                )

        instance.save()
        return instance


class VoidJournalSerializer(serializers.Serializer):
    reason = serializers.CharField(
        min_length=3,
        max_length=1000,
    )
