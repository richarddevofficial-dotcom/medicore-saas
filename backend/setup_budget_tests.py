#!/usr/bin/env python
"""
Setup script for testing budget module
Creates superuser and sample data
Run: python manage.py shell < setup_budget_tests.py
Or: python setup_budget_tests.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User, Group
from rest_framework.authtoken.models import Token
from datetime import datetime, timedelta
from decimal import Decimal

from hospitals.models import Hospital
from departments.models import Department
from expenses.models import ExpenseCategory, Expense
from budgets.models import (
    BudgetYear, BudgetTemplate, BudgetAllocation,
    BudgetRevision, BudgetForecast, BudgetAlert
)

def create_superuser():
    """Create superuser for admin access"""
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser(
            username='admin',
            email='admin@hospital.com',
            password='admin123'
        )
        print("✅ Superuser created: admin / admin123")
    else:
        print("⚠️  Superuser 'admin' already exists")

def create_test_user():
    """Create test user with hr_manager permissions"""
    user, created = User.objects.get_or_create(
        username='testuser',
        defaults={
            'email': 'testuser@hospital.com',
            'first_name': 'Test',
            'last_name': 'User'
        }
    )
    
    if created:
        user.set_password('testpass123')
        user.save()
        print("✅ Test user created: testuser / testpass123")
    else:
        print("⚠️  Test user 'testuser' already exists")
    
    # Add to hr_manager group
    hr_group, _ = Group.objects.get_or_create(name='hr_manager')
    user.groups.add(hr_group)
    
    # Get or create token
    token, _ = Token.objects.get_or_create(user=user)
    print(f"   Token: {token.key}")
    
    return user

def create_test_data(user):
    """Create sample budget data for testing"""
    
    # Get or create hospital
    hospital, created = Hospital.objects.get_or_create(
        id=1,
        defaults={
            'name': 'Central Hospital',
            'email': 'admin@centralhospital.com',
            'phone': '9876543210'
        }
    )
    if created:
        print(f"✅ Hospital created: {hospital.name}")
    else:
        print(f"✅ Hospital retrieved: {hospital.name}")
    
    # Create departments
    dept_names = ['Finance', 'Operations', 'Maintenance', 'Administration']
    departments = []
    for dept_name in dept_names:
        dept, created = Department.objects.get_or_create(
            hospital=hospital,
            name=dept_name,
            defaults={'description': f'{dept_name} Department'}
        )
        departments.append(dept)
        if created:
            print(f"  ✅ Department created: {dept_name}")
    
    # Create expense categories
    category_names = ['Supplies', 'Utilities', 'Maintenance', 'Travel']
    for cat_name in category_names:
        category, created = ExpenseCategory.objects.get_or_create(
            hospital=hospital,
            name=cat_name,
            defaults={'description': f'{cat_name} expenses'}
        )
        if created:
            print(f"  ✅ Category created: {cat_name}")
    
    # Create budget year
    budget_year, created = BudgetYear.objects.get_or_create(
        hospital=hospital,
        year=2026,
        defaults={
            'start_date': '2026-04-01',
            'end_date': '2027-03-31',
            'total_budget': Decimal('5000000.00'),
            'is_active': True,
            'is_locked': False
        }
    )
    if created:
        print(f"✅ Budget year created: FY{budget_year.year} (₹{budget_year.total_budget})")
    else:
        print(f"✅ Budget year retrieved: FY{budget_year.year}")
    
    # Create budget templates
    templates_data = [
        ('Monthly', 'Monthly budget allocations', 'monthly'),
        ('Quarterly', 'Quarterly budget allocations', 'quarterly'),
    ]
    for name, desc, alloc_type in templates_data:
        template, created = BudgetTemplate.objects.get_or_create(
            hospital=hospital,
            name=name,
            defaults={
                'description': desc,
                'allocation_type': alloc_type,
                'is_active': True
            }
        )
        if created:
            print(f"  ✅ Template created: {name}")
    
    # Create budget allocations for each department
    print("\n📊 Creating Budget Allocations:")
    allocations = []
    for month in range(7, 9):  # July and August
        month_str = f"2026-{month:02d}"
        period_start = f"{month_str}-01"
        
        # Calculate period end
        if month == 12:
            period_end = f"{int(month_str[:4])+1}-01-01"
        else:
            period_end = f"{month_str}-{28 if month == 2 else 30 if month in [4,6,9,11] else 31}"
        
        for dept in departments[:2]:  # First 2 departments
            allocation, created = BudgetAllocation.objects.get_or_create(
                budget_year=budget_year,
                department=dept,
                period_start=period_start,
                period_end=period_end,
                defaults={
                    'period_type': 'month',
                    'allocated_amount': Decimal(f'{50000 + (dept.id * 10000)}'),
                    'status': 'approved' if month == 7 else 'draft',
                    'submitted_by': user if month == 7 else None,
                    'approved_by': user if month == 7 else None,
                    'approved_date': datetime.now() if month == 7 else None,
                }
            )
            allocations.append(allocation)
            if created:
                print(f"  ✅ {dept.name} - {period_start}: ₹{allocation.allocated_amount} ({allocation.status})")
    
    # Create budget revisions
    if allocations:
        revision, created = BudgetRevision.objects.get_or_create(
            allocation=allocations[0],
            defaults={
                'original_amount': allocations[0].allocated_amount,
                'revised_amount': Decimal('65000.00'),
                'reason': 'Increased demand for medical supplies',
                'status': 'submitted',
                'requested_by': user,
            }
        )
        if created:
            print(f"\n✅ Budget revision created: {allocations[0].department.name}")
            print(f"   Original: ₹{revision.original_amount} → Revised: ₹{revision.revised_amount}")
    
    # Create budget forecasts
    print("\n🎯 Creating Budget Forecasts:")
    for month in range(8, 10):  # August and September forecasts
        month_date = f"2026-{month:02d}-01"
        for dept in departments[:2]:
            forecast, created = BudgetForecast.objects.get_or_create(
                budget_year=budget_year,
                department=dept,
                month=month_date,
                defaults={
                    'forecasted_amount': Decimal(f'{55000 + (dept.id * 10000)}'),
                    'confidence_level': 'high' if month == 8 else 'medium',
                    'basis': 'historical average' if dept.id % 2 == 0 else 'seasonal trend',
                    'created_by': user,
                }
            )
            if created:
                print(f"  ✅ {dept.name} - {month_date}: ₹{forecast.forecasted_amount} ({forecast.confidence_level})")
    
    # Create budget alerts
    if allocations:
        alert, created = BudgetAlert.objects.get_or_create(
            allocation=allocations[0],
            defaults={
                'title': 'High Spending Alert',
                'description': 'This department is approaching 80% of allocated budget',
                'severity': 'warning',
                'status': 'active',
            }
        )
        if created:
            print(f"\n✅ Budget alert created: {alert.title}")
    
    print("\n" + "="*60)
    print("✅ SETUP COMPLETE - Test Data Ready")
    print("="*60)
    print("\n📍 Access Points:")
    print("   Django Admin: http://127.0.0.1:8000/admin/")
    print("   Budget Years: http://127.0.0.1:8000/admin/budgets/budgetyear/")
    print("   Allocations: http://127.0.0.1:8000/admin/budgets/budgetallocation/")
    print("   API Endpoint: http://127.0.0.1:8000/api/v1/budgets/")
    print("\n👤 Credentials:")
    print("   Superuser: admin / admin123")
    print("   Test User: testuser / testpass123")
    print("\n")

if __name__ == '__main__':
    print("🚀 Starting Budget Module Setup...\n")
    create_superuser()
    print()
    user = create_test_user()
    print()
    create_test_data(user)
