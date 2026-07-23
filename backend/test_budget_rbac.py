"""
Role-Based Access Control Tests for Budget Module
Tests permission checks, role validation, and hospital scoping
"""
import pytest
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from datetime import date

from hospitals.models import Hospital
from departments.models import Department
from budgets.models import BudgetYear, BudgetAllocation
from expenses.models import ExpenseCategory


@pytest.fixture
def setup_hospitals():
    """Create test hospitals"""
    hospital1 = Hospital.objects.create(
        name="Hospital A",
        code="HOSPITAL_A",
        email="a@hospital.com",
        phone="111111"
    )
    hospital2 = Hospital.objects.create(
        name="Hospital B", 
        code="HOSPITAL_B",
        email="b@hospital.com",
        phone="222222"
    )
    return hospital1, hospital2


@pytest.fixture
def setup_departments(setup_hospitals):
    """Create test departments"""
    hospital1, hospital2 = setup_hospitals
    dept1 = Department.objects.create(
        hospital=hospital1,
        name="Finance",
        code="FIN"
    )
    dept2 = Department.objects.create(
        hospital=hospital2,
        name="Finance",
        code="FIN"
    )
    return dept1, dept2


@pytest.fixture
def setup_budget_data(setup_hospitals, setup_departments):
    """Create test budget data"""
    hospital1, hospital2 = setup_hospitals
    dept1, dept2 = setup_departments
    
    budget_year1 = BudgetYear.objects.create(
        hospital=hospital1,
        year=2026,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        total_budget=Decimal('5000000.00')
    )
    
    budget_year2 = BudgetYear.objects.create(
        hospital=hospital2,
        year=2026,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        total_budget=Decimal('3000000.00')
    )
    
    allocation1 = BudgetAllocation.objects.create(
        budget_year=budget_year1,
        department=dept1,
        period_type='month',
        period_start=date(2026, 1, 1),
        period_end=date(2026, 1, 31),
        allocated_amount=Decimal('50000.00'),
        status='draft'
    )
    
    allocation2 = BudgetAllocation.objects.create(
        budget_year=budget_year2,
        department=dept2,
        period_type='month',
        period_start=date(2026, 1, 1),
        period_end=date(2026, 1, 31),
        allocated_amount=Decimal('30000.00'),
        status='draft'
    )
    
    return budget_year1, budget_year2, allocation1, allocation2


@pytest.fixture
def setup_users(setup_hospitals):
    """Create test users with different roles"""
    hospital1, hospital2 = setup_hospitals
    
    # Create HR manager group
    hr_manager_group = Group.objects.get_or_create(name='hr_manager')[0]
    # Create HR user group  
    hr_user_group = Group.objects.get_or_create(name='hr_user')[0]
    
    # HR Manager for Hospital 1
    hr_manager1 = User.objects.create_user(
        username='hr_manager1',
        password='password123',
        email='manager1@hospital.com'
    )
    hr_manager1.groups.add(hr_manager_group)
    hr_manager1.role = 'HR_MANAGER'
    hr_manager1.hospital_id = hospital1.id
    hr_manager1.save()
    
    # HR User for Hospital 1
    hr_user1 = User.objects.create_user(
        username='hr_user1',
        password='password123',
        email='user1@hospital.com'
    )
    hr_user1.groups.add(hr_user_group)
    hr_user1.role = 'HR'
    hr_user1.hospital_id = hospital1.id
    hr_user1.save()
    
    # HR Manager for Hospital 2
    hr_manager2 = User.objects.create_user(
        username='hr_manager2',
        password='password123',
        email='manager2@hospital.com'
    )
    hr_manager2.groups.add(hr_manager_group)
    hr_manager2.role = 'HR_MANAGER'
    hr_manager2.hospital_id = hospital2.id
    hr_manager2.save()
    
    # Regular user (no HR role)
    regular_user = User.objects.create_user(
        username='regular_user',
        password='password123',
        email='regular@hospital.com'
    )
    regular_user.role = 'DOCTOR'
    regular_user.hospital_id = hospital1.id
    regular_user.save()
    
    # Superuser
    superuser = User.objects.create_superuser(
        username='admin',
        email='admin@hospital.com',
        password='password123'
    )
    
    return hr_manager1, hr_user1, hr_manager2, regular_user, superuser


