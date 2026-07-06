from django.db import models
from hospitals.models import Hospital

class AuditLog(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
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
