from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from hospitals.models import Hospital
from human_resources.models import Employee
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Sum
from django.utils import timezone

class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class PayrollYear(TimestampedModel):
    """Financial year for payroll"""
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='payroll_years')
    year = models.IntegerField(unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-year']
        constraints = [
            models.UniqueConstraint(fields=['hospital', 'year'], name='unique_hospital_payroll_year')
        ]
    
    def __str__(self):
        return f"{self.hospital.name} - {self.year}"


class AllowanceType(TimestampedModel):
    """Types of allowances (HRA, DA, etc.)"""
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='allowance_types')
    code = models.CharField(max_length=50)  # HRA, DA, CONVEYANCE, etc.
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['code']
        constraints = [
            models.UniqueConstraint(fields=['hospital', 'code'], name='unique_hospital_allowance_code')
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class DeductionType(TimestampedModel):
    """Types of deductions (Tax, PF, ESI, etc.)"""
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='deduction_types')
    code = models.CharField(max_length=50)  # IT, PF, ESI, etc.
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_mandatory = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['code']
        constraints = [
            models.UniqueConstraint(fields=['hospital', 'code'], name='unique_hospital_deduction_code')
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class SalaryStructure(TimestampedModel):
    """Template for salary structure"""
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='salary_structures')
    name = models.CharField(max_length=100)  # "Doctor", "Nurse", "Admin", etc.
    description = models.TextField(blank=True)
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['hospital', 'name'], name='unique_hospital_salary_structure')
        ]
    
    def __str__(self):
        return f"{self.hospital.name} - {self.name}"


class SalaryStructureAllowance(TimestampedModel):
    """Allowances in a salary structure"""
    salary_structure = models.ForeignKey(SalaryStructure, on_delete=models.CASCADE, related_name='allowances')
    allowance_type = models.ForeignKey(AllowanceType, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    is_percentage = models.BooleanField(default=False)  # If True, amount is % of base salary
    
    class Meta:
        ordering = ['allowance_type']
        constraints = [
            models.UniqueConstraint(fields=['salary_structure', 'allowance_type'], 
                                   name='unique_structure_allowance')
        ]
    
    def __str__(self):
        return f"{self.salary_structure.name} - {self.allowance_type.code}"


class SalaryStructureDeduction(TimestampedModel):
    """Deductions in a salary structure"""
    salary_structure = models.ForeignKey(SalaryStructure, on_delete=models.CASCADE, related_name='deductions')
    deduction_type = models.ForeignKey(DeductionType, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    is_percentage = models.BooleanField(default=False)  # If True, amount is % of base salary
    
    class Meta:
        ordering = ['deduction_type']
        constraints = [
            models.UniqueConstraint(fields=['salary_structure', 'deduction_type'], 
                                   name='unique_structure_deduction')
        ]
    
    def __str__(self):
        return f"{self.salary_structure.name} - {self.deduction_type.code}"


class EmployeeSalary(TimestampedModel):
    """Employee salary assignment"""
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='salary')
    salary_structure = models.ForeignKey(SalaryStructure, on_delete=models.PROTECT)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['employee', 'salary_structure'], 
                                   name='unique_employee_salary_structure')
        ]
    
    def __str__(self):
        return f"{self.employee.user.get_full_name()} - {self.salary_structure.name}"


class SalarySlip(TimestampedModel):
    """Monthly salary slip"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('generated', 'Generated'),
        ('approved', 'Approved'),
        ('processed', 'Processed'),
        ('paid', 'Paid'),
    ]
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='salary_slips')
    month = models.DateField()  # First day of the month
    salary_structure = models.ForeignKey(SalaryStructure, on_delete=models.PROTECT)
    
    # Earnings
    base_salary = models.DecimalField(max_digits=12, decimal_places=2)
    total_allowances = models.DecimalField(max_digits=12, decimal_places=2)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2)  # base + allowances
    
    # Deductions
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Net
    net_salary = models.DecimalField(max_digits=12, decimal_places=2)  # gross - deductions
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-month']
        constraints = [
            models.UniqueConstraint(fields=['employee', 'month'], name='unique_employee_salary_slip')
        ]
    
    def __str__(self):
        return f"{self.employee.user.get_full_name()} - {self.month.strftime('%B %Y')}"


class SalarySlipEarning(TimestampedModel):
    """Individual earnings in a salary slip"""
    salary_slip = models.ForeignKey(SalarySlip, on_delete=models.CASCADE, related_name='earnings')
    allowance_type = models.ForeignKey(AllowanceType, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    class Meta:
        ordering = ['allowance_type']
    
    def __str__(self):
        return f"{self.salary_slip} - {self.allowance_type.code}: {self.amount}"


class SalarySlipDeduction(TimestampedModel):
    """Individual deductions in a salary slip"""
    salary_slip = models.ForeignKey(SalarySlip, on_delete=models.CASCADE, related_name='deductions')
    deduction_type = models.ForeignKey(DeductionType, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    class Meta:
        ordering = ['deduction_type']
    
    def __str__(self):
        return f"{self.salary_slip} - {self.deduction_type.code}: {self.amount}"


class SalaryPayment(TimestampedModel):
    """Salary payment record"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processed', 'Processed'),
        ('failed', 'Failed'),
    ]
    
    salary_slip = models.OneToOneField(SalarySlip, on_delete=models.CASCADE, related_name='payment')
    payment_date = models.DateField(null=True, blank=True)
    payment_method = models.CharField(max_length=50)  # 'bank_transfer', 'check', 'cash'
    reference_number = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-payment_date']
    
    def __str__(self):
        return f"{self.salary_slip} - {self.status}"

