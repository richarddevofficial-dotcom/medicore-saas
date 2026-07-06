from django.db import models
from django.contrib.auth.models import User

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
    logo = models.ImageField(upload_to='hospital_logos/', blank=True)
    
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
