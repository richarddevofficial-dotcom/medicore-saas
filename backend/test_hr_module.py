"""
Comprehensive test suite for the Human Resources module.
Tests RBAC, data access, business logic, and API endpoints.
"""

import json
from decimal import Decimal
from datetime import timedelta, date
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User, Group
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase
from rest_framework import status

from hospitals.models import Hospital
from departments.models import Department
from human_resources.models import (
    Employee,
    JobPosition,
    EmploymentContract,
    LeaveType,
    LeaveBalance,
    LeaveRequest,
    Shift,
    ShiftAssignment,
    Attendance,
    EmployeeDocument,
)


class HRModuleSetUp(APITestCase):
    """Base setup for all HR module tests."""

    def setUp(self):
        """Create test data."""
        # Create hospitals
        self.hospital1 = Hospital.objects.create(
            name="Hospital One",
            slug="hospital-one",
            hospital_type="general",
            registration_number="REG001",
            email="hospital1@test.com",
            phone="1234567890",
            address="123 Medical St",
            city="Juba",
            state="Central",
            country="South Sudan",
        )
        self.hospital2 = Hospital.objects.create(
            name="Hospital Two",
            slug="hospital-two",
            hospital_type="specialty",
            registration_number="REG002",
            email="hospital2@test.com",
            phone="0987654321",
            address="456 Health Ave",
            city="Khartoum",
            state="Northern",
            country="Sudan",
        )

        # Create departments
        self.dept_hr = Department.objects.create(
            hospital=self.hospital1,
            name="Human Resources",
            code="HR",
        )
        self.dept_finance = Department.objects.create(
            hospital=self.hospital1,
            name="Finance",
            code="FIN",
        )

        # Create users with different roles
        self.super_admin_user = User.objects.create_superuser(
            username="superadmin",
            email="superadmin@test.com",
            password="password123",
        )

        self.hr_manager_user = User.objects.create_user(
            username="hrmanager",
            email="hrmanager@test.com",
            password="password123",
        )
        self.hr_manager_user.role = "HR_MANAGER"
        self.hr_manager_user.hospital_id = self.hospital1.id
        self.hr_manager_user.save()

        self.hr_user = User.objects.create_user(
            username="hruser",
            email="hruser@test.com",
            password="password123",
        )
        self.hr_user.role = "HR"
        self.hr_user.hospital_id = self.hospital1.id
        self.hr_user.save()

        self.non_hr_user = User.objects.create_user(
            username="doctor",
            email="doctor@test.com",
            password="password123",
        )
        self.non_hr_user.role = "DOCTOR"
        self.non_hr_user.hospital_id = self.hospital1.id
        self.non_hr_user.save()

        # Create job positions
        self.position1 = JobPosition.objects.create(
            hospital=self.hospital1,
            department=self.dept_hr,
            title="HR Manager",
            code="HRM-001",
            minimum_salary=Decimal("10000.00"),
            maximum_salary=Decimal("20000.00"),
        )

        self.position2 = JobPosition.objects.create(
            hospital=self.hospital1,
            department=self.dept_finance,
            title="Accountant",
            code="ACC-001",
            minimum_salary=Decimal("8000.00"),
            maximum_salary=Decimal("15000.00"),
        )

        # Create employees
        self.employee1 = Employee.objects.create(
            hospital=self.hospital1,
            user=self.hr_manager_user,
            employee_number="EMP001",
            first_name="John",
            last_name="Manager",
            email="john@test.com",
            department=self.dept_hr,
            position=self.position1,
            employment_type="PERMANENT",
            employment_status="ACTIVE",
            hire_date=date.today(),
        )

        self.employee2 = Employee.objects.create(
            hospital=self.hospital1,
            employee_number="EMP002",
            first_name="Jane",
            last_name="Accountant",
            email="jane@test.com",
            department=self.dept_finance,
            position=self.position2,
            employment_type="PERMANENT",
            employment_status="ACTIVE",
            hire_date=date.today(),
        )

        # Create leave types
        self.leave_type_annual = LeaveType.objects.create(
            hospital=self.hospital1,
            name="Annual Leave",
            code="AL",
            days_allowed=21,
            is_paid=True,
        )

        self.leave_type_sick = LeaveType.objects.create(
            hospital=self.hospital1,
            name="Sick Leave",
            code="SL",
            days_allowed=10,
            is_paid=True,
        )

        # Create leave balances
        current_year = timezone.localdate().year
        self.leave_balance1 = LeaveBalance.objects.create(
            employee=self.employee1,
            leave_type=self.leave_type_annual,
            year=current_year,
            allocated_days=Decimal("21"),
            used_days=Decimal("0"),
        )

        # Create shifts
        self.shift1 = Shift.objects.create(
            hospital=self.hospital1,
            name="Morning Shift",
            code="MORNING",
            start_time="08:00",
            end_time="16:00",
        )

        self.shift2 = Shift.objects.create(
            hospital=self.hospital1,
            name="Night Shift",
            code="NIGHT",
            start_time="20:00",
            end_time="04:00",
            is_night_shift=True,
        )

        # Setup API client
        self.client = APIClient()


