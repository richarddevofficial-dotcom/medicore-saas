from django.db import models
from hospitals.models import Hospital
from patients.models import Patient

class LabTest(models.Model):
    STATUS = [
        ('requested', 'Requested'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, null=True)
    test_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, default='General')
    status = models.CharField(max_length=20, choices=STATUS, default='requested')
    result = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    def __str__(self):
        return f"{self.test_name} - {self.patient}"