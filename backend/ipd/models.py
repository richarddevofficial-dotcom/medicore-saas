import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Admission(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ADMITTED = "admitted"
    STATUS_TRANSFERRED = "transferred"
    STATUS_DISCHARGED = "discharged"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ADMITTED, "Admitted"),
        (STATUS_TRANSFERRED, "Transferred"),
        (STATUS_DISCHARGED, "Discharged"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    ADMISSION_EMERGENCY = "emergency"
    ADMISSION_ELECTIVE = "elective"
    ADMISSION_TRANSFER = "transfer"
    ADMISSION_OBSERVATION = "observation"

    ADMISSION_TYPE_CHOICES = [
        (ADMISSION_EMERGENCY, "Emergency"),
        (ADMISSION_ELECTIVE, "Elective"),
        (ADMISSION_TRANSFER, "Transfer"),
        (ADMISSION_OBSERVATION, "Observation"),
    ]

    admission_number = models.CharField(
        max_length=40,
        unique=True,
        editable=False,
    )

    hospital = models.ForeignKey(
        "hospitals.Hospital",
        on_delete=models.CASCADE,
        related_name="ipd_admissions",
    )

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.PROTECT,
        related_name="ipd_admissions",
    )

    admitting_doctor = models.ForeignKey(
        "staff.StaffProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_admissions_as_doctor",
    )

    admitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_ipd_admissions",
    )

    ward = models.ForeignKey(
        "rooms.Ward",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_admissions",
    )

    room = models.ForeignKey(
        "rooms.Room",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_admissions",
    )

    bed = models.ForeignKey(
        "rooms.Bed",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_admissions",
    )

    bed_assignment = models.ForeignKey(
        "rooms.BedAssignment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_admissions",
    )

    bill = models.ForeignKey(
        "billing.Bill",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_admissions",
    )

    admission_type = models.CharField(
        max_length=20,
        choices=ADMISSION_TYPE_CHOICES,
        default=ADMISSION_ELECTIVE,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )

    provisional_diagnosis = models.TextField()
    reason_for_admission = models.TextField()
    presenting_complaint = models.TextField(blank=True)
    admission_notes = models.TextField(blank=True)

    admitted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    expected_discharge_date = models.DateField(
        null=True,
        blank=True,
    )

    discharged_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["hospital", "status"],
            ),
            models.Index(
                fields=["hospital", "patient"],
            ),
        ]

    def __str__(self):
        return (
            f"{self.admission_number} - "
            f"{self.patient}"
        )

    def clean(self):
        errors = {}

        related_objects = {
            "patient": self.patient,
            "admitting_doctor": self.admitting_doctor,
            "ward": self.ward,
            "room": self.room,
            "bed": self.bed,
        }

        for field_name, related_object in related_objects.items():
            if (
                related_object
                and hasattr(related_object, "hospital_id")
                and related_object.hospital_id != self.hospital_id
            ):
                errors[field_name] = (
                    "The selected record belongs to "
                    "a different hospital."
                )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.admission_number:
            today = timezone.localdate()

            self.admission_number = (
                f"IPD-{today:%Y%m%d}-"
                f"{uuid.uuid4().hex[:8].upper()}"
            )

        self.full_clean()
        super().save(*args, **kwargs)