# ============================================================
# ACCOUNTING AND CHART OF ACCOUNTS
# ============================================================


class AccountCategory(TimestampedModel):
    """
    Groups financial accounts into categories such as:
    Current Assets, Fixed Assets, Revenue, Operating Expenses, etc.
    """

    ACCOUNT_TYPE_CHOICES = [
        ("asset", "Asset"),
        ("liability", "Liability"),
        ("equity", "Equity"),
        ("revenue", "Revenue"),
        ("expense", "Expense"),
    ]

    NORMAL_BALANCE_CHOICES = [
        ("debit", "Debit"),
        ("credit", "Credit"),
    ]

    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="finance_account_categories",
    )

    name = models.CharField(max_length=150)
    code = models.CharField(max_length=30)

    account_type = models.CharField(
        max_length=20,
        choices=ACCOUNT_TYPE_CHOICES,
    )

    normal_balance = models.CharField(
        max_length=10,
        choices=NORMAL_BALANCE_CHOICES,
    )

    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["account_type", "code"]
        verbose_name_plural = "Account categories"
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "code"],
                name="unique_hospital_account_category_code",
            ),
            models.UniqueConstraint(
                fields=["hospital", "name"],
                name="unique_hospital_account_category_name",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class ChartOfAccount(TimestampedModel):
    """
    Individual ledger account used to classify hospital transactions.

    Examples:
    1001 - Cash on Hand
    1101 - Accounts Receivable
    4001 - Consultation Revenue
    5001 - Salaries Expense
    """

    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="chart_of_accounts",
    )

    category = models.ForeignKey(
        AccountCategory,
        on_delete=models.PROTECT,
        related_name="accounts",
    )

    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="child_accounts",
        null=True,
        blank=True,
    )

    code = models.CharField(max_length=30)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    opening_balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    current_balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    allow_manual_posting = models.BooleanField(default=True)
    is_control_account = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "code"],
                name="unique_hospital_chart_account_code",
            ),
            models.UniqueConstraint(
                fields=["hospital", "name"],
                name="unique_hospital_chart_account_name",
            ),
        ]
        indexes = [
            models.Index(fields=["hospital", "code"]),
            models.Index(fields=["hospital", "is_active"]),
            models.Index(fields=["hospital", "category"]),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        errors = {}

        if self.category_id and self.hospital_id:
            if self.category.hospital_id != self.hospital_id:
                errors["category"] = (
                    "The selected category belongs to another hospital."
                )

        if self.parent_id:
            if self.parent_id == self.id:
                errors["parent"] = "An account cannot be its own parent."

            if self.hospital_id and self.parent.hospital_id != self.hospital_id:
                errors["parent"] = (
                    "The parent account belongs to another hospital."
                )

            if (
                self.category_id
                and self.parent.category.account_type
                != self.category.account_type
            ):
                errors["parent"] = (
                    "The parent account must have the same account type."
                )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()

        if self._state.adding and self.current_balance == Decimal("0.00"):
            self.current_balance = self.opening_balance

        super().save(*args, **kwargs)

    @property
    def account_type(self):
        return self.category.account_type

    @property
    def normal_balance(self):
        return self.category.normal_balance

    def __str__(self):
        return f"{self.code} - {self.name}"
class JournalSequence(TimestampedModel):
    """
    Maintains safe sequential journal numbers for each hospital and month.
    """

    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="journal_sequences",
    )
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["hospital", "-year", "-month"]
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "year", "month"],
                name="unique_journal_sequence_per_hospital_month",
            )
        ]

    def __str__(self):
        return (
            f"{self.hospital} - "
            f"{self.year}/{self.month:02d} - "
            f"{self.last_number}"
        )


