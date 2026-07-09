from django.db import models
from django.contrib.auth.models import User
import uuid

class Hospital(models.Model):
    HOSPITAL_TYPES = [
        ('general', 'General Hospital'),
        ('specialty', 'Specialty Hospital'),
        ('clinic', 'Clinic'),
        ('diagnostic', 'Diagnostic Center'),
    ]
    
    SUBSCRIPTION_PLANS = [
        ('trial', '14-Day Free Trial'),
        ('basic', 'Basic'),
        ('pro', 'Professional'),
        ('enterprise', 'Enterprise'),
    ]

    DOMAIN_STATUS_CHOICES = [
        ('unconfigured', 'Unconfigured'),
        ('pending', 'Pending Verification'),
        ('verified', 'Verified'),
        ('failed', 'Failed Verification'),
    ]
    
    # Basic Info
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    hospital_type = models.CharField(max_length=20, choices=HOSPITAL_TYPES)
    registration_number = models.CharField(max_length=100, unique=True)
    
    # Contact
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    website = models.URLField(blank=True)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100, default='South Sudan')
    
    # Subscription
    subscription_plan = models.CharField(max_length=20, choices=SUBSCRIPTION_PLANS, default='trial')
    subscription_status = models.CharField(max_length=20, default='active')
    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    max_staff = models.IntegerField(default=5)
    max_patients = models.IntegerField(default=500)
    
    # Branding
    # Settings
    timezone = models.CharField(max_length=50, default='Africa/Juba')
    currency = models.CharField(max_length=10, default='SSP')
    
    # Status
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Branding / White Labeling
    primary_color = models.CharField(max_length=20, default='#F97316')
    secondary_color = models.CharField(max_length=20, default='#1E3A5F')
    logo = models.ImageField(upload_to='hospital_logos/', blank=True)
    custom_domain = models.CharField(max_length=200, blank=True)
    domain_status = models.CharField(
        max_length=20,
        choices=DOMAIN_STATUS_CHOICES,
        default='unconfigured',
    )
    domain_verification_token = models.CharField(max_length=64, blank=True)
    domain_verified_at = models.DateTimeField(null=True, blank=True)
    domain_last_checked_at = models.DateTimeField(null=True, blank=True)
    domain_last_resolved_ip = models.CharField(max_length=64, blank=True)
    domain_ssl_status = models.CharField(max_length=20, default='unknown')
    domain_ssl_expires_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name
    
    @property
    def is_trial_active(self):
        if self.subscription_plan == 'trial' and self.trial_end:
            from django.utils import timezone
            return timezone.now() < self.trial_end
        return False
    
    @property
    def days_left(self):
        if self.trial_end:
            from django.utils import timezone
            delta = self.trial_end - timezone.now()
            return max(0, delta.days)
        return 0


class LoginOTP(models.Model):
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('sms', 'SMS'),
    ]

    session_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_otps')
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES, default='email')
    destination = models.CharField(max_length=255)
    code_hash = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP({self.user.username}) - {self.channel}"


class TrustedDevice(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trusted_devices')
    token_hash = models.CharField(max_length=64, unique=True)
    device_fingerprint = models.CharField(max_length=64)
    first_ip = models.CharField(max_length=64, blank=True)
    last_ip = models.CharField(max_length=64, blank=True)
    last_user_agent = models.CharField(max_length=500, blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        return f"TrustedDevice({self.user.username})"


class PlatformSuperAdminProfile(models.Model):
    ADMIN_TYPES = [
        ('primary', 'Primary'),
        ('secondary', 'Secondary'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='platform_super_admin_profile')
    admin_type = models.CharField(max_length=20, choices=ADMIN_TYPES, default='secondary')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"PlatformSuperAdminProfile({self.user.email}, {self.admin_type})"
