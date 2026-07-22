from django.db import models
from django.core.validators import MinValueValidator
from django.contrib.auth.models import User
from hospitals.models import Hospital
from departments.models import Department
from expenses.models import ExpenseCategory
from finance.models import TimestampedModel


class BudgetYear(TimestampedModel):
    """Fiscal year for budgeting"""
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='budget_years')
    year = models.IntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)  # Prevent changes after approval
    total_budget = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    
    class Meta:
        ordering = ['-year']
        constraints = [
            models.UniqueConstraint(fields=['hospital', 'year'], name='unique_hospital_budget_year')
        ]
    
    def __str__(self):
        return f"{self.hospital.name} - FY{self.year}"


class BudgetTemplate(TimestampedModel):
    """Template for budget allocation structure"""
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='budget_templates')
    name = models.CharField(max_length=100)  # "Quarterly Budget", "Monthly Budget", etc.
    description = models.TextField(blank=True)
    allocation_type = models.CharField(
        max_length=50,
        choices=[
            ('monthly', 'Monthly'),
            ('quarterly', 'Quarterly'),
            ('half-yearly', 'Half-Yearly'),
            ('annual', 'Annual'),
        ]
    )
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['hospital', 'name'], name='unique_hospital_budget_template')
        ]
    
    def __str__(self):
        return f"{self.name} ({self.allocation_type})"


class BudgetAllocation(TimestampedModel):
    """Budget allocation for a department/category in a period"""
    PERIOD_CHOICES = [
        ('month', 'Month'),
        ('quarter', 'Quarter'),
        ('half-year', 'Half-Year'),
        ('year', 'Year'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('active', 'Active'),
    ]
    
    budget_year = models.ForeignKey(BudgetYear, on_delete=models.CASCADE, related_name='allocations')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='budget_allocations')
    category = models.ForeignKey(ExpenseCategory, on_delete=models.SET_NULL, null=True, blank=True)
    
    period_type = models.CharField(max_length=20, choices=PERIOD_CHOICES, default='month')
    period_start = models.DateField()
    period_end = models.DateField()
    
    allocated_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    notes = models.TextField(blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_budgets')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_budgets')
    approved_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-period_start']
        indexes = [
            models.Index(fields=['budget_year', 'department']),
            models.Index(fields=['period_start', 'period_end']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['budget_year', 'department', 'category', 'period_start', 'period_end'],
                name='unique_budget_allocation_by_period'
            )
        ]
    
    def get_actual_spent(self):
        """Calculate actual spending for this period"""
        from django.db.models import Sum
        from expenses.models import Expense
        
        spent = Expense.objects.filter(
            hospital=self.budget_year.hospital,
            department=self.department,
            status__in=['approved', 'paid'],
            expense_date__gte=self.period_start,
            expense_date__lte=self.period_end
        )
        
        if self.category:
            spent = spent.filter(category=self.category)
        
        total = spent.aggregate(Sum('amount'))['amount__sum'] or 0
        return total
    
    def get_variance(self):
        """Calculate budget variance (positive = under budget)"""
        actual = self.get_actual_spent()
        return self.allocated_amount - actual
    
    def get_variance_percentage(self):
        """Calculate variance as percentage"""
        if self.allocated_amount == 0:
            return 0
        variance = self.get_variance()
        return (variance / self.allocated_amount) * 100
    
    def is_exceeded(self):
        """Check if budget is exceeded"""
        return self.get_actual_spent() > self.allocated_amount
    
    def __str__(self):
        period = f"{self.period_start} to {self.period_end}"
        return f"{self.department.name} - ₹{self.allocated_amount} ({period})"


class BudgetVariance(TimestampedModel):
    """Track budget vs actual variance analysis"""
    allocation = models.ForeignKey(BudgetAllocation, on_delete=models.CASCADE, related_name='variances')
    
    actual_amount = models.DecimalField(max_digits=12, decimal_places=2)
    variance_amount = models.DecimalField(max_digits=12, decimal_places=2)  # Positive = under budget
    variance_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    
    analysis = models.TextField(blank=True)  # Reason for variance
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.allocation} - Variance: {self.variance_percentage}%"


class BudgetRevision(TimestampedModel):
    """Request for budget adjustment"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    allocation = models.ForeignKey(BudgetAllocation, on_delete=models.CASCADE, related_name='revisions')
    original_amount = models.DecimalField(max_digits=12, decimal_places=2)
    revised_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    reason = models.TextField()
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    requested_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='budget_revisions')
    requested_date = models.DateTimeField(auto_now_add=True)
    
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_revisions')
    approved_date = models.DateTimeField(null=True, blank=True)
    approval_notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-requested_date']
    
    def __str__(self):
        return f"Revise {self.allocation} from ₹{self.original_amount} to ₹{self.revised_amount}"


class BudgetForecast(TimestampedModel):
    """Budget forecast for future periods"""
    CONFIDENCE_CHOICES = [
        ('low', 'Low Confidence'),
        ('medium', 'Medium Confidence'),
        ('high', 'High Confidence'),
    ]
    
    budget_year = models.ForeignKey(BudgetYear, on_delete=models.CASCADE, related_name='forecasts')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='budget_forecasts')
    category = models.ForeignKey(ExpenseCategory, on_delete=models.SET_NULL, null=True, blank=True)
    
    month = models.DateField()  # First day of month
    forecasted_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    confidence_level = models.CharField(max_length=20, choices=CONFIDENCE_CHOICES, default='medium')
    
    basis = models.TextField(blank=True)  # Basis for forecast (e.g., "historical average", "seasonal trend")
    notes = models.TextField(blank=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-month']
        constraints = [
            models.UniqueConstraint(
                fields=['budget_year', 'department', 'category', 'month'],
                name='unique_budget_forecast'
            )
        ]
    
    def __str__(self):
        return f"{self.department.name} - ₹{self.forecasted_amount} ({self.month.strftime('%B %Y')})"


class BudgetAlert(TimestampedModel):
    """Budget alerts for overspending or concerns"""
    SEVERITY_CHOICES = [
        ('info', 'Information'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('acknowledged', 'Acknowledged'),
        ('resolved', 'Resolved'),
    ]
    
    allocation = models.ForeignKey(BudgetAllocation, on_delete=models.CASCADE, related_name='alerts')
    
    title = models.CharField(max_length=200)
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='warning')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    triggered_at = models.DateTimeField(auto_now_add=True)
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_alerts')
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-triggered_at']
    
    def __str__(self):
        return f"[{self.severity.upper()}] {self.title} - {self.allocation.department.name}"
