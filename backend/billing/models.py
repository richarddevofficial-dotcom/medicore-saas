from django.db import models
from django.db.models import Q
from django.conf import settings
from hospitals.models import Hospital


class ServiceCatalog(models.Model):
    SERVICE_TYPES = [
        ('consultation', 'Consultation'),
        ('lab', 'Lab'),
        ('other', 'Other Service'),
    ]

    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='service_catalog')
    name = models.CharField(max_length=200)
    service_type = models.CharField(max_length=20, choices=SERVICE_TYPES, default='other')
    code = models.CharField(max_length=50, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['service_type', 'name']
        unique_together = ['hospital', 'name']

    def __str__(self):
        return f"{self.name} ({self.service_type})"

class Bill(models.Model):
    STATUS = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('partial', 'Partially Paid'),
        ('insurance', 'Insurance Claimed'),
        ('cancelled', 'Cancelled'),
    ]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    bill_number = models.CharField(max_length=50, unique=True)
    patient_name = models.CharField(max_length=200)
    patient_mrn = models.CharField(max_length=50, blank=True)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    lab_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    medicine_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    room_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, default='cash')
    payment_date = models.DateField(null=True, blank=True)
    insurance_company = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if not self.bill_number:
            from datetime import datetime
            last = Bill.objects.order_by('-id').first()
            num = (last.id + 1) if last else 1
            self.bill_number = f"BILL-{datetime.now().strftime('%Y%m%d')}-{num:04d}"
        self.total_amount = self.consultation_fee + self.lab_fee + self.medicine_fee + self.room_fee + self.other_fee
        self.balance = self.total_amount - self.amount_paid
        super().save(*args, **kwargs)


class POSReceipt(models.Model):
    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('mobile_money', 'Mobile Money'),
        ('other', 'Other'),
    ]

    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='pos_receipts')
    receipt_number = models.CharField(max_length=50, unique=True)
    customer_name = models.CharField(max_length=200, default='Walk-in Customer')
    medicine = models.ForeignKey('pharmacy.Medicine', on_delete=models.SET_NULL, null=True, blank=True)
    medicine_name_snapshot = models.CharField(max_length=200, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    cashier_name = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            from datetime import datetime

            prefix = f"POS-{datetime.now().strftime('%Y%m%d')}"
            last_for_day = POSReceipt.objects.filter(receipt_number__startswith=prefix).order_by('-id').first()
            if last_for_day and '-' in last_for_day.receipt_number:
                try:
                    seq = int(last_for_day.receipt_number.split('-')[-1]) + 1
                except Exception:
                    seq = 1
            else:
                seq = 1
            self.receipt_number = f"{prefix}-{seq:04d}"

        self.total_amount = self.quantity * self.unit_price
        if self.medicine and not self.medicine_name_snapshot:
            self.medicine_name_snapshot = self.medicine.name
        super().save(*args, **kwargs)

class SubscriptionPayment(models.Model):
    STATUS = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]

    BILLING_CYCLE_CHOICES = [
        (1, '1 Month'),
        (3, '3 Months (Quarterly)'),
        (4, '4 Months'),
        (6, '6 Months'),
        (12, '12 Months (Yearly)'),
    ]

    RECEIPT_DELIVERY_STATUS_CHOICES = [
        ('not_sent', 'Not Sent'),
        ('queued', 'Queued'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    plan = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    payment_method = models.CharField(max_length=50, blank=True)
    transaction_id = models.CharField(max_length=200, blank=True)
    idempotency_key = models.CharField(max_length=128, blank=True, db_index=True)
    billing_cycle_months = models.PositiveSmallIntegerField(choices=BILLING_CYCLE_CHOICES, default=1)
    status = models.CharField(max_length=20, choices=STATUS, default='pending')
    payment_date = models.DateTimeField(null=True, blank=True)
    subscription_start = models.DateField(null=True, blank=True)
    subscription_end = models.DateField(null=True, blank=True)
    receipt_delivery_status = models.CharField(
        max_length=20,
        choices=RECEIPT_DELIVERY_STATUS_CHOICES,
        default='not_sent',
    )
    receipt_last_attempt_at = models.DateTimeField(null=True, blank=True)
    receipt_sent_at = models.DateTimeField(null=True, blank=True)
    receipt_last_error = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['hospital', 'idempotency_key'],
                condition=~Q(idempotency_key=''),
                name='uniq_subscription_payment_hospital_idempotency_key',
            ),
        ]
    
    def __str__(self):
        return f"{self.hospital.name} - {self.plan} - {self.status}"


class ReceiptEmailJob(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]

    payment = models.ForeignKey(
        SubscriptionPayment,
        on_delete=models.CASCADE,
        related_name='receipt_jobs',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    next_attempt_at = models.DateTimeField(auto_now_add=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['next_attempt_at', 'id']

    def __str__(self):
        return f"ReceiptJob(payment={self.payment_id}, status={self.status}, attempts={self.attempts})"
