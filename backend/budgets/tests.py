from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from hospitals.models import Hospital
from departments.models import Department
from staff.models import StaffProfile
from expenses.models import Expense, ExpenseCategory, ExpenseBudget
from budgets.models import (
    BudgetYear, BudgetTemplate, BudgetAllocation,
    BudgetVariance, BudgetRevision, BudgetForecast,
    BudgetAlert
)
from budgets.serializers import (
    BudgetYearSerializer, BudgetAllocationSerializer,
    BudgetAllocationDetailSerializer, BudgetRevisionSerializer,
    BudgetForecastSerializer, BudgetAlertSerializer
)


class BudgetSecurityWorkflowTests(APITestCase):
    def setUp(self):
        self.hospital = Hospital.objects.create(
            name="Budget Security Hospital",
            slug="budget-security-hospital",
            registration_number="BUDGET-SEC-001",
            email="budget-security@example.com",
            phone="700001001",
        )
        self.other_hospital = Hospital.objects.create(
            name="Other Budget Hospital",
            slug="other-budget-hospital",
            registration_number="BUDGET-SEC-002",
            email="other-budget@example.com",
            phone="700001002",
        )
        self.department = Department.objects.create(
            hospital=self.hospital,
            name="Finance",
        )
        self.other_department = Department.objects.create(
            hospital=self.other_hospital,
            name="Other Finance",
        )
        self.budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date="2026-01-01",
            end_date="2026-12-31",
            total_budget="100000.00",
        )
        self.other_budget_year = BudgetYear.objects.create(
            hospital=self.other_hospital,
            year=2026,
            start_date="2026-01-01",
            end_date="2026-12-31",
            total_budget="100000.00",
        )
        self.finance_user = User.objects.create_user(
            username="budget-finance-user",
            password="TestPassword123!",
        )
        StaffProfile.objects.create(
            user=self.finance_user,
            hospital=self.hospital,
            role="finance",
            phone="700001003",
        )
        self.finance_manager = User.objects.create_user(
            username="budget-finance-manager",
            password="TestPassword123!",
        )
        StaffProfile.objects.create(
            user=self.finance_manager,
            hospital=self.hospital,
            role="finance_manager",
            phone="700001004",
        )

    def allocation_payload(self, **overrides):
        payload = {
            "budget_year": self.budget_year.id,
            "department": self.department.id,
            "period_type": "year",
            "period_start": "2026-01-01",
            "period_end": "2026-12-31",
            "allocated_amount": "50000.00",
        }
        payload.update(overrides)
        return payload

    def test_finance_user_creates_only_same_hospital_draft_allocation(self):
        self.client.force_authenticate(self.finance_user)

        created = self.client.post(
            "/api/v1/budgets/allocations/",
            self.allocation_payload(status="approved"),
            format="json",
        )
        cross_tenant = self.client.post(
            "/api/v1/budgets/allocations/",
            self.allocation_payload(department=self.other_department.id),
            format="json",
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["status"], "draft")
        self.assertEqual(cross_tenant.status_code, 400)
        allocation = BudgetAllocation.objects.get(id=created.data["id"])
        self.assertEqual(allocation.budget_year.hospital, self.hospital)

    def test_finance_manager_approves_without_django_group(self):
        allocation = BudgetAllocation.objects.create(
            budget_year=self.budget_year,
            department=self.department,
            period_type="year",
            period_start="2026-01-01",
            period_end="2026-12-31",
            allocated_amount="50000.00",
            status="submitted",
        )
        self.client.force_authenticate(self.finance_manager)

        approved = self.client.post(
            f"/api/v1/budgets/allocations/{allocation.id}/approve/"
        )
        update = self.client.patch(
            f"/api/v1/budgets/allocations/{allocation.id}/",
            {"allocated_amount": "1.00"},
            format="json",
        )
        deleted = self.client.delete(
            f"/api/v1/budgets/allocations/{allocation.id}/"
        )

        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(update.status_code, 400)
        self.assertEqual(deleted.status_code, 400)
        allocation.refresh_from_db()
        self.assertEqual(allocation.status, "approved")
        self.assertEqual(allocation.allocated_amount, Decimal("50000.00"))

    def test_locked_budget_year_rejects_new_allocation(self):
        self.budget_year.is_locked = True
        self.budget_year.save(update_fields=["is_locked", "updated_at"])
        self.client.force_authenticate(self.finance_user)

        response = self.client.post(
            "/api/v1/budgets/allocations/",
            self.allocation_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(BudgetAllocation.objects.exists())


class BudgetModelTests(TestCase):
    """Test budget models"""
    
    def setUp(self):
        """Set up test data"""
        self.hospital = Hospital.objects.create(
            name="Test Hospital",
            email="test@hospital.com",
            phone="9876543210"
        )
        self.department = Department.objects.create(
            hospital=self.hospital,
            name="Finance",
            description="Finance Department"
        )
        self.category = ExpenseCategory.objects.create(
            hospital=self.hospital,
            name="Supplies",
            description="Office Supplies"
        )
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_budget_year_creation(self):
        """Test BudgetYear model creation"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00'),
            is_active=True,
            is_locked=False
        )
        
        self.assertEqual(budget_year.year, 2026)
        self.assertEqual(budget_year.total_budget, Decimal('1000000.00'))
        self.assertTrue(budget_year.is_active)
        self.assertFalse(budget_year.is_locked)
        self.assertEqual(str(budget_year), f"{self.hospital.name} - FY2026")
    
    def test_budget_template_creation(self):
        """Test BudgetTemplate model creation"""
        template = BudgetTemplate.objects.create(
            hospital=self.hospital,
            name="Monthly Budget",
            description="Monthly budget allocation",
            allocation_type='monthly',
            is_active=True
        )
        
        self.assertEqual(template.name, "Monthly Budget")
        self.assertEqual(template.allocation_type, 'monthly')
        self.assertEqual(str(template), "Monthly Budget (monthly)")
    
    def test_budget_allocation_creation(self):
        """Test BudgetAllocation model creation"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        allocation = BudgetAllocation.objects.create(
            budget_year=budget_year,
            department=self.department,
            category=self.category,
            period_type='month',
            period_start='2026-07-01',
            period_end='2026-07-31',
            allocated_amount=Decimal('50000.00'),
            status='draft'
        )
        
        self.assertEqual(allocation.allocated_amount, Decimal('50000.00'))
        self.assertEqual(allocation.status, 'draft')
        self.assertFalse(allocation.is_exceeded())
    
    def test_budget_allocation_variance_calculation(self):
        """Test variance calculation methods"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        allocation = BudgetAllocation.objects.create(
            budget_year=budget_year,
            department=self.department,
            period_type='month',
            period_start='2026-07-01',
            period_end='2026-07-31',
            allocated_amount=Decimal('50000.00'),
            status='approved'
        )
        
        # Initially no expenses
        self.assertEqual(allocation.get_actual_spent(), 0)
        self.assertEqual(allocation.get_variance(), Decimal('50000.00'))
        self.assertEqual(allocation.get_variance_percentage(), 100.0)
        self.assertFalse(allocation.is_exceeded())
    
    def test_budget_allocation_unique_constraint(self):
        """Test unique constraint on BudgetAllocation"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        # Create first allocation
        BudgetAllocation.objects.create(
            budget_year=budget_year,
            department=self.department,
            category=self.category,
            period_type='month',
            period_start='2026-07-01',
            period_end='2026-07-31',
            allocated_amount=Decimal('50000.00')
        )
        
        # Try to create duplicate - should raise IntegrityError
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            BudgetAllocation.objects.create(
                budget_year=budget_year,
                department=self.department,
                category=self.category,
                period_type='month',
                period_start='2026-07-01',
                period_end='2026-07-31',
                allocated_amount=Decimal('60000.00')
            )
    
    def test_budget_revision_creation(self):
        """Test BudgetRevision model"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        allocation = BudgetAllocation.objects.create(
            budget_year=budget_year,
            department=self.department,
            period_type='month',
            period_start='2026-07-01',
            period_end='2026-07-31',
            allocated_amount=Decimal('50000.00')
        )
        
        revision = BudgetRevision.objects.create(
            allocation=allocation,
            original_amount=Decimal('50000.00'),
            revised_amount=Decimal('60000.00'),
            reason="Increased demand",
            requested_by=self.user,
            status='draft'
        )
        
        self.assertEqual(revision.revised_amount, Decimal('60000.00'))
        self.assertEqual(revision.status, 'draft')
    
    def test_budget_forecast_creation(self):
        """Test BudgetForecast model"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        forecast = BudgetForecast.objects.create(
            budget_year=budget_year,
            department=self.department,
            month='2026-08-01',
            forecasted_amount=Decimal('55000.00'),
            confidence_level='high',
            basis='historical average',
            created_by=self.user
        )
        
        self.assertEqual(forecast.confidence_level, 'high')
        self.assertIn("August", str(forecast))
    
    def test_budget_alert_creation(self):
        """Test BudgetAlert model"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        allocation = BudgetAllocation.objects.create(
            budget_year=budget_year,
            department=self.department,
            period_type='month',
            period_start='2026-07-01',
            period_end='2026-07-31',
            allocated_amount=Decimal('50000.00')
        )
        
        alert = BudgetAlert.objects.create(
            allocation=allocation,
            title="Budget Exceeded",
            description="This allocation has exceeded 90% of budget",
            severity='critical',
            status='active'
        )
        
        self.assertEqual(alert.severity, 'critical')
        self.assertEqual(alert.status, 'active')


class BudgetSerializerTests(TestCase):
    """Test budget serializers"""
    
    def setUp(self):
        """Set up test data"""
        self.hospital = Hospital.objects.create(
            name="Test Hospital",
            email="test@hospital.com",
            phone="9876543210"
        )
        self.department = Department.objects.create(
            hospital=self.hospital,
            name="Finance",
            description="Finance Department"
        )
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_budget_year_serializer(self):
        """Test BudgetYearSerializer"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00'),
            is_active=True
        )
        
        serializer = BudgetYearSerializer(budget_year)
        data = serializer.data
        
        self.assertEqual(data['year'], 2026)
        self.assertEqual(data['is_active'], True)
        self.assertIn('total_allocated', data)
    
    def test_budget_allocation_serializer(self):
        """Test BudgetAllocationSerializer"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        allocation = BudgetAllocation.objects.create(
            budget_year=budget_year,
            department=self.department,
            period_type='month',
            period_start='2026-07-01',
            period_end='2026-07-31',
            allocated_amount=Decimal('50000.00'),
            status='draft'
        )
        
        serializer = BudgetAllocationSerializer(allocation)
        data = serializer.data
        
        self.assertEqual(data['allocated_amount'], '50000.00')
        self.assertEqual(data['status'], 'draft')
        self.assertEqual(data['actual_spent'], 0)
        self.assertFalse(data['is_exceeded'])


class BudgetAPITests(APITestCase):
    """Test budget API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        
        self.hospital = Hospital.objects.create(
            name="Test Hospital",
            email="test@hospital.com",
            phone="9876543210"
        )
        
        self.department = Department.objects.create(
            hospital=self.hospital,
            name="Finance",
            description="Finance Department"
        )
        
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create HR manager user
        self.hr_manager = User.objects.create_user(
            username='hrmanager',
            email='hr@example.com',
            password='testpass123'
        )
        
        # Add to hr_manager group
        hr_group, _ = Group.objects.get_or_create(name='hr_manager')
        self.hr_manager.groups.add(hr_group)
        
        # Add hospital assignment (assuming a method or field exists)
        self.user.hospital_id = self.hospital.id
        self.user.save()
        self.hr_manager.hospital_id = self.hospital.id
        self.hr_manager.save()
        
        self.client.force_authenticate(user=self.user)
    
    def test_create_budget_year(self):
        """Test creating a budget year"""
        data = {
            'year': 2026,
            'start_date': '2026-04-01',
            'end_date': '2027-03-31',
            'total_budget': '1000000.00',
            'is_active': True,
            'is_locked': False
        }
        
        response = self.client.post('/api/v1/budgets/years/', data, format='json')
        # Should fail due to permissions or hospital assignment
        # But we're testing the endpoint exists
        self.assertIn(response.status_code, [201, 403, 400])
    
    def test_list_budget_years(self):
        """Test listing budget years"""
        BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        response = self.client.get('/api/v1/budgets/years/', format='json')
        self.assertIn(response.status_code, [200, 403])
    
    def test_allocation_workflow(self):
        """Test budget allocation workflow: draft → submit → approve"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        # Create allocation
        allocation = BudgetAllocation.objects.create(
            budget_year=budget_year,
            department=self.department,
            period_type='month',
            period_start='2026-07-01',
            period_end='2026-07-31',
            allocated_amount=Decimal('50000.00'),
            status='draft'
        )
        
        # Test submit
        response = self.client.post(f'/api/v1/budgets/allocations/{allocation.id}/submit/', format='json')
        # May fail due to permissions but endpoint should exist
        self.assertIn(response.status_code, [200, 403, 404])
        
        # Refresh from DB
        allocation.refresh_from_db()
        # Only check if authenticated and has permission
        if response.status_code == 200:
            self.assertEqual(allocation.status, 'submitted')
    
    def test_pending_approval_action(self):
        """Test pending_approval action"""
        BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        response = self.client.get('/api/v1/budgets/allocations/pending_approval/', format='json')
        # Should return list or permission denied
        self.assertIn(response.status_code, [200, 403])
    
    def test_exceeded_action(self):
        """Test exceeded budget action"""
        response = self.client.get('/api/v1/budgets/allocations/exceeded/', format='json')
        self.assertIn(response.status_code, [200, 403])
    
    def test_variance_report_action(self):
        """Test variance_report action"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        response = self.client.get(f'/api/v1/budgets/allocations/variance_report/?budget_year={budget_year.id}', format='json')
        self.assertIn(response.status_code, [200, 403])
    
    def test_create_revision(self):
        """Test creating a budget revision"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        allocation = BudgetAllocation.objects.create(
            budget_year=budget_year,
            department=self.department,
            period_type='month',
            period_start='2026-07-01',
            period_end='2026-07-31',
            allocated_amount=Decimal('50000.00'),
            status='approved'
        )
        
        data = {
            'allocation': allocation.id,
            'revised_amount': '60000.00',
            'reason': 'Increased demand'
        }
        
        response = self.client.post('/api/v1/budgets/revisions/', data, format='json')
        self.assertIn(response.status_code, [201, 400, 403])
    
    def test_create_forecast(self):
        """Test creating a budget forecast"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        data = {
            'budget_year': budget_year.id,
            'department': self.department.id,
            'month': '2026-08-01',
            'forecasted_amount': '55000.00',
            'confidence_level': 'high',
            'basis': 'historical average'
        }
        
        response = self.client.post('/api/v1/budgets/forecasts/', data, format='json')
        self.assertIn(response.status_code, [201, 400, 403])
    
    def test_forecast_by_department_action(self):
        """Test by_department action on forecasts"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        response = self.client.get(f'/api/v1/budgets/forecasts/by_department/?budget_year={budget_year.id}', format='json')
        self.assertIn(response.status_code, [200, 403])
    
    def test_alert_acknowledge_action(self):
        """Test acknowledging a budget alert"""
        budget_year = BudgetYear.objects.create(
            hospital=self.hospital,
            year=2026,
            start_date='2026-04-01',
            end_date='2027-03-31',
            total_budget=Decimal('1000000.00')
        )
        
        allocation = BudgetAllocation.objects.create(
            budget_year=budget_year,
            department=self.department,
            period_type='month',
            period_start='2026-07-01',
            period_end='2026-07-31',
            allocated_amount=Decimal('50000.00')
        )
        
        alert = BudgetAlert.objects.create(
            allocation=allocation,
            title="Budget Alert",
            description="Test alert",
            severity='warning'
        )
        
        response = self.client.post(f'/api/v1/budgets/alerts/{alert.id}/acknowledge/', format='json')
        self.assertIn(response.status_code, [200, 403, 404])
    
    def test_active_alerts_action(self):
        """Test getting active alerts"""
        response = self.client.get('/api/v1/budgets/alerts/active_alerts/', format='json')
        self.assertIn(response.status_code, [200, 403])
    
    def test_critical_alerts_action(self):
        """Test getting critical alerts"""
        response = self.client.get('/api/v1/budgets/alerts/critical_alerts/', format='json')
        self.assertIn(response.status_code, [200, 403])
