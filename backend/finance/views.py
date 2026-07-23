from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from datetime import datetime, timedelta
from django.utils import timezone

from human_resources.permissions import IsHRUser, IsHRManager
from human_resources.views import HospitalScopedViewSet
from django.db.models import Count, Sum
from finance.models import (
    PayrollYear,
    AllowanceType,
    DeductionType,
    SalaryStructure,
    EmployeeSalary,
    SalarySlip,
    SalaryPayment,
    AccountCategory,
    ChartOfAccount,
)
from finance.serializers import (
    PayrollYearSerializer,
    AllowanceTypeSerializer,
    DeductionTypeSerializer,
    SalaryStructureSerializer,
    EmployeeSalarySerializer,
    SalarySlipSerializer,
    SalarySlipDetailSerializer,
    SalaryPaymentSerializer,
    AccountCategorySerializer,
    ChartOfAccountSerializer,
    ChartOfAccountListSerializer,
)


class PayrollYearViewSet(HospitalScopedViewSet):
    """Manage payroll years"""
    queryset = PayrollYear.objects.all()
    serializer_class = PayrollYearSerializer
    permission_classes = [IsAuthenticated, IsHRManager]
    filterset_fields = ['year', 'is_active']
    search_fields = ['year']


class AllowanceTypeViewSet(HospitalScopedViewSet):
    """Manage allowance types"""
    queryset = AllowanceType.objects.all()
    serializer_class = AllowanceTypeSerializer
    permission_classes = [IsAuthenticated, IsHRUser]
    filterset_fields = ['code', 'is_active']
    search_fields = ['code', 'name']


class DeductionTypeViewSet(HospitalScopedViewSet):
    """Manage deduction types"""
    queryset = DeductionType.objects.all()
    serializer_class = DeductionTypeSerializer
    permission_classes = [IsAuthenticated, IsHRUser]
    filterset_fields = ['code', 'is_mandatory', 'is_active']
    search_fields = ['code', 'name']


class SalaryStructureViewSet(HospitalScopedViewSet):
    """Manage salary structures"""
    queryset = SalaryStructure.objects.all()
    serializer_class = SalaryStructureSerializer
    permission_classes = [IsAuthenticated, IsHRManager]
    filterset_fields = ['name', 'is_active']
    search_fields = ['name']
    
    @action(detail=True, methods=['get'])
    def calculate_salary(self, request, pk=None):
        """Calculate sample salary for this structure"""
        salary_structure = self.get_object()
        
        total_allowances = 0
        total_deductions = 0
        
        # Calculate allowances
        for allowance in salary_structure.allowances.all():
            if allowance.is_percentage:
                amount = (salary_structure.base_salary * allowance.amount) / 100
            else:
                amount = allowance.amount
            total_allowances += amount
        
        # Calculate deductions
        for deduction in salary_structure.deductions.all():
            if deduction.is_percentage:
                amount = (salary_structure.base_salary * deduction.amount) / 100
            else:
                amount = deduction.amount
            total_deductions += amount
        
        gross_salary = salary_structure.base_salary + total_allowances
        net_salary = gross_salary - total_deductions
        
        return Response({
            'base_salary': salary_structure.base_salary,
            'total_allowances': total_allowances,
            'gross_salary': gross_salary,
            'total_deductions': total_deductions,
            'net_salary': net_salary,
        })


class EmployeeSalaryViewSet(HospitalScopedViewSet):
    """Manage employee salary assignments"""
    queryset = EmployeeSalary.objects.all()
    serializer_class = EmployeeSalarySerializer
    permission_classes = [IsAuthenticated, IsHRManager]
    filterset_fields = ['employee', 'salary_structure']
    search_fields = ['employee__user__first_name', 'employee__user__last_name']


