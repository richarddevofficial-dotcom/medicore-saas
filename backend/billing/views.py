from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User
from decimal import Decimal
from .models import Bill
from .serializers import BillSerializer
from .models import Bill, SubscriptionPayment
from .serializers import BillSerializer, SubscriptionPaymentSerializer

class BillViewSet(viewsets.ModelViewSet):
    queryset = Bill.objects.all()
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['bill_number', 'patient_name', 'status']
    ordering = ['-created_at']
    
    def get_queryset(self):
        hospital = self.request.user.staff_profile.hospital
        return Bill.objects.filter(hospital=hospital)
    
    def perform_create(self, serializer):
        hospital = self.request.user.staff_profile.hospital
        serializer.save(hospital=hospital)
    
    @action(detail=True, methods=['post'])
    def make_payment(self, request, pk=None):
        bill = self.get_object()
        amount = Decimal(str(request.data.get('amount', 0)))
        if amount <= 0: return Response({'error': 'Invalid amount'}, status=400)
        bill.amount_paid = (bill.amount_paid or Decimal('0')) + amount
        bill.payment_date = timezone.now().date()
        if bill.amount_paid >= (bill.total_amount or Decimal('0')):
            bill.status = 'paid'
        elif bill.amount_paid > 0:
            bill.status = 'partial'
        bill.save()
        return Response(BillSerializer(bill).data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        try:
            hospital = request.user.staff_profile.hospital
        except Exception:
            hospital = None

        bills = Bill.objects.filter(hospital=hospital) if hospital else Bill.objects.none()
        total = bills.count()
        paid = bills.filter(status='paid').count()
        revenue = sum(float(b.total_amount or 0) for b in bills.filter(status='paid'))
        return Response({'total_bills': total, 'paid': paid, 'revenue': revenue})
    
    

class SubscriptionPaymentViewSet(viewsets.ModelViewSet):
    queryset = SubscriptionPayment.objects.all()
    serializer_class = SubscriptionPaymentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = SubscriptionPayment.objects.select_related('hospital').all()

        if user.is_superuser:
            hospital_id = self.request.query_params.get('hospital_id')
            payment_status = self.request.query_params.get('status')
            if hospital_id:
                queryset = queryset.filter(hospital_id=hospital_id)
            if payment_status:
                queryset = queryset.filter(status=payment_status)
            return queryset

        if hasattr(user, 'staff_profile'):
            hospital = user.staff_profile.hospital
            return queryset.filter(hospital=hospital)

        return SubscriptionPayment.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        if user.is_superuser:
            hospital_id = self.request.data.get('hospital_id')
            if not hospital_id:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'hospital_id': 'hospital_id is required for superuser'})
            from hospitals.models import Hospital
            try:
                hospital = Hospital.objects.get(id=hospital_id)
            except Hospital.DoesNotExist:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'hospital_id': 'Hospital not found'})
        elif hasattr(user, 'staff_profile'):
            hospital = user.staff_profile.hospital
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'error': 'User has no staff profile'})

        serializer.save(hospital=hospital)

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        if not request.user.is_superuser:
            return Response({'error': 'Only super admin can review payments'}, status=403)

        payment = self.get_object()
        next_status = request.data.get('status')
        if next_status not in ['pending', 'paid', 'failed', 'refunded']:
            return Response({'error': 'Invalid status'}, status=400)

        payment.status = next_status
        if next_status == 'paid':
            payment.payment_date = timezone.now()
            payment.subscription_start = timezone.now().date()
            payment.subscription_end = timezone.now().date() + timedelta(days=30)

            hospital = payment.hospital
            hospital.subscription_plan = payment.plan
            hospital.subscription_status = 'active'
            hospital.is_active = True
            hospital.save(update_fields=['subscription_plan', 'subscription_status', 'is_active'])

            staff_user_ids = hospital.staff.exclude(user__is_superuser=True).values_list('user_id', flat=True)
            User.objects.filter(id__in=staff_user_ids).update(is_active=True)
        elif next_status in ['failed', 'refunded']:
            hospital = payment.hospital
            hospital.subscription_status = 'inactive'
            hospital.is_active = False
            hospital.save(update_fields=['subscription_status', 'is_active'])

            staff_user_ids = hospital.staff.exclude(user__is_superuser=True).values_list('user_id', flat=True)
            User.objects.filter(id__in=staff_user_ids).update(is_active=False)

        payment.save()
        return Response(SubscriptionPaymentSerializer(payment).data)
