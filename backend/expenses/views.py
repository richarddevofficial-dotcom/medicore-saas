from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone

from human_resources.permissions import IsHRUser, IsHRManager
from human_resources.views import HospitalScopedViewSet
from expenses.models import (
    ExpenseCategory, Expense, ExpenseApprovalLog,
    ExpenseBudget, ExpensePayment
)
from expenses.serializers import (
    ExpenseCategorySerializer, ExpenseSerializer, ExpenseDetailSerializer,
    ExpenseApprovalLogSerializer, ExpenseBudgetSerializer,
    ExpenseBudgetDetailSerializer, ExpensePaymentSerializer
)


class ExpenseCategoryViewSet(HospitalScopedViewSet):
    """Manage expense categories"""
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsHRManager]
    filterset_fields = ['code', 'is_active']
    search_fields = ['code', 'name']


class ExpenseViewSet(HospitalScopedViewSet):
    """Manage expenses with approval workflow"""
    queryset = Expense.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsHRUser]
    filterset_fields = ['category', 'department', 'status', 'expense_date']
    search_fields = ['description', 'vendor_name', 'invoice_number']
    ordering_fields = ['-expense_date', 'amount', 'status']
    ordering = ['-expense_date']
    
    def get_serializer_class(self):
        """Use detail serializer for retrieve"""
        if self.action == 'retrieve':
            return ExpenseDetailSerializer
        return ExpenseSerializer
    
    def get_queryset(self):
        """Filter by hospital"""
        queryset = super().get_queryset()
        # Staff can only see their own submitted expenses (unless HR manager)
        if not self.request.user.groups.filter(name__in=['hr_manager']).exists():
            queryset = queryset.filter(submitted_by=self.request.user)
        return queryset
    
    def perform_create(self, serializer):
        """Auto-set submitted_by and hospital"""
        serializer.save(
            submitted_by=self.request.user,
            hospital_id=self.get_user_hospital_id()
        )
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit expense for approval"""
        expense = self.get_object()
        
        if expense.status != 'draft':
            return Response(
                {'error': 'Can only submit draft expenses'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            expense.status = 'submitted'
            expense.save()
            
            # Create approval log
            ExpenseApprovalLog.objects.create(
                expense=expense,
                action='submitted',
                approved_by=request.user
            )
        
        return Response(ExpenseDetailSerializer(expense).data)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve an expense"""
        expense = self.get_object()
        
        if expense.status not in ['submitted', 'revised']:
            return Response(
                {'error': 'Can only approve submitted or revised expenses'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user has permission to approve
        if not request.user.groups.filter(name__in=['hr_manager']).exists():
            return Response(
                {'error': 'Only HR managers can approve expenses'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        approval_notes = request.data.get('approval_notes', '')
        
        with transaction.atomic():
            expense.status = 'approved'
            expense.approved_by = request.user
            expense.approval_date = timezone.now()
            expense.approval_notes = approval_notes
            expense.save()
            
            # Create payment record
            ExpensePayment.objects.get_or_create(
                expense=expense,
                defaults={'status': 'pending'}
            )
            
            # Create approval log
            ExpenseApprovalLog.objects.create(
                expense=expense,
                action='approved',
                approved_by=request.user,
                comments=approval_notes
            )
        
        return Response(ExpenseDetailSerializer(expense).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject an expense"""
        expense = self.get_object()
        
        if expense.status not in ['submitted', 'revised']:
            return Response(
                {'error': 'Can only reject submitted or revised expenses'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not request.user.groups.filter(name__in=['hr_manager']).exists():
            return Response(
                {'error': 'Only HR managers can reject expenses'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        rejection_notes = request.data.get('rejection_notes', '')
        
        with transaction.atomic():
            expense.status = 'rejected'
            expense.notes = rejection_notes
            expense.save()
            
            # Create approval log
            ExpenseApprovalLog.objects.create(
                expense=expense,
                action='rejected',
                approved_by=request.user,
                comments=rejection_notes
            )
        
        return Response(ExpenseDetailSerializer(expense).data)
    
    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get all expenses pending approval"""
        if not request.user.groups.filter(name__in=['hr_manager']).exists():
            return Response(
                {'error': 'Only HR managers can view pending approvals'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        hospital_id = self.get_user_hospital_id()
        expenses = Expense.objects.filter(
            hospital_id=hospital_id,
            status__in=['submitted', 'revised']
        ).order_by('-expense_date')
        
        serializer = self.get_serializer(expenses, many=True)
        return Response(serializer.data)


class ExpenseBudgetViewSet(HospitalScopedViewSet):
    """Manage expense budgets"""
    queryset = ExpenseBudget.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsHRManager]
    filterset_fields = ['category', 'department', 'month']
    search_fields = ['category__name']
    ordering = ['-month']
    
    def get_serializer_class(self):
        """Use detail serializer for retrieve"""
        if self.action == 'retrieve':
            return ExpenseBudgetDetailSerializer
        return ExpenseBudgetSerializer
    
    def perform_create(self, serializer):
        """Auto-set hospital"""
        serializer.save(hospital_id=self.get_user_hospital_id())
    
    @action(detail=False, methods=['get'])
    def exceeded(self, request):
        """Get all budgets that are exceeded"""
        hospital_id = self.get_user_hospital_id()
        budgets = ExpenseBudget.objects.filter(hospital_id=hospital_id)
        
        exceeded = []
        for budget in budgets:
            if budget.is_exceeded():
                exceeded.append(budget)
        
        serializer = ExpenseBudgetSerializer(exceeded, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def current_month(self, request):
        """Get budget for current month"""
        from datetime import datetime
        hospital_id = self.get_user_hospital_id()
        
        current_month = datetime.now().replace(day=1).date()
        budgets = ExpenseBudget.objects.filter(
            hospital_id=hospital_id,
            month=current_month
        )
        
        serializer = self.get_serializer(budgets, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get budget summary with expenses breakdown"""
        budget = self.get_object()
        
        from expenses.models import Expense
        
        expenses = Expense.objects.filter(
            hospital=budget.hospital,
            category=budget.category,
            status__in=['approved', 'paid'],
            expense_date__month=budget.month.month,
            expense_date__year=budget.month.year
        )
        
        if budget.department:
            expenses = expenses.filter(department=budget.department)
        
        serializer = ExpenseDetailSerializer(expenses, many=True)
        
        return Response({
            'budget': ExpenseBudgetDetailSerializer(budget).data,
            'expenses': serializer.data,
            'total_count': expenses.count()
        })


class ExpensePaymentViewSet(HospitalScopedViewSet):
    """Manage expense payments"""
    queryset = ExpensePayment.objects.all()
    serializer_class = ExpensePaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsHRManager]
    filterset_fields = ['status', 'payment_method']
    ordering = ['-payment_date']
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark expense payment as paid"""
        payment = self.get_object()
        
        if payment.status == 'processed':
            return Response({'error': 'Already marked as paid'}, status=status.HTTP_400_BAD_REQUEST)
        
        payment_date = request.data.get('payment_date', timezone.localdate())
        payment_method = request.data.get('payment_method', 'bank_transfer')
        reference_number = request.data.get('reference_number', '')
        
        with transaction.atomic():
            payment.payment_date = payment_date
            payment.payment_method = payment_method
            payment.reference_number = reference_number
            payment.status = 'processed'
            payment.save()
            
            # Update expense status
            payment.expense.status = 'paid'
            payment.expense.save()
        
        return Response(ExpensePaymentSerializer(payment).data)
