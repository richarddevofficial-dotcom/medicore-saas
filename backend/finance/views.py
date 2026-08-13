from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import BasePermission, IsAuthenticated
from django.db import transaction
from datetime import datetime, timedelta
from django.utils import timezone

from human_resources.permissions import IsHRUser, IsHRManager
from human_resources.views import HospitalScopedViewSet
from finance.accounting_permissions import IsFinanceManager, IsFinanceUser
from config.audit_logger import AuditLogger
from django.db.models import Count, Sum
from finance.models import (
    PayrollYear,
    AllowanceType,
    DeductionType,
    SalaryStructure,
    EmployeeSalary,
    SalarySlip,
    SalaryPayment,
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
)


class PayrollYearViewSet(HospitalScopedViewSet):
    """Manage payroll years"""
    queryset = PayrollYear.objects.all()
    serializer_class = PayrollYearSerializer
    permission_classes = [IsAuthenticated, IsHRManager | IsFinanceManager]
    filterset_fields = ['year', 'is_active']
    search_fields = ['year']


class AllowanceTypeViewSet(HospitalScopedViewSet):
    """Manage allowance types"""
    queryset = AllowanceType.objects.all()
    serializer_class = AllowanceTypeSerializer
    permission_classes = [IsAuthenticated, IsHRUser | IsFinanceManager]
    filterset_fields = ['code', 'is_active']
    search_fields = ['code', 'name']


class DeductionTypeViewSet(HospitalScopedViewSet):
    """Manage deduction types"""
    queryset = DeductionType.objects.all()
    serializer_class = DeductionTypeSerializer
    permission_classes = [IsAuthenticated, IsHRUser | IsFinanceManager]
    filterset_fields = ['code', 'is_mandatory', 'is_active']
    search_fields = ['code', 'name']


class SalaryStructureViewSet(HospitalScopedViewSet):
    """Manage salary structures"""
    queryset = SalaryStructure.objects.all()
    serializer_class = SalaryStructureSerializer
    permission_classes = [IsAuthenticated, IsHRManager | IsFinanceManager]
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


class IsPayrollViewer(BasePermission):
    """Allow HR and finance staff to view hospital payroll records."""

    message = "You do not have permission to view payroll records."

    def has_permission(self, request, view):
        return (
            IsHRUser().has_permission(request, view)
            or IsFinanceUser().has_permission(request, view)
        )


class EmployeeSalaryViewSet(HospitalScopedViewSet):
    """Manage employee salary assignments"""
    queryset = EmployeeSalary.objects.order_by('employee__employee_number')
    hospital_lookup = 'employee__hospital_id'
    serializer_class = EmployeeSalarySerializer
    filterset_fields = ['employee', 'salary_structure']
    search_fields = ['employee__user__first_name', 'employee__user__last_name']

    def get_permissions(self):
        permission_class = (
            IsPayrollViewer
            if self.action in ('list', 'retrieve')
            else IsHRManager
        )
        return [IsAuthenticated(), permission_class()]

    def create(self, request, *args, **kwargs):
        employee_id = request.data.get('employee')
        existing = self.get_queryset().filter(employee_id=employee_id).first()
        if existing:
            serializer = self.get_serializer(
                existing,
                data=request.data,
                partial=True,
            )
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)


