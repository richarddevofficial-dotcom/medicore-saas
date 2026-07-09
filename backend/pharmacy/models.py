from django.db import models
from hospitals.models import Hospital
from patients.models import Patient
from staff.models import StaffProfile

class MedicineCategory(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['hospital', 'name']
        verbose_name_plural = "Medicine Categories"
    def __str__(self): return self.name

class Medicine(models.Model):
    FORM_CHOICES = [
        ('tablet', 'Tablet'), ('capsule', 'Capsule'), ('syrup', 'Syrup'),
        ('injection', 'Injection'), ('cream', 'Cream'), ('drops', 'Drops'),
        ('inhaler', 'Inhaler'), ('powder', 'Powder'), ('other', 'Other'),
    ]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    category = models.ForeignKey(MedicineCategory, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=200)
    generic_name = models.CharField(max_length=200, blank=True)
    form = models.CharField(max_length=20, choices=FORM_CHOICES, default='tablet')
    strength = models.CharField(max_length=100, blank=True)
    
    # Inventory
    quantity = models.IntegerField(default=0)
    min_stock = models.IntegerField(default=10)
    max_stock = models.IntegerField(default=100)
    reorder_level = models.IntegerField(default=20)
    
    # Pricing
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Batch tracking
    batch_number = models.CharField(max_length=100, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    supplier = models.CharField(max_length=200, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    requires_prescription = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    def __str__(self):
        return f"{self.name} ({self.strength})" if self.strength else self.name
    
    @property
    def stock_status(self):
        if self.quantity <= self.min_stock: return 'critical'
        if self.quantity <= self.reorder_level: return 'low'
        if self.quantity >= self.max_stock: return 'overstock'
        return 'normal'
    
    @property
    def is_expired(self):
        if self.expiry_date:
            from datetime import date
            return self.expiry_date < date.today()
        return False
    
    @property
    def stock_value(self):
        return self.quantity * float(self.cost_price)

class StockMovement(models.Model):
    TYPES = [('in', 'Stock In'), ('out', 'Stock Out'), ('adjustment', 'Adjustment'), ('expired', 'Expired')]
    
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE)
    movement_type = models.CharField(max_length=20, choices=TYPES)
    quantity = models.IntegerField()
    reference = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']

class Prescription(models.Model):
    STATUS = [
        ('pending', 'Pending Payment'),
        ('ready', 'Ready to Dispense'),
        ('dispensed', 'Dispensed'),
        ('partial', 'Partially Dispensed'),
        ('cancelled', 'Cancelled'),
    ]
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='pharmacy_prescriptions')
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, null=True, blank=True, related_name='pharmacy_prescriptions')
    doctor = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True)
    medicine_name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=200)
    quantity_prescribed = models.IntegerField(default=1)
    medicine_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity_dispensed = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    dispensed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