class JournalEntry(TimestampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        POSTED = "posted", "Posted"
        VOID = "void", "Void"

    class EntryType(models.TextChoices):
        GENERAL = "general", "General Journal"
        SALES = "sales", "Sales"
        RECEIPT = "receipt", "Cash Receipt"
        PAYMENT = "payment", "Cash Payment"
        PURCHASE = "purchase", "Purchase"
        PAYROLL = "payroll", "Payroll"
        ADJUSTMENT = "adjustment", "Adjustment"
        OPENING = "opening", "Opening Balance"

    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.PROTECT,
        related_name="journal_entries",
    )

    journal_number = models.CharField(
        max_length=30,
        blank=True,
    )

    entry_date = models.DateField(
        default=timezone.localdate,
        db_index=True,
    )

    entry_type = models.CharField(
        max_length=20,
        choices=EntryType.choices,
        default=EntryType.GENERAL,
        db_index=True,
    )

    reference = models.CharField(
        max_length=100,
        blank=True,
    )

    description = models.TextField()

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    source_module = models.CharField(
        max_length=50,
        blank=True,
        help_text="Examples: billing, pharmacy, payroll, expenses",
    )

    source_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="ID of the originating transaction.",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_journal_entries",
    )

    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posted_journal_entries",
    )

    posted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="voided_journal_entries",
    )

    voided_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    void_reason = models.TextField(
        blank=True,
    )

    class Meta:
        ordering = ["-entry_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "journal_number"],
                name="unique_journal_number_per_hospital",
            )
        ]
        indexes = [
            models.Index(
                fields=["hospital", "entry_date"],
                name="journal_hospital_date_idx",
            ),
            models.Index(
                fields=["hospital", "status"],
                name="journal_hospital_status_idx",
            ),
            models.Index(
                fields=["source_module", "source_id"],
                name="journal_source_idx",
            ),
        ]

    def __str__(self):
        return f"{self.journal_number} - {self.description}"

    @property
    def total_debit(self):
        return (
            self.lines.aggregate(total=Sum("debit"))["total"]
            or Decimal("0.00")
        )

    @property
    def total_credit(self):
        return (
            self.lines.aggregate(total=Sum("credit"))["total"]
            or Decimal("0.00")
        )

    @property
    def is_balanced(self):
        return self.total_debit == self.total_credit

    @property
    def total_amount(self):
        return self.total_debit

    def generate_journal_number(self):
        if not self.hospital_id:
            raise ValidationError(
                {"hospital": "Hospital is required before generating a journal number."}
            )

        journal_date = self.entry_date or timezone.localdate()

        with transaction.atomic():
            sequence, _ = (
                JournalSequence.objects
                .select_for_update()
                .get_or_create(
                    hospital=self.hospital,
                    year=journal_date.year,
                    month=journal_date.month,
                    defaults={"last_number": 0},
                )
            )

            sequence.last_number += 1
            sequence.save(
                update_fields=["last_number", "updated_at"]
            )

        return (
            f"JE-{journal_date.year}"
            f"{journal_date.month:02d}-"
            f"{sequence.last_number:06d}"
        )

    def save(self, *args, **kwargs):
        if self.pk:
            original = JournalEntry.objects.filter(pk=self.pk).first()

            if original and original.status in (
                self.Status.POSTED,
                self.Status.VOID,
            ):
                protected_fields = [
                    "hospital_id",
                    "journal_number",
                    "entry_date",
                    "entry_type",
                    "reference",
                    "description",
                    "source_module",
                    "source_id",
                ]

                for field in protected_fields:
                    if getattr(original, field) != getattr(self, field):
                        raise ValidationError(
                            "Posted or void journal entries cannot be modified."
                        )

        if not self.journal_number:
            self.journal_number = self.generate_journal_number()

        return super().save(*args, **kwargs)

    @transaction.atomic
    def post(self, user=None):
        if not self.pk:
            raise ValidationError(
                "Journal entry must be saved before posting."
            )

        locked_entry = (
            JournalEntry.objects
            .select_for_update()
            .get(pk=self.pk)
        )

        if locked_entry.status != self.Status.DRAFT:
            raise ValidationError(
                "Only draft journal entries can be posted."
            )

        lines = list(
            locked_entry.lines.select_related("account")
        )

        if len(lines) < 2:
            raise ValidationError(
                "A journal entry must contain at least two lines."
            )

        total_debit = sum(
            (line.debit for line in lines),
            Decimal("0.00"),
        )

        total_credit = sum(
            (line.credit for line in lines),
            Decimal("0.00"),
        )

        if total_debit <= Decimal("0.00"):
            raise ValidationError(
                "Journal total must be greater than zero."
            )

        if total_debit != total_credit:
            raise ValidationError(
                f"Journal is not balanced. "
                f"Debit: {total_debit}, Credit: {total_credit}."
            )

        for line in lines:
            line.full_clean()

        locked_entry.status = self.Status.POSTED
        locked_entry.posted_by = user
        locked_entry.posted_at = timezone.now()

        locked_entry.save(
            update_fields=[
                "status",
                "posted_by",
                "posted_at",
                "updated_at",
            ]
        )

        self.status = locked_entry.status
        self.posted_by = locked_entry.posted_by
        self.posted_at = locked_entry.posted_at

        return locked_entry

    @transaction.atomic
    def void(self, user=None, reason=""):
        if not self.pk:
            raise ValidationError(
                "Journal entry must be saved before it can be voided."
            )

        locked_entry = (
            JournalEntry.objects
            .select_for_update()
            .get(pk=self.pk)
        )

        if locked_entry.status != self.Status.POSTED:
            raise ValidationError(
                "Only posted journal entries can be voided."
            )

        if not reason or not reason.strip():
            raise ValidationError(
                "A reason is required when voiding a journal entry."
            )

        locked_entry.status = self.Status.VOID
        locked_entry.voided_by = user
        locked_entry.voided_at = timezone.now()
        locked_entry.void_reason = reason.strip()

        locked_entry.save(
            update_fields=[
                "status",
                "voided_by",
                "voided_at",
                "void_reason",
                "updated_at",
            ]
        )

        self.status = locked_entry.status
        self.voided_by = locked_entry.voided_by
        self.voided_at = locked_entry.voided_at
        self.void_reason = locked_entry.void_reason

        return locked_entry


