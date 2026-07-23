#!/usr/bin/env python
"""
Test script for budget module API
Run: python test_budget_api.py
"""

import os
import django
import sys
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from hospitals.models import Hospital
from departments.models import Department
from budgets.models import BudgetYear, BudgetAllocation, BudgetRevision, BudgetForecast, BudgetAlert

def setup_test_user():
    """Create a test user with hr_manager permissions"""
    # Get or create hospital
    hospital, _ = Hospital.objects.get_or_create(
        id=1,
        defaults={
            'name': 'Test Hospital',
            'email': 'test@hospital.com',
            'phone': '9876543210'
        }
    )
    
    # Get or create department
    department, _ = Department.objects.get_or_create(
        id=1,
        hospital=hospital,
        defaults={
            'name': 'Finance',
            'description': 'Finance Department'
        }
    )
    
    # Get or create user
    user, created = User.objects.get_or_create(
        username='testuser',
        defaults={
            'email': 'testuser@example.com',
            'first_name': 'Test',
            'last_name': 'User'
        }
    )
    
    if created:
        user.set_password('testpass123')
        user.save()
    
    # Add to hr_manager group
    hr_group, _ = Group.objects.get_or_create(name='hr_manager')
    user.groups.add(hr_group)
    
    # Get or create token
    token, _ = Token.objects.get_or_create(user=user)
    
    print(f"✅ Test user created/retrieved: {user.username}")
    print(f"✅ Token: {token.key}")
    print(f"✅ Hospital: {hospital.name}")
    print(f"✅ Department: {department.name}\n")
    
    return token.key, hospital, department, user

