from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class JobPosition(TimestampedModel):
    hospital = models.ForeignKey(
        "hospitals.Hospital",
        on_delete=models.CASCADE,
        related_name="hr_job_positions",
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="job_positions",
    )
    title = models.CharField(max_length=150)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    minimum_salary = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    maximum_salary = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "code"],
                name="unique_hr_position_code_per_hospital",
            )
        ]

    def __str__(self):
        return f"{self.title} - {self.hospital}"


class Employee(TimestampedModel):
    EMPLOYMENT_TYPES = [
        ("PERMANENT", "Permanent"),
        ("CONTRACT", "Contract"),
        ("PART_TIME", "Part-time"),
        ("TEMPORARY", "Temporary"),
        ("INTERN", "Intern"),
        ("VOLUNTEER", "Volunteer"),
    ]

    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("PROBATION", "Probation"),
        ("SUSPENDED", "Suspended"),
        ("ON_LEAVE", "On leave"),
        ("RESIGNED", "Resigned"),
        ("TERMINATED", "Terminated"),
        ("RETIRED", "Retired"),
    ]

    GENDER_CHOICES = [
        ("MALE", "Male"),
        ("FEMALE", "Female"),
        ("OTHER", "Other"),
        ("PREFER_NOT_TO_SAY", "Prefer not to say"),
    ]

    hospital = models.ForeignKey(
        "hospitals.Hospital",
        on_delete=models.CASCADE,
        related_name="hr_employees",
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_profile",
    )
    employee_number = models.CharField(max_length=50)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)

    gender = models.CharField(
        max_length=20,
        choices=GENDER_CHOICES,
        blank=True,
    )
    date_of_birth = models.DateField(null=True, blank=True)
    national_id = models.CharField(max_length=100, blank=True)
    passport_number = models.CharField(max_length=100, blank=True)

    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    alternative_phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)

    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_employees",
    )
    position = models.ForeignKey(
        JobPosition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )
    reports_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="direct_reports",
    )

    employment_type = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_TYPES,
        default="PERMANENT",
    )
    employment_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="ACTIVE",
    )
    hire_date = models.DateField(default=timezone.localdate)
    confirmation_date = models.DateField(null=True, blank=True)
    termination_date = models.DateField(null=True, blank=True)

    bank_name = models.CharField(max_length=150, blank=True)
    bank_account_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=100, blank=True)
    tax_number = models.CharField(max_length=100, blank=True)

    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=30, blank=True)
    emergency_contact_relationship = models.CharField(max_length=100, blank=True)

    photo = models.ImageField(
        upload_to="hr/employees/photos/",
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["first_name", "last_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "employee_number"],
                name="unique_employee_number_per_hospital",
            )
        ]
        indexes = [
            models.Index(fields=["hospital", "employment_status"]),
            models.Index(fields=["hospital", "department"]),
            models.Index(fields=["employee_number"]),
        ]

    @property
    def full_name(self):
        names = [
            self.first_name,
            self.middle_name,
            self.last_name,
        ]
        return " ".join(name for name in names if name)

    def __str__(self):
        return f"{self.employee_number} - {self.full_name}"


class EmploymentContract(TimestampedModel):
    CONTRACT_STATUS = [
        ("DRAFT", "Draft"),
        ("ACTIVE", "Active"),
        ("EXPIRED", "Expired"),
        ("TERMINATED", "Terminated"),
        ("RENEWED", "Renewed"),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="contracts",
    )
    contract_number = models.CharField(max_length=60)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    probation_end_date = models.DateField(null=True, blank=True)

    basic_salary = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    currency = models.CharField(max_length=10, default="SSP")
    working_hours_per_week = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=40,
        validators=[MinValueValidator(0)],
    )
    status = models.CharField(
        max_length=20,
        choices=CONTRACT_STATUS,
        default="ACTIVE",
    )
    terms = models.TextField(blank=True)
    document = models.FileField(
        upload_to="hr/contracts/",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-start_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "contract_number"],
                name="unique_contract_number_per_employee",
            )
        ]

    def __str__(self):
        return f"{self.contract_number} - {self.employee.full_name}"


