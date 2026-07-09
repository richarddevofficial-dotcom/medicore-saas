from django.db import models
from hospitals.models import Hospital

class AuditLog(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.SET_NULL, null=True, blank=True)
    user = models.CharField(max_length=200)
    role = models.CharField(max_length=50, blank=True)
    action = models.CharField(max_length=200)
    target = models.CharField(max_length=200)
    action_type = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    def __str__(self):
        return f"{self.user} - {self.action}"


class NotificationEvent(models.Model):
    TYPE_CHOICES = [
        ('otp', 'OTP'),
        ('receipt', 'Receipt'),
    ]
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]

    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    channel = models.CharField(max_length=20, default='email')
    recipient = models.CharField(max_length=255)
    subject = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    attempts = models.PositiveSmallIntegerField(default=1)
    error_message = models.TextField(blank=True)
    reference = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.notification_type}:{self.recipient}:{self.status}"