class SalarySlipViewSet(HospitalScopedViewSet):
    """Manage salary slips"""
    queryset = SalarySlip.objects.all()
    permission_classes = [IsAuthenticated, IsHRUser]
    filterset_fields = ['employee', 'status', 'month']
    search_fields = ['employee__user__first_name', 'employee__user__last_name']
    ordering_fields = ['-month', 'employee']
    ordering = ['-month']
    
    def get_serializer_class(self):
        """Use detail serializer for retrieve"""
        if self.action == 'retrieve':
            return SalarySlipDetailSerializer
        return SalarySlipSerializer
    
    def get_queryset(self):
        """Filter by hospital and optionally by user's own slips"""
        queryset = super().get_queryset()
        
        # HR users can only see their own slips
        if hasattr(self.request.user, 'employee') and not self.request.user.groups.filter(name__in=['hr_manager', 'hr_officer']).exists():
            queryset = queryset.filter(employee__user=self.request.user)
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def generate_bulk(self, request):
        """Generate salary slips for all employees in a month"""
        month = request.data.get('month')  # Format: YYYY-MM-01
        
        if not month:
            return Response({'error': 'month parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            month_date = datetime.strptime(month, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format, use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
        
        hospital_id = self.get_user_hospital_id()
        created_count = 0
        failed_count = 0
        
        with transaction.atomic():
            # Get all employees with salary structure
            from human_resources.models import Employee
            employees = Employee.objects.filter(
                hospital_id=hospital_id,
                salary__isnull=False
            )
            
            for employee in employees:
                try:
                    # Check if salary slip already exists
                    if SalarySlip.objects.filter(employee=employee, month=month_date).exists():
                        failed_count += 1
                        continue
                    
                    # Create salary slip
                    salary_structure = employee.salary.salary_structure
                    
                    # Calculate components
                    base_salary = salary_structure.base_salary
                    total_allowances = 0
                    total_deductions = 0
                    
                    # Create slip
                    salary_slip = SalarySlip.objects.create(
                        employee=employee,
                        month=month_date,
                        salary_structure=salary_structure,
                        base_salary=base_salary,
                        total_allowances=0,
                        gross_salary=0,
                        total_deductions=0,
                        net_salary=0,
                        status='generated'
                    )
                    
                    # Add earnings
                    for struct_allowance in salary_structure.allowances.all():
                        if struct_allowance.is_percentage:
                            amount = (base_salary * struct_allowance.amount) / 100
                        else:
                            amount = struct_allowance.amount
                        
                        from finance.models import SalarySlipEarning
                        SalarySlipEarning.objects.create(
                            salary_slip=salary_slip,
                            allowance_type=struct_allowance.allowance_type,
                            amount=amount
                        )
                        total_allowances += amount
                    
                    # Add deductions
                    for struct_deduction in salary_structure.deductions.all():
                        if struct_deduction.is_percentage:
                            amount = (base_salary * struct_deduction.amount) / 100
                        else:
                            amount = struct_deduction.amount
                        
                        from finance.models import SalarySlipDeduction
                        SalarySlipDeduction.objects.create(
                            salary_slip=salary_slip,
                            deduction_type=struct_deduction.deduction_type,
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
                    salary_slip.save()
                    
                    created_count += 1
                
                except Exception as e:
                    failed_count += 1
        
        return Response({
            'created': created_count,
            'failed': failed_count,
            'month': month
        })
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve salary slip"""
        salary_slip = self.get_object()
        
        if salary_slip.status not in ['generated']:
            return Response(
                {'error': 'Can only approve generated slips'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        salary_slip.status = 'approved'
        salary_slip.save()
        
        return Response(SalarySlipDetailSerializer(salary_slip).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject salary slip"""
        salary_slip = self.get_object()
        reason = request.data.get('reason', '')
        
        if salary_slip.status not in ['generated', 'approved']:
            return Response(
                {'error': 'Can only reject generated or approved slips'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        salary_slip.status = 'draft'
        salary_slip.notes = reason
        salary_slip.save()
        
        return Response(SalarySlipDetailSerializer(salary_slip).data)


class SalaryPaymentViewSet(HospitalScopedViewSet):
    """Manage salary payments"""
    queryset = SalaryPayment.objects.all()
    serializer_class = SalaryPaymentSerializer
    permission_classes = [IsAuthenticated, IsHRManager]
    filterset_fields = ['status', 'payment_method']
    search_fields = ['reference_number', 'salary_slip__employee__user__first_name']
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark salary payment as paid"""
        payment = self.get_object()
        
        if payment.status == 'paid':
            return Response({'error': 'Already marked as paid'}, status=status.HTTP_400_BAD_REQUEST)
        
        payment.payment_date = timezone.localdate()
        payment.payment_method = request.data.get('payment_method', payment.payment_method)
        payment.reference_number = request.data.get('reference_number', payment.reference_number)
        payment.status = 'processed'
        payment.save()
        
        # Update salary slip status
        payment.salary_slip.status = 'paid'
        payment.salary_slip.save()
        
        return Response(SalaryPaymentSerializer(payment).data)

# ============================================================
# ACCOUNTING VIEWSETS
# ============================================================


class AccountCategoryViewSet(HospitalScopedViewSet):
    """
    Manage hospital-specific account categories.
    """

    queryset = AccountCategory.objects.all()
    serializer_class = AccountCategorySerializer
    permission_classes = [IsAuthenticated]

    filterset_fields = [
        "account_type",
        "normal_balance",
        "is_active",
    ]

    search_fields = [
        "code",
        "name",
        "description",
    ]

    ordering_fields = [
        "code",
        "name",
        "account_type",
        "created_at",
    ]

    ordering = ["account_type", "code"]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .annotate(account_count=Count("accounts"))
        )

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        category = self.get_object()
        category.is_active = True
        category.save(update_fields=["is_active", "updated_at"])

        return Response(
            self.get_serializer(category).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        category = self.get_object()

        if category.accounts.filter(is_active=True).exists():
            return Response(
                {
                    "error": (
                        "This category contains active accounts. "
                        "Deactivate those accounts first."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        category.is_active = False
        category.save(update_fields=["is_active", "updated_at"])

        return Response(
            self.get_serializer(category).data,
            status=status.HTTP_200_OK,
        )


class ChartOfAccountViewSet(HospitalScopedViewSet):
    """
    Manage the hospital Chart of Accounts.
    """

    queryset = ChartOfAccount.objects.select_related(
        "hospital",
        "category",
        "parent",
        "parent__category",
    )

    permission_classes = [IsAuthenticated]

    filterset_fields = [
        "category",
        "category__account_type",
        "parent",
        "is_active",
        "is_control_account",
        "allow_manual_posting",
    ]

    search_fields = [
        "code",
        "name",
        "description",
        "category__name",
    ]

    ordering_fields = [
        "code",
        "name",
        "opening_balance",
        "current_balance",
        "created_at",
    ]

    ordering = ["code"]

    def get_serializer_class(self):
        if self.action == "list":
            return ChartOfAccountListSerializer

        return ChartOfAccountSerializer

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        account = self.get_object()

        if not account.category.is_active:
            return Response(
                {
                    "error": (
                        "The account category is inactive. "
                        "Activate the category first."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        account.is_active = True
        account.save(update_fields=["is_active", "updated_at"])

        return Response(
            ChartOfAccountSerializer(
                account,
                context={"request": request},
            ).data
        )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        account = self.get_object()

        if account.child_accounts.filter(is_active=True).exists():
            return Response(
                {
                    "error": (
                        "This account has active child accounts. "
                        "Deactivate the child accounts first."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        account.is_active = False
        account.save(update_fields=["is_active", "updated_at"])

        return Response(
            ChartOfAccountSerializer(
                account,
                context={"request": request},
            ).data
        )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()

        account_type_summary = (
            queryset.values(
                "category__account_type"
            )
            .annotate(
                account_count=Count("id"),
                total_balance=Sum("current_balance"),
            )
            .order_by("category__account_type")
        )

        return Response(
            {
                "total_accounts": queryset.count(),
                "active_accounts": queryset.filter(
                    is_active=True
                ).count(),
                "inactive_accounts": queryset.filter(
                    is_active=False
                ).count(),
                "control_accounts": queryset.filter(
                    is_control_account=True
                ).count(),
                "account_types": list(account_type_summary),
            }
        )


# ============================================================
# JOURNAL ENTRY API
# ============================================================

from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
)
from .serializers import (
    JournalEntryListSerializer,
    JournalEntrySerializer,
    VoidJournalSerializer,
)


class JournalEntryViewSet(viewsets.ModelViewSet):
    queryset = (
        JournalEntry.objects
        .select_related(
            "hospital",
            "created_by",
            "posted_by",
            "voided_by",
        )
        .prefetch_related("lines__account")
        .all()
    )

    serializer_class = JournalEntrySerializer

    filterset_fields = [
        "hospital",
        "status",
        "entry_type",
        "entry_date",
        "source_module",
    ]

    search_fields = [
        "journal_number",
        "reference",
        "description",
        "source_id",
    ]

    ordering_fields = [
        "entry_date",
        "created_at",
        "journal_number",
    ]

    ordering = ["-entry_date", "-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return JournalEntryListSerializer

        if self.action == "void":
            return VoidJournalSerializer

        return JournalEntrySerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        hospital_id = self.request.query_params.get("hospital_id")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if hospital_id:
            queryset = queryset.filter(
                hospital_id=hospital_id
            )

        if date_from:
            queryset = queryset.filter(
                entry_date__gte=date_from
            )

        if date_to:
            queryset = queryset.filter(
                entry_date__lte=date_to
            )

        return queryset

    def perform_destroy(self, instance):
        if instance.status != JournalEntry.Status.DRAFT:
            raise DjangoValidationError(
                "Only draft journals can be deleted."
            )

        instance.delete()

    @action(
        detail=True,
        methods=["post"],
        url_path="post",
    )
    def post_journal(self, request, pk=None):
        journal = self.get_object()

        try:
            journal.post(user=request.user)
        except DjangoValidationError as exc:
            return Response(
                {
                    "detail": (
                        exc.messages
                        if hasattr(exc, "messages")
                        else str(exc)
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        output = JournalEntrySerializer(
            journal,
            context={"request": request},
        )

        return Response(output.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="void",
    )
    def void(self, request, pk=None):
        journal = self.get_object()

        serializer = VoidJournalSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        try:
            journal.void(
                user=request.user,
                reason=serializer.validated_data["reason"],
            )
        except DjangoValidationError as exc:
            return Response(
                {
                    "detail": (
                        exc.messages
                        if hasattr(exc, "messages")
                        else str(exc)
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        output = JournalEntrySerializer(
            journal,
            context={"request": request},
        )

        return Response(output.data)

    @action(
        detail=False,
        methods=["get"],
        url_path="general-ledger",
    )
    def general_ledger(self, request):
        hospital_id = request.query_params.get("hospital_id")
        account_id = request.query_params.get("account_id")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if not hospital_id:
            return Response(
                {"detail": "hospital_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lines = (
            JournalEntryLine.objects
            .select_related(
                "journal_entry",
                "account",
            )
            .filter(
                journal_entry__hospital_id=hospital_id,
                journal_entry__status=JournalEntry.Status.POSTED,
            )
        )

        if account_id:
            lines = lines.filter(account_id=account_id)

        if date_from:
            lines = lines.filter(
                journal_entry__entry_date__gte=date_from
            )

        if date_to:
            lines = lines.filter(
                journal_entry__entry_date__lte=date_to
            )

        lines = lines.order_by(
            "account__code",
            "journal_entry__entry_date",
            "journal_entry__journal_number",
            "id",
        )

        running_balances = {}
        results = []

        for line in lines:
            account_key = str(line.account_id)

            previous_balance = running_balances.get(
                account_key,
                Decimal("0.00"),
            )

            running_balance = (
                previous_balance
                + line.debit
                - line.credit
            )

            running_balances[account_key] = running_balance

            results.append(
                {
                    "line_id": line.id,
                    "journal_id": line.journal_entry_id,
                    "journal_number": (
                        line.journal_entry.journal_number
                    ),
                    "entry_date": line.journal_entry.entry_date,
                    "reference": line.journal_entry.reference,
                    "description": (
                        line.description
                        or line.journal_entry.description
                    ),
                    "account_id": line.account_id,
                    "account_code": line.account.code,
                    "account_name": line.account.name,
                    "debit": line.debit,
                    "credit": line.credit,
                    "running_balance": running_balance,
                }
            )

        return Response(
            {
                "hospital_id": int(hospital_id),
                "count": len(results),
                "results": results,
            }
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="trial-balance",
    )
    def trial_balance(self, request):
        hospital_id = request.query_params.get("hospital_id")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if not hospital_id:
            return Response(
                {"detail": "hospital_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        line_filter = Q(
            journal_lines__journal_entry__status=(
                JournalEntry.Status.POSTED
            )
        )

        if date_from:
            line_filter &= Q(
                journal_lines__journal_entry__entry_date__gte=(
                    date_from
                )
            )

        if date_to:
            line_filter &= Q(
                journal_lines__journal_entry__entry_date__lte=(
                    date_to
                )
            )

        decimal_output = DecimalField(
            max_digits=18,
            decimal_places=2,
        )

        accounts = (
            ChartOfAccount.objects
            .filter(hospital_id=hospital_id)
            .select_related("category")
            .annotate(
                total_debit=Coalesce(
                    Sum(
                        "journal_lines__debit",
                        filter=line_filter,
                    ),
                    Value(
                        Decimal("0.00"),
                        output_field=decimal_output,
                    ),
                ),
                total_credit=Coalesce(
                    Sum(
                        "journal_lines__credit",
                        filter=line_filter,
                    ),
                    Value(
                        Decimal("0.00"),
                        output_field=decimal_output,
                    ),
                ),
            )
            .order_by("code")
        )

        results = []
        grand_debit = Decimal("0.00")
        grand_credit = Decimal("0.00")

        for account in accounts:
            net_balance = (
                account.total_debit
                - account.total_credit
            )

            if net_balance >= Decimal("0.00"):
                debit_balance = net_balance
                credit_balance = Decimal("0.00")
            else:
                debit_balance = Decimal("0.00")
                credit_balance = abs(net_balance)

            grand_debit += debit_balance
            grand_credit += credit_balance

            results.append(
                {
                    "account_id": account.id,
                    "account_code": account.code,
                    "account_name": account.name,
                    "category": account.category.name,
                    "account_type": account.category.account_type,
                    "total_debit": account.total_debit,
                    "total_credit": account.total_credit,
                    "debit_balance": debit_balance,
                    "credit_balance": credit_balance,
                }
            )

        return Response(
            {
                "hospital_id": int(hospital_id),
                "date_from": date_from,
                "date_to": date_to,
                "total_debit": grand_debit,
                "total_credit": grand_credit,
                "is_balanced": grand_debit == grand_credit,
                "accounts": results,
            }
        )
