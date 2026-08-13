from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum

from human_resources.permissions import IsHRUser, IsHRManager
from human_resources.views import HospitalScopedViewSet
from finance.accounting_permissions import IsFinanceUser, IsFinanceManager
from config.audit_logger import AuditLogger
from budgets.models import (
    BudgetYear, BudgetTemplate, BudgetAllocation,
    BudgetVariance, BudgetRevision, BudgetForecast,
    BudgetAlert
)
from budgets.serializers import (
    BudgetYearSerializer, BudgetTemplateSerializer,
    BudgetAllocationSerializer, BudgetAllocationDetailSerializer,
    BudgetVarianceSerializer, BudgetRevisionSerializer,
    BudgetForecastSerializer, BudgetAlertSerializer
)


class BudgetYearViewSet(HospitalScopedViewSet):
    """Manage budget years"""
    queryset = BudgetYear.objects.all()
    serializer_class = BudgetYearSerializer
    permission_classes = [permissions.IsAuthenticated, IsHRManager | IsFinanceManager]
    filterset_fields = ['year', 'is_active', 'is_locked']
    search_fields = ['year']


class BudgetTemplateViewSet(HospitalScopedViewSet):
    """Manage budget templates"""
    queryset = BudgetTemplate.objects.all()
    serializer_class = BudgetTemplateSerializer
    permission_classes = [permissions.IsAuthenticated, IsHRManager | IsFinanceManager]
    filterset_fields = ['allocation_type', 'is_active']
    search_fields = ['name']