def test_budget_api(token):
    """Test budget API endpoints"""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
    
    print("=" * 60)
    print("TESTING BUDGET API ENDPOINTS")
    print("=" * 60)
    
    # 1. Create Budget Year
    print("\n1️⃣  CREATE BUDGET YEAR")
    print("-" * 60)
    budget_year_data = {
        'year': 2026,
        'start_date': '2026-04-01',
        'end_date': '2027-03-31',
        'total_budget': '1000000.00',
        'is_active': True,
        'is_locked': False
    }
    response = client.post('/api/v1/budgets/years/', budget_year_data, format='json')
    print(f"Status: {response.status_code}")
    
    if response.status_code in [201, 400]:
        print(f"Response: {response.json()}")
        if response.status_code == 201:
            budget_year_id = response.json()['id']
        else:
            # Try to get existing
            list_response = client.get('/api/v1/budgets/years/', format='json')
            if list_response.json():
                budget_year_id = list_response.json()[0]['id']
            else:
                budget_year_id = 1
    else:
        print(f"Error: {response.text}")
        return
    
    # 2. List Budget Years
    print("\n2️⃣  LIST BUDGET YEARS")
    print("-" * 60)
    response = client.get('/api/v1/budgets/years/', format='json')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        years = response.json()
        print(f"Total budget years: {len(years)}")
        if years:
            year = years[0]
            print(f"  - Year {year['year']}: ₹{year['total_budget']} (Active: {year['is_active']})")
    
    # 3. Create Budget Allocation
    print("\n3️⃣  CREATE BUDGET ALLOCATION")
    print("-" * 60)
    allocation_data = {
        'budget_year': budget_year_id,
        'department': 1,
        'period_type': 'month',
        'period_start': '2026-07-01',
        'period_end': '2026-07-31',
        'allocated_amount': '50000.00',
        'notes': 'July 2026 budget'
    }
    response = client.post('/api/v1/budgets/allocations/', allocation_data, format='json')
    print(f"Status: {response.status_code}")
    
    if response.status_code in [201, 400]:
        data = response.json()
        print(f"Response: {data}")
        if response.status_code == 201:
            allocation_id = data['id']
        else:
            # Get existing
            list_response = client.get('/api/v1/budgets/allocations/', format='json')
            if list_response.json():
                allocation_id = list_response.json()[0]['id']
            else:
                allocation_id = 1
    else:
        print(f"Error: {response.text}")
        return
    
    # 4. Get Allocation Details (with calculated fields)
    print("\n4️⃣  GET ALLOCATION DETAILS")
    print("-" * 60)
    response = client.get(f'/api/v1/budgets/allocations/{allocation_id}/', format='json')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        allocation = response.json()
        print(f"  - Allocated: ₹{allocation['allocated_amount']}")
        print(f"  - Spent: ₹{allocation['actual_spent']}")
        print(f"  - Variance: ₹{allocation['variance']} ({allocation['variance_percentage']}%)")
        print(f"  - Exceeded: {allocation['is_exceeded']}")
        print(f"  - Status: {allocation['status']}")
    
    # 5. Submit Allocation for Approval
    print("\n5️⃣  SUBMIT ALLOCATION FOR APPROVAL")
    print("-" * 60)
    response = client.post(f'/api/v1/budgets/allocations/{allocation_id}/submit/', format='json')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("✅ Successfully submitted for approval")
        print(f"  Status: {response.json()['status']}")
    elif response.status_code == 400:
        print(f"⚠️  {response.json()}")
    
    # 6. Approve Allocation
    print("\n6️⃣  APPROVE ALLOCATION")
    print("-" * 60)
    response = client.post(f'/api/v1/budgets/allocations/{allocation_id}/approve/', format='json')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("✅ Successfully approved")
        print(f"  Status: {response.json()['status']}")
    elif response.status_code == 400:
        print(f"⚠️  {response.json()}")
    
    # 7. Pending Approvals
    print("\n7️⃣  GET PENDING APPROVALS")
    print("-" * 60)
    response = client.get('/api/v1/budgets/allocations/pending_approval/', format='json')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        pending = response.json()
        print(f"Pending allocations: {len(pending)}")
        if pending:
            for p in pending:
                print(f"  - {p['department_name']}: ₹{p['allocated_amount']} ({p['status']})")
    
    # 8. Create Budget Revision
    print("\n8️⃣  CREATE BUDGET REVISION")
    print("-" * 60)
    revision_data = {
        'allocation': allocation_id,
        'revised_amount': '60000.00',
        'reason': 'Increased demand for Q2'
    }
    response = client.post('/api/v1/budgets/revisions/', revision_data, format='json')
    print(f"Status: {response.status_code}")
    if response.status_code in [201, 400]:
        data = response.json()
        print(f"Response: {data}")
        if response.status_code == 201:
            revision_id = data['id']
            print(f"✅ Revision created (ID: {revision_id})")
    
    # 9. Create Budget Forecast
    print("\n9️⃣  CREATE BUDGET FORECAST")
    print("-" * 60)
    forecast_data = {
        'budget_year': budget_year_id,
        'department': 1,
        'month': '2026-08-01',
        'forecasted_amount': '55000.00',
        'confidence_level': 'high',
        'basis': 'historical average'
    }
    response = client.post('/api/v1/budgets/forecasts/', forecast_data, format='json')
    print(f"Status: {response.status_code}")
    if response.status_code in [201, 400]:
        data = response.json()
        print(f"Response: {data}")
        if response.status_code == 201:
            print("✅ Forecast created")
    
    # 10. Get Forecasts by Department
    print("\n🔟 GET FORECASTS BY DEPARTMENT")
    print("-" * 60)
    response = client.get(f'/api/v1/budgets/forecasts/by_department/?budget_year={budget_year_id}', format='json')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        forecasts = response.json()
        print(f"Departments with forecasts: {len(forecasts)}")
        for dept in forecasts:
            print(f"  - {dept['department_name']}: ₹{dept['total_forecast']}")
    
    # 11. Variance Report
    print("\n1️⃣1️⃣  VARIANCE REPORT")
    print("-" * 60)
    response = client.get(f'/api/v1/budgets/allocations/variance_report/?budget_year={budget_year_id}', format='json')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        variances = response.json()
        print(f"Total allocations: {len(variances)}")
        for v in variances:
            print(f"  - {v['department']}: {v['variance_percentage']:.1f}% variance " +
                  f"(Allocated: ₹{v['allocated']}, Spent: ₹{v['actual_spent']})")
    
    # 12. Create Budget Alert
    print("\n1️⃣2️⃣  CREATE BUDGET ALERT")
    print("-" * 60)
    alert_data = {
        'allocation': allocation_id,
        'title': 'Budget Alert',
        'description': 'This is a test alert for the budget module',
        'severity': 'warning',
        'status': 'active'
    }
    response = client.post('/api/v1/budgets/alerts/', alert_data, format='json')
    print(f"Status: {response.status_code}")
    if response.status_code in [201, 400]:
        data = response.json()
        if response.status_code == 201:
            alert_id = data['id']
            print(f"✅ Alert created (ID: {alert_id})")
            print(f"  Severity: {data['severity']}")
        else:
            print(f"Response: {data}")
    
    # 13. Active Alerts
    print("\n1️⃣3️⃣  GET ACTIVE ALERTS")
    print("-" * 60)
    response = client.get('/api/v1/budgets/alerts/active_alerts/', format='json')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        alerts = response.json()
        print(f"Active alerts: {len(alerts)}")
        if alerts:
            for alert in alerts[:3]:
                print(f"  - [{alert['severity']}] {alert['title']}")
    
    print("\n" + "=" * 60)
    print("✅ BUDGET API TESTING COMPLETE")
    print("=" * 60)

if __name__ == '__main__':
    print("🚀 Starting Budget API Test...\n")
    token, hospital, department, user = setup_test_user()
    test_budget_api(token)
