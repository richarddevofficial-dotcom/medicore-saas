from django.db import models
from django.db.models import Q
from hospitals.models import Hospital
from departments.models import Department
from patients.models import Patient
from staff.models import StaffProfile

class Ward(models.Model):
    """A ward is a group of rooms (e.g., General Ward, ICU, Maternity)"""
    WARD_TYPES = [
        ('general', 'General Ward'),
        ('private', 'Private Ward'),
        ('icu', 'ICU'),
        ('nicu', 'NICU'),
        ('maternity', 'Maternity'),
        ('emergency', 'Emergency'),
        ('isolation', 'Isolation'),
    ]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='wards')
    name = models.CharField(max_length=100)
    ward_type = models.CharField(max_length=20, choices=WARD_TYPES, default='general')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='wards')
    floor = models.IntegerField(default=1)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['hospital', 'name']
        ordering = ['floor', 'name']
    
    def __str__(self):
        return f"{self.name} (Floor {self.floor})"


class Room(models.Model):
    """Individual room within a ward"""
    ROOM_TYPES = [
        ('general', 'General'),
        ('private', 'Private'),
        ('deluxe', 'Deluxe'),
        ('icu', 'ICU'),
        ('operation', 'Operation Theatre'),
        ('consultation', 'Consultation Room'),
    ]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='rooms')
    ward = models.ForeignKey(Ward, on_delete=models.CASCADE, related_name='rooms')
    room_number = models.CharField(max_length=20)
    room_type = models.CharField(max_length=20, choices=ROOM_TYPES, default='general')
    floor = models.IntegerField(default=1)
    capacity = models.IntegerField(default=1)
    price_per_day = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    has_oxygen = models.BooleanField(default=False)
    has_monitor = models.BooleanField(default=False)
    is_occupied = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['hospital', 'room_number']
        ordering = ['ward__name', 'room_number']
    
    def __str__(self):
        return f"Room {self.room_number} - {self.ward.name}"


class Bed(models.Model):
    """Individual bed within a room"""
    BED_STATUS = [
        ('available', 'Available'),
        ('occupied', 'Occupied'),
        ('reserved', 'Reserved'),
        ('maintenance', 'Under Maintenance'),
        ('cleaning', 'Cleaning'),
    ]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='beds')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='beds')
    bed_number = models.CharField(max_length=20)
    bed_type = models.CharField(max_length=20, default='standard')
    status = models.CharField(max_length=20, choices=BED_STATUS, default='available')
    price_per_day = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['room', 'bed_number']
        ordering = ['room__room_number', 'bed_number']
    
    def __str__(self):
        return f"Bed {self.bed_number} - Room {self.room.room_number}"


class BedAssignment(models.Model):
    """Tracks patient-to-bed assignments including transfers and releases."""

    ASSIGNMENT_STATUS = [
        ('active', 'Active'),
        ('released', 'Released'),
        ('transferred', 'Transferred'),
    ]

    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='bed_assignments')
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='bed_assignments')
    bed = models.ForeignKey(Bed, on_delete=models.CASCADE, related_name='assignments')
    transfer_from = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transfer_children',
    )

    status = models.CharField(max_length=20, choices=ASSIGNMENT_STATUS, default='active')
    notes = models.TextField(blank=True)
    release_reason = models.TextField(blank=True)

    assigned_by = models.ForeignKey(
        StaffProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bed_assignments_created',
    )
    released_by = models.ForeignKey(
        StaffProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bed_assignments_released',
    )

    assigned_at = models.DateTimeField(auto_now_add=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-assigned_at']
        constraints = [
            models.UniqueConstraint(
                fields=['bed'],
                condition=Q(released_at__isnull=True),
                name='uniq_active_assignment_per_bed',
            ),
            models.UniqueConstraint(
                fields=['patient'],
                condition=Q(released_at__isnull=True),
                name='uniq_active_assignment_per_patient',
            ),
        ]

    def __str__(self):
        return f"Assignment(patient={self.patient_id}, bed={self.bed_id}, status={self.status})"