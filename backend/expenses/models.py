from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from django.contrib.auth.models import User
from hospitals.models import Hospital
from departments.models import Department
from finance.models import TimestampedModel


class ExpenseCategory(TimestampedModel):
    """Types of expenses"""
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='expense_categories')
    code = models.CharField(max_length=50)  # MED-SUPPLIES, MAINTENANCE, UTILITIES, etc.
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    budget_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)  # Monthly limit
    
    class Meta:
        ordering = ['code']
        constraints = [
            models.UniqueConstraint(fields=['hospital', 'code'], name='unique_hospital_expense_code')
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Expense(TimestampedModel):
    """Individual expense record"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('paid', 'Paid'),
    ]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='expenses')
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='submitted_expenses')
    
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    expense_date = models.DateField()
    
    vendor_name = models.CharField(max_length=200, blank=True)
    invoice_number = models.CharField(max_length=100, blank=True)
    bill_attachment = models.FileField(upload_to='expense_bills/', null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True)
    
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_expenses')
    approval_date = models.DateTimeField(null=True, blank=True)
    approval_notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-expense_date', '-created_at']
        indexes = [
            models.Index(fields=['hospital', 'status']),
            models.Index(fields=['hospital', 'category']),
            models.Index(fields=['expense_date']),
        ]
    
    def __str__(self):
        return f"{self.category.code} - ₹{self.amount} - {self.expense_date}"


class ExpenseApprovalLog(TimestampedModel):
    """Track approval workflow"""
    ACTION_CHOICES = [
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('revised', 'Revised'),
    ]
    
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='approval_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    comments = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.expense} - {self.action} by {self.approved_by}"


class ExpenseBudget(TimestampedModel):
    """Track expense budgets per category/department"""
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='expense_budgets')
    category = models.ForeignKey(ExpenseCategory, on_delete=models.CASCADE)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    month = models.DateField()  # First day of month
    budgeted_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    
    class Meta:
        ordering = ['-month']
        constraints = [
            models.UniqueConstraint(
                fields=['hospital', 'category', 'department', 'month'],
                name='unique_budget_allocation'
            )
        ]
    
    def get_spent_amount(self):
        """Calculate total spent this month"""
        from django.db.models import Sum
        from datetime import date
        
        spent = Expense.objects.filter(
            hospital=self.hospital,
            category=self.category,
            status__in=['approved', 'paid'],
            expense_date__month=self.month.month,
            expense_date__year=self.month.year
        )
        
        if self.department:
            spent = spent.filter(department=self.department)
        
        total = spent.aggregate(Sum('amount'))['amount__sum'] or 0
        return total
    
    def get_remaining_budget(self):
        """Calculate remaining budget"""
        spent = self.get_spent_amount()
        return self.budgeted_amount - spent
    
    def is_exceeded(self):
        """Check if budget is exceeded"""
        return self.get_remaining_budget() < 0
    
    def __str__(self):
        return f"{self.category.code} - {self.month.strftime('%B %Y')} - ₹{self.budgeted_amount}"


class ExpensePayment(TimestampedModel):
    """Track expense payments"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processed', 'Processed'),
        ('failed', 'Failed'),
    ]
    
    expense = models.OneToOneField(Expense, on_delete=models.CASCADE, related_name='payment')
    payment_date = models.DateField(null=True, blank=True)
    payment_method = models.CharField(max_length=50)  # 'bank_transfer', 'check', 'cash'
    reference_number = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-payment_date']
    
    def __str__(self):
        return f"{self.expense} - {self.status}"
