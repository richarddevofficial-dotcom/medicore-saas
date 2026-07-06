from django.db import models
from hospitals.models import Hospital
from staff.models import StaffProfile

class Patient(models.Model):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    
    BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    
    STATUS_CHOICES = [
    ('registered', 'Registered'),
    ('waiting', 'Waiting for Doctor'),
    ('in_consultation', 'In Consultation'),
    ('lab_requested', 'Lab Test Requested'),
    ('lab_in_progress', 'Lab Test In Progress'),
    ('lab_completed', 'Lab Results Ready'),
    ('imaging_requested', 'Imaging Requested'),
    ('imaging_completed', 'Imaging Completed'),
    ('treated', 'Treated'),
    ('admitted', 'Admitted'),
    ('discharged', 'Discharged'),
]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='patients')
    mrn = models.CharField(max_length=20)
    
    # Personal Info
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    blood_group = models.CharField(max_length=5, blank=True)
    
    # Contact
    phone = models.CharField(max_length=20)
    alternate_phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    
    # New Fields for Reception
    national_id = models.CharField(max_length=50, blank=True, help_text="National ID / Aadhar / Passport")
    insurance_provider = models.CharField(max_length=100, blank=True)
    insurance_number = models.CharField(max_length=50, blank=True)
    
    # Emergency Contact
    emergency_contact_name = models.CharField(max_length=200, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_relation = models.CharField(max_length=50, blank=True)
    
    # Medical Info
    allergies = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    symptoms = models.TextField(blank=True)
    
    # Assignment
    assigned_doctor = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='assigned_patients', limit_choices_to={'role': 'doctor', 'is_active': True})
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='registered')
    
    # Medical Notes
    diagnosis = models.TextField(blank=True)
    treatment_plan = models.TextField(blank=True)
    prescription = models.TextField(blank=True)
    doctor_notes = models.TextField(blank=True)
    lab_test_requested = models.TextField(blank=True)
    lab_test_results = models.TextField(blank=True)
    
    # Registration
    registered_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='registered_patients')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Imaging
    imaging_requested = models.TextField(blank=True, help_text="Imaging tests requested by doctor")
    imaging_results = models.TextField(blank=True, help_text="Results from imaging")

    class Meta:
        unique_together = ['hospital', 'mrn']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.mrn})"

    def save(self, *args, **kwargs):
        if not self.mrn:
            last = Patient.objects.filter(hospital=self.hospital).order_by('-id').first()
            if last and last.mrn:
                try:
                    num = int(last.mrn.split('-')[-1]) + 1
                except:
                    num = 1
            else:
                num = 1
            self.mrn = f"{self.hospital.slug.upper()}-{num:04d}"
        super().save(*args, **kwargs)
    