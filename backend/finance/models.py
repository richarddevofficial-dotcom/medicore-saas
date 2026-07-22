from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from hospitals.models import Hospital
from human_resources.models import Employee


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