class EmployeeDocument(TimestampedModel):
    DOCUMENT_TYPES = [
        ("NATIONAL_ID", "National ID"),
        ("PASSPORT", "Passport"),
        ("CV", "Curriculum Vitae"),
        ("CERTIFICATE", "Certificate"),
        ("CONTRACT", "Contract"),
        ("LICENSE", "Professional license"),
        ("MEDICAL", "Medical record"),
        ("OTHER", "Other"),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    document_type = models.CharField(
        max_length=30,
        choices=DOCUMENT_TYPES,
    )
    title = models.CharField(max_length=150)
    document_number = models.CharField(max_length=100, blank=True)
    issued_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    file = models.FileField(upload_to="hr/employee-documents/")
    notes = models.TextField(blank=True)
    is_verified = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.employee.full_name}"


class Shift(TimestampedModel):
    hospital = models.ForeignKey(
        "hospitals.Hospital",
        on_delete=models.CASCADE,
        related_name="hr_shifts",
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=0)
    is_night_shift = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["start_time"]
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "code"],
                name="unique_shift_code_per_hospital",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.start_time} - {self.end_time})"


class ShiftAssignment(TimestampedModel):
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="shift_assignments",
    )
    shift = models.ForeignKey(
        Shift,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.employee.full_name} - {self.shift.name}"


class Attendance(TimestampedModel):
    STATUS_CHOICES = [
        ("PRESENT", "Present"),
        ("ABSENT", "Absent"),
        ("LATE", "Late"),
        ("HALF_DAY", "Half day"),
        ("ON_LEAVE", "On leave"),
        ("OFF_DUTY", "Off duty"),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    attendance_date = models.DateField(default=timezone.localdate)
    shift = models.ForeignKey(
        Shift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records",
    )
    clock_in = models.DateTimeField(null=True, blank=True)
    clock_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PRESENT",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-attendance_date", "-clock_in"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "attendance_date"],
                name="unique_employee_attendance_per_day",
            )
        ]

    def __str__(self):
        return f"{self.employee.full_name} - {self.attendance_date}"


class LeaveType(TimestampedModel):
    hospital = models.ForeignKey(
        "hospitals.Hospital",
        on_delete=models.CASCADE,
        related_name="hr_leave_types",
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30)
    days_allowed = models.PositiveIntegerField(default=0)
    is_paid = models.BooleanField(default=True)
    requires_document = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "code"],
                name="unique_leave_type_code_per_hospital",
            )
        ]

    def __str__(self):
        return self.name




def _default_leave_year():
    return timezone.localdate().year


class LeaveBalance(TimestampedModel):
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="leave_balances",
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name="employee_balances",
    )
    year = models.PositiveIntegerField(
        default=_default_leave_year,
    )

    allocated_days = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    carried_forward_days = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    adjustment_days = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=0,
    )
    used_days = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    pending_days = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = [
            "-year",
            "employee__first_name",
            "leave_type__name",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "employee",
                    "leave_type",
                    "year",
                ],
                name="unique_employee_leave_balance_per_year",
            )
        ]
        indexes = [
            models.Index(fields=["year", "is_active"]),
            models.Index(fields=["employee", "year"]),
        ]

    @property
    def total_entitlement(self):
        return (
            self.allocated_days
            + self.carried_forward_days
            + self.adjustment_days
        )

    @property
    def remaining_days(self):
        return self.total_entitlement - self.used_days

    @property
    def available_days(self):
        return self.remaining_days - self.pending_days

    def __str__(self):
        return (
            f"{self.employee.full_name} - "
            f"{self.leave_type.name} ({self.year})"
        )
class LeaveRequest(TimestampedModel):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("CANCELLED", "Cancelled"),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="leave_requests",
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.PROTECT,
        related_name="leave_requests",
    )
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.PositiveIntegerField(default=1)
    reason = models.TextField()
    supporting_document = models.FileField(
        upload_to="hr/leave-documents/",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_hr_leave_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "start_date"]),
        ]

    def __str__(self):
        return f"{self.employee.full_name} - {self.leave_type.name}"