class SalarySlipViewSet(HospitalScopedViewSet):
    """Manage salary slips"""
    queryset = SalarySlip.objects.all()
    hospital_lookup = 'employee__hospital_id'
    filterset_fields = ['employee', 'status', 'month']
    search_fields = ['employee__user__first_name', 'employee__user__last_name']
    ordering_fields = ['-month', 'employee']
    ordering = ['-month']
    
    def get_serializer_class(self):
        """Use detail serializer for retrieve"""
        if self.action == 'retrieve':
            return SalarySlipDetailSerializer
        return SalarySlipSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            permission_classes = [IsAuthenticated, IsPayrollViewer]
        else:
            permission_classes = [IsAuthenticated, IsHRManager]

        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        """Filter by hospital and optionally by user's own slips"""
        queryset = super().get_queryset()
        
        # HR users can only see their own slips
        if hasattr(self.request.user, 'employee') and not self.request.user.groups.filter(name__in=['hr_manager', 'hr_officer']).exists():
            queryset = queryset.filter(employee__user=self.request.user)
        
        return queryset
    
    @action(
        detail=False,
        methods=['post'],
        permission_classes=[IsAuthenticated, IsHRManager],
    )
    def generate_bulk(self, request):
        """Generate salary slips for all employees in a month"""
        month = request.data.get('month')  # Format: YYYY-MM-01
        
        if not month:
            return Response({'error': 'month parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            month_date = datetime.strptime(month, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format, use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
        
        hospital_id = self.get_hospital_id()
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
    
    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated, IsHRManager],
    )
    def approve(self, request, pk=None):
        """Approve salary slip"""
        salary_slip = self.get_object()
        
        if salary_slip.status not in ['generated']:
            return Response(
                {'error': 'Can only approve generated slips'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent self-approval: an HR manager cannot approve their own salary
        employee_user = getattr(salary_slip.employee, 'user', None)
        if employee_user and employee_user.id == request.user.id:
            return Response(
                {'error': 'You cannot approve your own salary slip'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        with transaction.atomic():
            salary_slip.status = 'approved'
            salary_slip.save(update_fields=['status', 'updated_at'])
            SalaryPayment.objects.get_or_create(
                salary_slip=salary_slip,
                defaults={'status': 'pending'},
            )

        AuditLogger.log_audit(
            user=request.user,
            action="SALARY_SLIP_APPROVED",
            target=f"salary_slip:{salary_slip.id}",
            hospital=salary_slip.employee.hospital,
            new_values={
                "employee": str(salary_slip.employee_id),
                "month": str(salary_slip.month),
                "net_salary": str(salary_slip.net_salary),
            },
            request=request,
        )
        
        return Response(SalarySlipDetailSerializer(salary_slip).data)
    
    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated, IsHRManager],
    )
    def reject(self, request, pk=None):
        """Reject salary slip"""
        salary_slip = self.get_object()
        reason = request.data.get('reason', '')
        
        if salary_slip.status != 'generated':
            return Response(
            {'error': 'Can only reject generated slips'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        salary_slip.status = 'draft'
        salary_slip.notes = reason
        salary_slip.save()
        
        return Response(SalarySlipDetailSerializer(salary_slip).data)

    def perform_destroy(self, instance):
        if instance.status not in {'draft', 'generated'}:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                'Approved or paid salary slips cannot be deleted.'
            )
        instance.delete()


class SalaryPaymentViewSet(HospitalScopedViewSet):
    """Manage salary payments"""
    queryset = SalaryPayment.objects.all()
    hospital_lookup = 'salary_slip__employee__hospital_id'
    serializer_class = SalaryPaymentSerializer
    permission_classes = [IsAuthenticated, IsHRManager]
    filterset_fields = ['status', 'payment_method']
    search_fields = ['reference_number', 'salary_slip__employee__user__first_name']

    def create(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Payments are created when a salary slip is approved.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Use the payment actions to change payment status.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Salary payment records cannot be deleted.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark salary payment as paid"""
        with transaction.atomic():
            payment = SalaryPayment.objects.select_for_update().get(
                pk=self.get_object().pk
            )
            if payment.status != 'pending':
                return Response(
                    {'error': 'Only pending payments can be marked as paid'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment.payment_date = timezone.localdate()
            payment.payment_method = request.data.get('payment_method', payment.payment_method)
            payment.reference_number = request.data.get('reference_number', payment.reference_number)
            payment.status = 'processed'
            payment.save()

            payment.salary_slip.status = 'paid'
            payment.salary_slip.save(update_fields=['status', 'updated_at'])

        AuditLogger.log_audit(
            user=request.user,
            action="SALARY_PAYMENT_MARKED_PAID",
            target=f"salary_payment:{payment.id}",
            hospital=payment.salary_slip.employee.hospital,
            new_values={
                "salary_slip": str(payment.salary_slip_id),
                "payment_method": payment.payment_method,
                "reference_number": payment.reference_number,
            },
            request=request,
        )
        
        return Response(SalaryPaymentSerializer(payment).data)
