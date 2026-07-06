from django.db import models
from hospitals.models import Hospital
from patients.models import Patient
from staff.models import StaffProfile

class ImagingTest(models.Model):
    TYPES = [
        ('xray', 'X-Ray'),
        ('mri', 'MRI'),
        ('ct', 'CT Scan'),
        ('ultrasound', 'Ultrasound'),
        ('mammogram', 'Mammogram'),
        ('other', 'Other'),
    ]
    
    STATUS = [
        ('requested', 'Requested'),
        ('scheduled', 'Scheduled'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, null=True, blank=True)
    patient_name = models.CharField(max_length=200, blank=True)
    test_type = models.CharField(max_length=20, choices=TYPES)
    body_part = models.CharField(max_length=100)
    doctor = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, limit_choices_to={'role': 'doctor'})
    status = models.CharField(max_length=20, choices=STATUS, default='requested')
    notes = models.TextField(blank=True)
    result = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    def __str__(self):
        return f"{self.get_test_type_display()} - {self.patient_name}"
