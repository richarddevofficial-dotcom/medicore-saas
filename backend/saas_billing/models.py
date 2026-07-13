import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from hospitals.models import Hospital


class SubscriptionPlan(models.Model):
    """
    Master subscription plan catalogue.

    The one-time service fee is separate from the recurring monthly
    software subscription.
    """

    code = models.SlugField(
        max_length=50,
        unique=True,
    )

    name = models.CharField(
        max_length=100,
        unique=True,
    )

    description = models.TextField(
        blank=True,
    )

    currency = models.CharField(
        max_length=10,
        default="USD",
    )

    monthly_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    service_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="One-time onboarding and platform service fee.",
    )

    max_staff = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Leave empty for unlimited.",
    )

    max_patients = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Leave empty for unlimited.",
    )

    storage_gb = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Leave empty for unlimited.",
    )

    features = models.JSONField(
        default=list,
        blank=True,
    )

    display_order = models.PositiveIntegerField(
        default=0,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["display_order", "monthly_price"]
        verbose_name = "Subscription Plan"
        verbose_name_plural = "Subscription Plans"

    def __str__(self):
        return self.name


class HospitalSubscription(models.Model):
    STATUS_TRIAL = "trial"
    STATUS_ACTIVE = "active"
    STATUS_GRACE = "grace"
    STATUS_EXPIRED = "expired"
    STATUS_SUSPENDED = "suspended"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_TRIAL, "Trial"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_GRACE, "Grace Period"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_SUSPENDED, "Suspended"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    hospital = models.OneToOneField(
        Hospital,
        on_delete=models.CASCADE,
        related_name="saas_subscription",
    )

    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name="hospital_subscriptions",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_TRIAL,
        db_index=True,
    )

    started_at = models.DateTimeField(
        default=timezone.now,
    )

    trial_started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    trial_ends_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    activated_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    next_billing_date = models.DateField(
        null=True,
        blank=True,
    )

    grace_period_ends_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    service_fee_paid = models.BooleanField(
        default=False,
    )

    service_fee_paid_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    current_monthly_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    current_service_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    currency = models.CharField(
        max_length=10,
        default="USD",
    )

    auto_renew = models.BooleanField(
        default=False,
    )

    notes = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Hospital Subscription"
        verbose_name_plural = "Hospital Subscriptions"

    def __str__(self):
        return f"{self.hospital.name} - {self.plan.name}"

    @property
    def trial_is_active(self):
        if self.status != self.STATUS_TRIAL:
            return False

        if not self.trial_ends_at:
            return False

        return timezone.now() <= self.trial_ends_at

    @property
    def trial_days_remaining(self):
        if not self.trial_ends_at:
            return 0

        remaining = self.trial_ends_at - timezone.now()
        return max(0, remaining.days)


class Invoice(models.Model):
    TYPE_SERVICE_FEE = "service_fee"
    TYPE_SUBSCRIPTION = "subscription"
    TYPE_COMBINED = "combined"
    TYPE_ADJUSTMENT = "adjustment"

    TYPE_CHOICES = [
        (TYPE_SERVICE_FEE, "Platform Service Fee"),
        (TYPE_SUBSCRIPTION, "Monthly Subscription"),
        (TYPE_COMBINED, "Service Fee and Subscription"),
        (TYPE_ADJUSTMENT, "Adjustment"),
    ]

    STATUS_DRAFT = "draft"
    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_OVERDUE = "overdue"
    STATUS_CANCELLED = "cancelled"
    STATUS_VOID = "void"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PENDING, "Pending"),
        (STATUS_PAID, "Paid"),
        (STATUS_OVERDUE, "Overdue"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_VOID, "Void"),
    ]

    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.PROTECT,
        related_name="saas_invoices",
    )

    subscription = models.ForeignKey(
        HospitalSubscription,
        on_delete=models.PROTECT,
        related_name="invoices",
    )

    invoice_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )

    service_fee_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    subscription_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    adjustment_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    currency = models.CharField(
        max_length=10,
        default="USD",
    )

    issued_at = models.DateTimeField(
        default=timezone.now,
    )

    due_date = models.DateField()

    paid_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    description = models.TextField(
        blank=True,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.invoice_number

    @property
    def balance_due(self):
        return max(
            Decimal("0.00"),
            self.total_amount - self.amount_paid,
        )

    @staticmethod
    def generate_invoice_number():
        today = timezone.now().strftime("%Y%m%d")
        short_id = uuid.uuid4().hex[:8].upper()
        return f"MC-INV-{today}-{short_id}"


class Payment(models.Model):
    TYPE_SERVICE_FEE = "service_fee"
    TYPE_SUBSCRIPTION = "subscription"
    TYPE_COMBINED = "combined"

    TYPE_CHOICES = [
        (TYPE_SERVICE_FEE, "Platform Service Fee"),
        (TYPE_SUBSCRIPTION, "Monthly Subscription"),
        (TYPE_COMBINED, "Service Fee and Subscription"),
    ]

    STATUS_PENDING = "pending"
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_CANCELLED = "cancelled"
    STATUS_REFUNDED = "refunded"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SUCCESS, "Successful"),
        (STATUS_FAILED, "Failed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_REFUNDED, "Refunded"),
    ]

    GATEWAY_MANUAL = "manual"
    GATEWAY_BANK = "bank_transfer"
    GATEWAY_CASH = "cash"
    GATEWAY_MOBILE_MONEY = "mobile_money"
    GATEWAY_STRIPE = "stripe"
    GATEWAY_FLUTTERWAVE = "flutterwave"

    GATEWAY_CHOICES = [
        (GATEWAY_MANUAL, "Manual"),
        (GATEWAY_BANK, "Bank Transfer"),
        (GATEWAY_CASH, "Cash"),
        (GATEWAY_MOBILE_MONEY, "Mobile Money"),
        (GATEWAY_STRIPE, "Stripe"),
        (GATEWAY_FLUTTERWAVE, "Flutterwave"),
    ]

    payment_reference = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
    )

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.PROTECT,
        related_name="payments",
    )

    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.PROTECT,
        related_name="saas_payments",
    )

    subscription = models.ForeignKey(
        HospitalSubscription,
        on_delete=models.PROTECT,
        related_name="payments",
    )

    payment_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    currency = models.CharField(
        max_length=10,
        default="USD",
    )

    gateway = models.CharField(
        max_length=30,
        choices=GATEWAY_CHOICES,
        default=GATEWAY_MANUAL,
    )

    payment_method = models.CharField(
        max_length=100,
        blank=True,
    )

    transaction_id = models.CharField(
        max_length=150,
        blank=True,
        db_index=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )

    paid_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    gateway_response = models.JSONField(
        default=dict,
        blank=True,
    )

    notes = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.payment_reference

    @staticmethod
    def generate_reference():
        short_id = uuid.uuid4().hex[:12].upper()
        return f"MC-PAY-{short_id}"


class PlanFeature(models.Model):
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.CASCADE,
        related_name="plan_features",
    )

    feature_code = models.SlugField(
        max_length=100,
    )

    feature_name = models.CharField(
        max_length=150,
    )

    description = models.TextField(
        blank=True,
    )

    is_enabled = models.BooleanField(
        default=True,
    )

    limit_value = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Leave empty for unlimited or non-numeric features.",
    )

    configuration = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["plan", "feature_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "feature_code"],
                name="unique_feature_per_subscription_plan",
            )
        ]

    def __str__(self):
        return f"{self.plan.name}: {self.feature_name}"