class BudgetAllocationViewSet(HospitalScopedViewSet):
    """Manage budget allocations with approval workflow"""
    queryset = BudgetAllocation.objects.all()
    hospital_lookup = 'budget_year__hospital_id'
    permission_classes = [permissions.IsAuthenticated, IsHRUser | IsFinanceUser]
    filterset_fields = ['budget_year', 'department', 'status', 'period_start']
    search_fields = ['department__name']
    ordering_fields = ['-period_start', 'allocated_amount', 'status']
    ordering = ['-period_start']

    def get_permissions(self):
        if self.action in {'approve', 'reject', 'destroy'}:
            permission_classes = [
                permissions.IsAuthenticated,
                IsHRManager | IsFinanceManager,
            ]
        else:
            permission_classes = [
                permissions.IsAuthenticated,
                IsHRUser | IsFinanceUser,
            ]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        """Use detail serializer for retrieve"""
        if self.action == 'retrieve':
            return BudgetAllocationDetailSerializer
        return BudgetAllocationSerializer
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit budget for approval"""
        allocation = self.get_object()
        
        if allocation.status != 'draft':
            return Response(
                {'error': 'Can only submit draft budgets'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if allocation.budget_year.is_locked:
            return Response(
                {'error': 'Cannot submit an allocation in a locked budget year'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        allocation.status = 'submitted'
        allocation.submitted_by = request.user
        allocation.save()
        
        return Response(BudgetAllocationDetailSerializer(allocation).data)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve budget allocation"""
        allocation = self.get_object()
        
        if allocation.status != 'submitted':
            return Response(
                {'error': 'Can only approve submitted budgets'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if allocation.budget_year.is_locked:
            return Response(
                {'error': 'Cannot approve an allocation in a locked budget year'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Prevent self-approval: approver must differ from submitter
        if allocation.submitted_by_id == request.user.id:
            return Response(
                {'error': 'You cannot approve your own budget allocation'},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            allocation.status = 'approved'
            allocation.approved_by = request.user
            allocation.approved_date = timezone.now()
            allocation.save()
            
            # Create variance record
            BudgetVariance.objects.create(
                allocation=allocation,
                actual_amount=0,
                variance_amount=allocation.allocated_amount,
                variance_percentage=100,
                created_by=request.user
            )

        AuditLogger.log_audit(
            user=request.user,
            action="BUDGET_APPROVED",
            target=f"budget_allocation:{allocation.id}",
            hospital=allocation.budget_year.hospital,
            new_values={
                "department": str(allocation.department_id),
                "allocated_amount": str(allocation.allocated_amount),
                "period": f"{allocation.period_start} to {allocation.period_end}",
            },
            request=request,
        )
        
        return Response(BudgetAllocationDetailSerializer(allocation).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject budget allocation"""
        allocation = self.get_object()
        
        if allocation.status != 'submitted':
            return Response(
                {'error': 'Can only reject submitted budgets'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if allocation.budget_year.is_locked:
            return Response(
                {'error': 'Cannot reject an allocation in a locked budget year'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        allocation.status = 'rejected'
        allocation.save()

        AuditLogger.log_audit(
            user=request.user,
            action="BUDGET_REJECTED",
            target=f"budget_allocation:{allocation.id}",
            hospital=allocation.budget_year.hospital,
            new_values={
                "department": str(allocation.department_id),
                "allocated_amount": str(allocation.allocated_amount),
            },
            request=request,
        )
        
        return Response(BudgetAllocationDetailSerializer(allocation).data)
    
    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get all allocations pending approval"""
        if not (
            IsHRManager().has_permission(request, self)
            or IsFinanceManager().has_permission(request, self)
        ):
            return Response(
                {'error': 'Only HR managers can view pending approvals'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        hospital_id = self.get_hospital_id()
        allocations = BudgetAllocation.objects.filter(
            budget_year__hospital_id=hospital_id,
            status='submitted'
        ).order_by('-created_at')
        
        serializer = self.get_serializer(allocations, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def exceeded(self, request):
        """Get allocations that exceeded budget"""
        hospital_id = self.get_hospital_id()
        allocations = BudgetAllocation.objects.filter(
            budget_year__hospital_id=hospital_id,
            status__in=['approved', 'active']
        )
        
        exceeded = [a for a in allocations if a.is_exceeded()]
        serializer = self.get_serializer(exceeded, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def variance_report(self, request):
        """Get variance analysis across all allocations"""
        hospital_id = self.get_hospital_id()
        budget_year_id = request.query_params.get('budget_year')
        
        allocations = BudgetAllocation.objects.filter(budget_year__hospital_id=hospital_id)
        if budget_year_id:
            allocations = allocations.filter(budget_year_id=budget_year_id)
        
        allocations = allocations.filter(status__in=['approved', 'active'])
        
        data = []
        for allocation in allocations:
            data.append({
                'id': allocation.id,
                'department': allocation.department.name,
                'period': f"{allocation.period_start} to {allocation.period_end}",
                'allocated': float(allocation.allocated_amount),
                'actual_spent': float(allocation.get_actual_spent()),
                'variance': float(allocation.get_variance()),
                'variance_percentage': allocation.get_variance_percentage(),
                'is_exceeded': allocation.is_exceeded(),
            })
        
        return Response(data)

    def perform_destroy(self, instance):
        if instance.status != 'draft':
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Only draft allocations can be deleted.')
        if instance.budget_year.is_locked:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                'Allocations cannot be deleted from a locked budget year.'
            )
        instance.delete()


class BudgetVarianceViewSet(HospitalScopedViewSet):
    """View variance analysis"""
    queryset = BudgetVariance.objects.all()
    hospital_lookup = 'allocation__budget_year__hospital_id'
    serializer_class = BudgetVarianceSerializer
    permission_classes = [permissions.IsAuthenticated, IsHRUser | IsFinanceUser]
    http_method_names = ['get', 'head', 'options']
    filterset_fields = ['allocation']
    ordering = ['-created_at']


class BudgetRevisionViewSet(HospitalScopedViewSet):
    """Manage budget revisions"""
    queryset = BudgetRevision.objects.all()
    hospital_lookup = 'allocation__budget_year__hospital_id'
    serializer_class = BudgetRevisionSerializer
    permission_classes = [permissions.IsAuthenticated, IsHRUser | IsFinanceUser]
    filterset_fields = ['allocation', 'status']
    search_fields = ['reason']
    ordering = ['-requested_date']

    def get_permissions(self):
        if self.action in {'approve', 'reject', 'destroy'}:
            permission_classes = [
                permissions.IsAuthenticated,
                IsHRManager | IsFinanceManager,
            ]
        else:
            permission_classes = [
                permissions.IsAuthenticated,
                IsHRUser | IsFinanceUser,
            ]
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        """Auto-set requested_by and original_amount"""
        allocation = serializer.validated_data['allocation']
        serializer.save(
            requested_by=self.request.user,
            original_amount=allocation.allocated_amount
        )
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit revision for approval"""
        revision = self.get_object()
        
        if revision.status != 'draft':
            return Response(
                {'error': 'Can only submit draft revisions'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        revision.status = 'submitted'
        revision.save()
        
        return Response(BudgetRevisionSerializer(revision).data)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve budget revision"""
        revision = self.get_object()
        
        if revision.status != 'submitted':
            return Response(
                {'error': 'Can only approve submitted revisions'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        approval_notes = request.data.get('approval_notes', '')
        
        with transaction.atomic():
            # Update allocation
            allocation = revision.allocation
            allocation.allocated_amount = revision.revised_amount
            allocation.save()
            
            # Update revision
            revision.status = 'approved'
            revision.approved_by = request.user
            revision.approved_date = timezone.now()
            revision.approval_notes = approval_notes
            revision.save()
        
        return Response(BudgetRevisionSerializer(revision).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject budget revision"""
        revision = self.get_object()
        
        if revision.status != 'submitted':
            return Response(
                {'error': 'Can only reject submitted revisions'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        approval_notes = request.data.get('approval_notes', '')
        
        revision.status = 'rejected'
        revision.approved_by = request.user
        revision.approved_date = timezone.now()
        revision.approval_notes = approval_notes
        revision.save()
        
        return Response(BudgetRevisionSerializer(revision).data)

    def perform_destroy(self, instance):
        if instance.status != 'draft':
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Only draft revisions can be deleted.')
        instance.delete()


class BudgetForecastViewSet(HospitalScopedViewSet):
    """Manage budget forecasts"""
    queryset = BudgetForecast.objects.all()
    hospital_lookup = 'budget_year__hospital_id'
    serializer_class = BudgetForecastSerializer
    permission_classes = [permissions.IsAuthenticated, IsHRManager | IsFinanceManager]
    filterset_fields = ['budget_year', 'department', 'confidence_level']
    search_fields = ['department__name']
    ordering = ['-month']
    
    def perform_create(self, serializer):
        """Auto-set created_by"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def by_department(self, request):
        """Get forecasts grouped by department"""
        hospital_id = self.get_hospital_id()
        budget_year_id = request.query_params.get('budget_year')
        
        forecasts = BudgetForecast.objects.filter(budget_year__hospital_id=hospital_id)
        if budget_year_id:
            forecasts = forecasts.filter(budget_year_id=budget_year_id)
        
        from django.db.models import Sum
        from collections import defaultdict
        
        data = defaultdict(lambda: {
            'department_name': '',
            'total_forecast': 0,
            'months': []
        })
        
        for forecast in forecasts:
            dept_key = forecast.department.id
            if not data[dept_key]['department_name']:
                data[dept_key]['department_name'] = forecast.department.name
            
            data[dept_key]['total_forecast'] += float(forecast.forecasted_amount)
            data[dept_key]['months'].append({
                'month': forecast.month.isoformat(),
                'amount': float(forecast.forecasted_amount),
                'confidence': forecast.confidence_level
            })
        
        return Response(list(data.values()))


class BudgetAlertViewSet(HospitalScopedViewSet):
    """Manage budget alerts"""
    queryset = BudgetAlert.objects.all()
    hospital_lookup = 'allocation__budget_year__hospital_id'
    serializer_class = BudgetAlertSerializer
    permission_classes = [permissions.IsAuthenticated, IsHRUser | IsFinanceUser]
    filterset_fields = ['allocation', 'severity', 'status']
    ordering = ['-triggered_at']
    
    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge a budget alert"""
        alert = self.get_object()
        
        alert.status = 'acknowledged'
        alert.acknowledged_by = request.user
        alert.acknowledged_at = timezone.now()
        alert.save()
        
        return Response(BudgetAlertSerializer(alert).data)
    
    @action(detail=False, methods=['get'])
    def active_alerts(self, request):
        """Get all active alerts"""
        hospital_id = self.get_hospital_id()
        alerts = BudgetAlert.objects.filter(
            allocation__budget_year__hospital_id=hospital_id,
            status='active'
        ).order_by('-triggered_at')
        
        serializer = self.get_serializer(alerts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def critical_alerts(self, request):
        """Get all critical alerts"""
        hospital_id = self.get_hospital_id()
        alerts = BudgetAlert.objects.filter(
            allocation__budget_year__hospital_id=hospital_id,
            severity='critical',
            status='active'
        ).order_by('-triggered_at')
        
        serializer = self.get_serializer(alerts, many=True)
        return Response(serializer.data)