class InpatientTransfer(models.Model):
    admission = models.ForeignKey(
        Admission,
        on_delete=models.CASCADE,
        related_name="transfers",
    )

    from_ward = models.ForeignKey(
        "rooms.Ward",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_transfers_from",
    )

    from_room = models.ForeignKey(
        "rooms.Room",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_transfers_from",
    )

    from_bed = models.ForeignKey(
        "rooms.Bed",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_transfers_from",
    )

    to_ward = models.ForeignKey(
        "rooms.Ward",
        on_delete=models.PROTECT,
        related_name="ipd_transfers_to",
    )

    to_room = models.ForeignKey(
        "rooms.Room",
        on_delete=models.PROTECT,
        related_name="ipd_transfers_to",
    )

    to_bed = models.ForeignKey(
        "rooms.Bed",
        on_delete=models.PROTECT,
        related_name="ipd_transfers_to",
    )

    reason = models.TextField()

    transferred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_transfers",
    )

    transferred_at = models.DateTimeField(
        default=timezone.now,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-transferred_at"]


class NursingObservation(models.Model):
    admission = models.ForeignKey(
        Admission,
        on_delete=models.CASCADE,
        related_name="nursing_observations",
    )

    recorded_by = models.ForeignKey(
        "staff.StaffProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_nursing_observations",
    )

    temperature = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True,
    )

    pulse_rate = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    respiratory_rate = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    systolic_bp = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    diastolic_bp = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    oxygen_saturation = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )

    blood_glucose = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )

    weight_kg = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )

    fluid_intake_ml = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    fluid_output_ml = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    pain_score = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
    )

    consciousness_level = models.CharField(
        max_length=100,
        blank=True,
    )

    nursing_notes = models.TextField(blank=True)

    observed_at = models.DateTimeField(
        default=timezone.now,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-observed_at"]

    def clean(self):
        if (
            self.pain_score is not None
            and self.pain_score > 10
        ):
            raise ValidationError(
                {
                    "pain_score": (
                        "Pain score must be between 0 and 10."
                    )
                }
            )


class InpatientMedicationOrder(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_COMPLETED = "completed"
    STATUS_STOPPED = "stopped"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_STOPPED, "Stopped"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    admission = models.ForeignKey(
        Admission,
        on_delete=models.CASCADE,
        related_name="medication_orders",
    )

    medicine = models.ForeignKey(
        "pharmacy.Medicine",
        on_delete=models.PROTECT,
        related_name="ipd_medication_orders",
    )

    prescribed_by = models.ForeignKey(
        "staff.StaffProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_medication_orders",
    )

    dosage = models.CharField(max_length=100)
    route = models.CharField(
        max_length=100,
        blank=True,
    )
    frequency = models.CharField(max_length=100)
    duration = models.CharField(
        max_length=100,
        blank=True,
    )
    instructions = models.TextField(blank=True)

    start_at = models.DateTimeField(
        default=timezone.now,
    )

    end_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        db_index=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]


class MedicationAdministration(models.Model):
    medication_order = models.ForeignKey(
        InpatientMedicationOrder,
        on_delete=models.CASCADE,
        related_name="administrations",
    )

    administered_by = models.ForeignKey(
        "staff.StaffProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_medication_administrations",
    )

    administered_at = models.DateTimeField(
        default=timezone.now,
    )

    dosage_given = models.CharField(max_length=100)
    notes = models.TextField(blank=True)
    was_refused = models.BooleanField(default=False)
    refusal_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-administered_at"]


class DischargeSummary(models.Model):
    DISCHARGE_HOME = "home"
    DISCHARGE_TRANSFER = "transfer"
    DISCHARGE_AGAINST_ADVICE = "against_advice"
    DISCHARGE_DECEASED = "deceased"
    DISCHARGE_REFERRED = "referred"

    DISCHARGE_TYPE_CHOICES = [
        (DISCHARGE_HOME, "Home"),
        (DISCHARGE_TRANSFER, "Transfer"),
        (
            DISCHARGE_AGAINST_ADVICE,
            "Against Medical Advice",
        ),
        (DISCHARGE_DECEASED, "Deceased"),
        (DISCHARGE_REFERRED, "Referred"),
    ]

    admission = models.OneToOneField(
        Admission,
        on_delete=models.CASCADE,
        related_name="discharge_summary",
    )

    discharge_type = models.CharField(
        max_length=30,
        choices=DISCHARGE_TYPE_CHOICES,
        default=DISCHARGE_HOME,
    )

    final_diagnosis = models.TextField()
    clinical_summary = models.TextField()
    treatment_summary = models.TextField(blank=True)
    condition_at_discharge = models.TextField(blank=True)
    discharge_medications = models.TextField(blank=True)
    follow_up_instructions = models.TextField(blank=True)

    follow_up_date = models.DateField(
        null=True,
        blank=True,
    )

    discharged_by = models.ForeignKey(
        "staff.StaffProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ipd_discharges",
    )

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_ipd_discharges",
    )

    discharged_at = models.DateTimeField(
        default=timezone.now,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-discharged_at"]