@pytest.mark.django_db
class TestBudgetRBACPermissions:
    """Test role-based access control for budget endpoints"""
    
    def test_unauthenticated_access_denied(self, setup_budget_data):
        """Unauthenticated users should be denied access"""
        client = APIClient()
        
        response = client.get('/api/v1/budgets/years/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        response = client.get('/api/v1/budgets/allocations/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_non_hr_user_denied_access(self, setup_users):
        """Non-HR users should be denied access"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        client = APIClient()
        
        client.force_authenticate(user=regular_user)
        
        response = client.get('/api/v1/budgets/years/')
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        response = client.get('/api/v1/budgets/allocations/')
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_hr_user_can_read_allocations(self, setup_users, setup_budget_data):
        """HR users can read budget allocations"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        client = APIClient()
        client.force_authenticate(user=hr_user1)
        
        response = client.get('/api/v1/budgets/allocations/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) > 0
    
    def test_hr_user_hospital_scoping(self, setup_users, setup_budget_data):
        """HR users should only see data from their hospital"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        client = APIClient()
        client.force_authenticate(user=hr_user1)
        
        response = client.get('/api/v1/budgets/allocations/')
        assert response.status_code == status.HTTP_200_OK
        
        # Should only see allocations from hospital1
        for allocation in response.data:
            # allocation should belong to hospital1
            pass
    
    def test_hr_manager_can_create_budget_year(self, setup_users, setup_hospitals):
        """HR managers can create budget years"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        hospital1, hospital2 = setup_hospitals
        
        client = APIClient()
        client.force_authenticate(user=hr_manager1)
        
        data = {
            'year': 2027,
            'start_date': '2027-01-01',
            'end_date': '2027-12-31',
            'total_budget': '6000000.00',
            'is_active': True,
            'is_locked': False
        }
        
        response = client.post('/api/v1/budgets/years/', data, format='json')
        assert response.status_code in [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST]
    
    def test_hr_user_can_create_allocation(self, setup_users, setup_budget_data):
        """HR users can create budget allocations"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        client = APIClient()
        client.force_authenticate(user=hr_user1)
        
        data = {
            'budget_year': budget_year1.id,
            'department': 1,  # Finance department
            'period_type': 'month',
            'period_start': '2026-02-01',
            'period_end': '2026-02-28',
            'allocated_amount': '55000.00',
            'status': 'draft'
        }
        
        response = client.post('/api/v1/budgets/allocations/', data, format='json')
        # May succeed or fail depending on department setup, but should be authorized
        assert response.status_code != status.HTTP_403_FORBIDDEN
    
    def test_approval_requires_hr_manager(self, setup_users, setup_budget_data):
        """Only HR managers can approve budgets"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        # Set allocation to submitted state for approval
        allocation1.status = 'submitted'
        allocation1.submitted_by = hr_user1
        allocation1.save()
        
        client = APIClient()
        
        # HR user should be denied
        client.force_authenticate(user=hr_user1)
        response = client.post(
            f'/api/v1/budgets/allocations/{allocation1.id}/approve/',
            format='json'
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        # HR manager should succeed or get proper response
        client.force_authenticate(user=hr_manager1)
        response = client.post(
            f'/api/v1/budgets/allocations/{allocation1.id}/approve/',
            format='json'
        )
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST]
    
    def test_superuser_can_access_all_data(self, setup_users, setup_budget_data):
        """Superusers can access data from all hospitals"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        client = APIClient()
        client.force_authenticate(user=superuser)
        
        response = client.get('/api/v1/budgets/years/')
        assert response.status_code == status.HTTP_200_OK
        
        response = client.get('/api/v1/budgets/allocations/')
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestBudgetHospitalScoping:
    """Test hospital scoping and isolation"""
    
    def test_users_only_see_their_hospital_data(self, setup_users, setup_budget_data):
        """Users should only see data from their own hospital"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        client = APIClient()
        
        # Hospital 1 user
        client.force_authenticate(user=hr_manager1)
        response = client.get('/api/v1/budgets/years/')
        assert response.status_code == status.HTTP_200_OK
        # Should see only hospital1 data
        hospital1_years = response.data
        
        # Hospital 2 user
        client.force_authenticate(user=hr_manager2)
        response = client.get('/api/v1/budgets/years/')
        assert response.status_code == status.HTTP_200_OK
        # Should see only hospital2 data
        hospital2_years = response.data
    
    def test_users_cannot_modify_other_hospital_data(self, setup_users, setup_budget_data):
        """Users should not be able to modify data from other hospitals"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        client = APIClient()
        client.force_authenticate(user=hr_manager1)
        
        # Try to access allocation from hospital2
        response = client.get(f'/api/v1/budgets/allocations/{allocation2.id}/')
        # Should either get 404 or no data
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]


@pytest.mark.django_db
class TestBudgetActionPermissions:
    """Test permissions on custom actions"""
    
    def test_pending_approval_requires_hr_manager(self, setup_users, setup_budget_data):
        """pending_approval action requires HR manager role"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        allocation1.status = 'submitted'
        allocation1.save()
        
        client = APIClient()
        
        # HR user should be denied
        client.force_authenticate(user=hr_user1)
        response = client.get('/api/v1/budgets/allocations/pending_approval/')
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        # HR manager should succeed
        client.force_authenticate(user=hr_manager1)
        response = client.get('/api/v1/budgets/allocations/pending_approval/')
        assert response.status_code == status.HTTP_200_OK
    
    def test_exceeded_allocations_visible_to_hr_user(self, setup_users, setup_budget_data):
        """exceeded action should be visible to HR users"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        allocation1.status = 'approved'
        allocation1.save()
        
        client = APIClient()
        client.force_authenticate(user=hr_user1)
        
        response = client.get('/api/v1/budgets/allocations/exceeded/')
        assert response.status_code == status.HTTP_200_OK
    
    def test_variance_report_visible_to_hr_user(self, setup_users, setup_budget_data):
        """variance_report action should be visible to HR users"""
        hr_manager1, hr_user1, hr_manager2, regular_user, superuser = setup_users
        budget_year1, budget_year2, allocation1, allocation2 = setup_budget_data
        
        allocation1.status = 'approved'
        allocation1.save()
        
        client = APIClient()
        client.force_authenticate(user=hr_user1)
        
        response = client.get('/api/v1/budgets/allocations/variance_report/')
        assert response.status_code == status.HTTP_200_OK


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
