from django.db import models
from hospitals.models import Hospital

class InsuranceCompany(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50)
    contact_person = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    website = models.URLField(blank=True)
    coverage_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=80)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['hospital', 'code'],
                name='uniq_insurance_company_code_per_hospital',
            ),
        ]

    def __str__(self):
        return self.name


class InsuranceClaim(models.Model):
    STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('paid', 'Paid'),
    ]
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    company = models.ForeignKey(InsuranceCompany, on_delete=models.CASCADE)
    patient_name = models.CharField(max_length=200)
    policy_number = models.CharField(max_length=100)
    claim_amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS, default='pending')
    description = models.TextField(blank=True)
    submitted_date = models.DateField(auto_now_add=True)
    processed_date = models.DateField(null=True, blank=True)
    
    class Meta:
        ordering = ['-submitted_date']
    def __str__(self):
        return f"{self.patient_name} - {self.company.name}"