class JournalEntryLine(TimestampedModel):
    """
    Individual debit or credit line belonging to a journal entry.
    """

    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.CASCADE,
        related_name="lines",
    )

    account = models.ForeignKey(
        ChartOfAccount,
        on_delete=models.PROTECT,
        related_name="journal_lines",
    )

    description = models.CharField(
        max_length=255,
        blank=True,
    )

    debit = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    credit = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(
                fields=["account"],
                name="journal_line_account_idx",
            ),
            models.Index(
                fields=["journal_entry"],
                name="journal_line_entry_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(debit__gte=0),
                name="journal_line_debit_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(credit__gte=0),
                name="journal_line_credit_non_negative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(debit__gt=0, credit=0)
                    | models.Q(credit__gt=0, debit=0)
                ),
                name="journal_line_single_side_amount",
            ),
        ]

    def __str__(self):
        return (
            f"{self.journal_entry.journal_number} - "
            f"{self.account.code}"
        )

    def clean(self):
        super().clean()

        errors = {}

        debit = self.debit or Decimal("0.00")
        credit = self.credit or Decimal("0.00")

        if debit < Decimal("0.00"):
            errors["debit"] = "Debit cannot be negative."

        if credit < Decimal("0.00"):
            errors["credit"] = "Credit cannot be negative."

        if debit == Decimal("0.00") and credit == Decimal("0.00"):
            errors["debit"] = (
                "A journal line must contain either a debit "
                "or credit amount."
            )

        if debit > Decimal("0.00") and credit > Decimal("0.00"):
            errors["credit"] = (
                "A journal line cannot contain both debit "
                "and credit amounts."
            )

        if self.account_id and self.journal_entry_id:
            if (
                self.account.hospital_id
                != self.journal_entry.hospital_id
            ):
                errors["account"] = (
                    "The account must belong to the same hospital "
                    "as the journal entry."
                )

            if (
                self.journal_entry.status
                != JournalEntry.Status.DRAFT
            ):
                errors["journal_entry"] = (
                    "Lines belonging to posted or void journal "
                    "entries cannot be modified."
                )

        if self.account_id and not self.account.is_active:
            errors["account"] = (
                "Inactive accounts cannot be used in journal entries."
            )

        if (
            self.account_id
            and not self.account.allow_manual_posting
            and self.journal_entry_id
            and not self.journal_entry.source_module
        ):
            errors["account"] = (
                "Manual posting is not allowed for this account."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if (
            self.journal_entry.status
            != JournalEntry.Status.DRAFT
        ):
            raise ValidationError(
                "Lines belonging to posted or void journal "
                "entries cannot be deleted."
            )

        return super().delete(*args, **kwargs)