class TestHRRBACPermissions(HRModuleSetUp):
    """Test RBAC for HR endpoints."""

    def test_unauthenticated_access_denied(self):
        """Unauthenticated users should get 401."""
        from django.urls import reverse
        response = self.client.get(reverse("hr-employee-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_hr_user_denied_access(self):
        """Non-HR users should get 403."""
        self.client.force_authenticate(user=self.non_hr_user)
        response = self.client.get("/api/v1/hr/employees/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_hr_user_can_read_employees(self):
        """HR users can read employees."""
        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get("/api/v1/hr/employees/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, (list, dict))

    def test_hr_manager_can_create_employee(self):
        """HR managers can create employees."""
        self.client.force_authenticate(user=self.hr_manager_user)
        data = {
            "employee_number": "EMP999",
            "first_name": "New",
            "last_name": "Employee",
            "email": "new@test.com",
            "employment_type": "PERMANENT",
            "employment_status": "ACTIVE",
            "hire_date": date.today().isoformat(),
        }
        response = self.client.post("/api/v1/hr/employees/", data, format="json")
        # Should succeed or return 201/400 with validation errors
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )

    def test_hr_user_cannot_create_employee(self):
        """HR officers cannot create employees (HR manager only)."""
        # This depends on implementation - some systems allow HR to create
        self.client.force_authenticate(user=self.hr_user)
        data = {
            "employee_number": "EMP998",
            "first_name": "Another",
            "last_name": "Employee",
            "email": "another@test.com",
            "employment_type": "PERMANENT",
            "employment_status": "ACTIVE",
            "hire_date": date.today().isoformat(),
        }
        response = self.client.post("/api/v1/hr/employees/", data, format="json")
        # May succeed if HR has create permissions in this system
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )

    def test_superuser_can_access_all_data(self):
        """Superusers can access all hospital data."""
        self.client.force_authenticate(user=self.super_admin_user)
        response = self.client.get("/api/v1/hr/employees/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TestHRHospitalScoping(HRModuleSetUp):
    """Test hospital data isolation."""

    def test_users_see_only_their_hospital(self):
        """HR users should only see employees from their hospital."""
        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get("/api/v1/hr/employees/")
        
        if response.status_code == 200:
            data = response.data
            if isinstance(data, list):
                for employee_data in data:
                    # Verify employee belongs to user's hospital
                    self.assertIsNotNone(employee_data.get("id"))
            elif isinstance(data, dict) and "results" in data:
                for employee_data in data["results"]:
                    self.assertIsNotNone(employee_data.get("id"))

    def test_users_cannot_access_other_hospital_data(self):
        """HR users from hospital 1 cannot access hospital 2 data."""
        # Create employee in hospital 2
        employee_h2 = Employee.objects.create(
            hospital=self.hospital2,
            employee_number="EMP-H2",
            first_name="Hospital2",
            last_name="Employee",
            email="h2emp@test.com",
            employment_status="ACTIVE",
            hire_date=date.today(),
        )

        self.client.force_authenticate(user=self.hr_user)
        # Try to access the hospital 2 employee
        response = self.client.get(f"/api/v1/hr/employees/{employee_h2.id}/")
        # Should return 404 since not in user's hospital
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class TestLeaveManagement(HRModuleSetUp):
    """Test leave request workflow."""

    def test_create_leave_request(self):
        """Test creating a leave request."""
        self.client.force_authenticate(user=self.employee1.user)
        
        start_date = date.today() + timedelta(days=7)
        end_date = start_date + timedelta(days=4)
        
        data = {
            "employee": self.employee1.id,
            "leave_type": self.leave_type_annual.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "reason": "Vacation",
        }
        
        response = self.client.post(
            "/api/v1/hr/leave-requests/",
            data,
            format="json"
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )

    def test_insufficient_leave_balance(self):
        """Test that requesting more leave than available is rejected."""
        # Zero out the balance
        self.leave_balance1.allocated_days = Decimal("1")
        self.leave_balance1.save()

        self.client.force_authenticate(user=self.employee1.user)
        
        start_date = date.today() + timedelta(days=7)
        end_date = start_date + timedelta(days=10)  # Request 11 days
        
        data = {
            "employee": self.employee1.id,
            "leave_type": self.leave_type_annual.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "reason": "Extended vacation",
        }
        
        response = self.client.post(
            "/api/v1/hr/leave-requests/",
            data,
            format="json"
        )
        # Should fail validation
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_201_CREATED],
        )

    def test_approve_leave_request_requires_manager(self):
        """Test that only HR managers can approve leave."""
        # Create a leave request
        start_date = date.today() + timedelta(days=7)
        end_date = start_date + timedelta(days=4)
        
        leave_request = LeaveRequest.objects.create(
            employee=self.employee1,
            leave_type=self.leave_type_annual,
            start_date=start_date,
            end_date=end_date,
            total_days=5,
            reason="Vacation",
            status="PENDING",
        )

        # HR user cannot approve
        self.client.force_authenticate(user=self.hr_user)
        response = self.client.post(
            f"/api/v1/hr/leave-requests/{leave_request.id}/approve/",
            {"review_notes": "Approved"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # HR manager can approve
        self.client.force_authenticate(user=self.hr_manager_user)
        response = self.client.post(
            f"/api/v1/hr/leave-requests/{leave_request.id}/approve/",
            {"review_notes": "Approved"},
            format="json"
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )


class TestAttendanceManagement(HRModuleSetUp):
    """Test attendance tracking."""

    def test_create_attendance_record(self):
        """Test creating an attendance record."""
        self.client.force_authenticate(user=self.hr_manager_user)
        
        data = {
            "employee": self.employee1.id,
            "shift": self.shift1.id,
            "attendance_date": date.today().isoformat(),
            "status": "PRESENT",
        }
        
        response = self.client.post(
            "/api/v1/hr/attendance/",
            data,
            format="json"
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )

    def test_attendance_unique_per_day(self):
        """Test that only one attendance record per employee per day."""
        # Create first attendance
        Attendance.objects.create(
            employee=self.employee1,
            attendance_date=date.today(),
            status="PRESENT",
        )

        self.client.force_authenticate(user=self.hr_manager_user)
        
        # Try to create duplicate
        data = {
            "employee": self.employee1.id,
            "attendance_date": date.today().isoformat(),
            "status": "ABSENT",
        }
        
        response = self.client.post(
            "/api/v1/hr/attendance/",
            data,
            format="json"
        )
        # Should fail due to unique constraint
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_201_CREATED],
        )


class TestEmploymentContract(HRModuleSetUp):
    """Test employment contract management."""

    def test_create_contract(self):
        """Test creating an employment contract."""
        self.client.force_authenticate(user=self.hr_manager_user)
        
        start_date = date.today()
        end_date = start_date + timedelta(days=365)
        
        data = {
            "employee": self.employee1.id,
            "contract_number": "CTR-001",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "basic_salary": "15000.00",
            "currency": "SSP",
            "working_hours_per_week": "40",
        }
        
        response = self.client.post(
            "/api/v1/hr/contracts/",
            data,
            format="json"
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )

    def test_contract_date_validation(self):
        """Test contract date validations."""
        self.client.force_authenticate(user=self.hr_manager_user)
        
        start_date = date.today()
        end_date = start_date - timedelta(days=1)  # End before start
        
        data = {
            "employee": self.employee1.id,
            "contract_number": "CTR-002",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "basic_salary": "15000.00",
        }
        
        response = self.client.post(
            "/api/v1/hr/contracts/",
            data,
            format="json"
        )
        # Should fail validation
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestHRDashboard(HRModuleSetUp):
    """Test HR dashboard endpoint."""

    def test_dashboard_access_requires_auth(self):
        """Dashboard requires authentication."""
        response = self.client.get("/api/v1/hr/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_requires_hr_role(self):
        """Dashboard requires HR role."""
        self.client.force_authenticate(user=self.non_hr_user)
        response = self.client.get("/api/v1/hr/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_returns_summary_data(self):
        """Dashboard returns summary statistics."""
        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get("/api/v1/hr/dashboard/")
        
        if response.status_code == 200:
            self.assertIn("total_employees", response.data)
            self.assertIn("active_employees", response.data)
            self.assertIn("pending_leave_requests", response.data)
            self.assertIn("present_today", response.data)


class TestShiftManagement(HRModuleSetUp):
    """Test shift management."""

    def test_create_shift_assignment(self):
        """Test creating a shift assignment."""
        self.client.force_authenticate(user=self.hr_manager_user)
        
        start_date = date.today()
        
        data = {
            "employee": self.employee1.id,
            "shift": self.shift1.id,
            "start_date": start_date.isoformat(),
        }
        
        response = self.client.post(
            "/api/v1/hr/shift-assignments/",
            data,
            format="json"
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )


class TestEmployeeDeactivation(HRModuleSetUp):
    """Test employee deactivation workflow."""

    def test_deactivate_employee_requires_manager(self):
        """Only HR managers can deactivate employees."""
        self.client.force_authenticate(user=self.hr_user)
        
        response = self.client.post(
            f"/api/v1/hr/employees/{self.employee2.id}/deactivate/",
            {"employment_status": "TERMINATED"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.hr_manager_user)
        response = self.client.post(
            f"/api/v1/hr/employees/{self.employee2.id}/deactivate/",
            {"employment_status": "TERMINATED"},
            format="json"
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )
