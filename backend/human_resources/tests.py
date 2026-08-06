from django.contrib.auth.models import User
from django.test import TestCase

from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile
from human_resources.models import (
	Employee,
	LeaveBalance,
	LeaveRequest,
	LeaveType,
	Shift,
)


class HRPermissionTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="HR Permissions Hospital",
			slug="hr-permissions-hospital",
			hospital_type="general",
			registration_number="HR-PERM-001",
			email="hr@example.com",
			phone="1234567890",
			address="123 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.hr_officer = User.objects.create_user(
			username="hr-officer",
			password="HrOfficer@1234",
		)
		StaffProfile.objects.create(
			user=self.hr_officer,
			hospital=self.hospital,
			role="hr_officer",
			phone="1234567891",
		)
		self.doctor = User.objects.create_user(
			username="hr-doctor",
			password="Doctor@1234",
		)
		StaffProfile.objects.create(
			user=self.doctor,
			hospital=self.hospital,
			role="doctor",
			phone="1234567892",
		)
		self.hr_manager = User.objects.create_user(
			username="hr-manager",
			password="HrManager@1234",
		)
		StaffProfile.objects.create(
			user=self.hr_manager,
			hospital=self.hospital,
			role="hr_manager",
			phone="1234567893",
		)

	def test_hr_officer_can_read_but_cannot_create_positions(self):
		self.client.force_authenticate(self.hr_officer)

		self.assertEqual(
			self.client.get("/api/v1/hr/positions/").status_code,
			200,
		)
		self.assertEqual(
			self.client.post("/api/v1/hr/positions/", {}, format="json").status_code,
			403,
		)

	def test_non_hr_staff_cannot_manage_departments(self):
		self.client.force_authenticate(self.doctor)

		response = self.client.post(
			"/api/v1/hr/departments/",
			{"name": "Unauthorized Department"},
			format="json",
		)

		self.assertEqual(response.status_code, 403)

	def test_hr_manager_cannot_create_attendance_for_another_hospital(self):
		other_hospital = Hospital.objects.create(
			name="Other HR Hospital",
			slug="other-hr-hospital",
			hospital_type="general",
			registration_number="HR-PERM-002",
			email="other-hr@example.com",
			phone="1234567894",
			address="456 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		employee = Employee.objects.create(
			hospital=other_hospital,
			employee_number="OTHER-001",
			first_name="Other",
			last_name="Employee",
			email="other.employee@example.com",
		)
		shift = Shift.objects.create(
			hospital=other_hospital,
			name="Other Shift",
			code="OTHER",
			start_time="08:00",
			end_time="16:00",
		)
		self.client.force_authenticate(self.hr_manager)

		response = self.client.post(
			"/api/v1/hr/attendance/",
			{
				"employee": employee.id,
				"shift": shift.id,
				"attendance_date": "2026-08-06",
				"status": "PRESENT",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)

	def test_leave_request_requires_a_balance_and_cannot_be_deleted(self):
		employee = Employee.objects.create(
			hospital=self.hospital,
			employee_number="LEAVE-001",
			first_name="Leave",
			last_name="Employee",
			email="leave.employee@example.com",
		)
		leave_type = LeaveType.objects.create(
			hospital=self.hospital,
			name="Annual Leave",
			code="ANNUAL",
			days_allowed=21,
		)
		self.client.force_authenticate(self.hr_manager)
		payload = {
			"employee": employee.id,
			"leave_type": leave_type.id,
			"start_date": "2026-08-10",
			"end_date": "2026-08-11",
			"reason": "Annual leave",
		}

		missing_balance = self.client.post(
			"/api/v1/hr/leave-requests/",
			payload,
			format="json",
		)

		self.assertEqual(missing_balance.status_code, 400)
		LeaveBalance.objects.create(
			employee=employee,
			leave_type=leave_type,
			year=2026,
			allocated_days=21,
		)
		created = self.client.post(
			"/api/v1/hr/leave-requests/",
			payload,
			format="json",
		)

		self.assertEqual(created.status_code, 201)
		leave_request = LeaveRequest.objects.get()
		self.assertEqual(
			self.client.delete(
				f"/api/v1/hr/leave-requests/{leave_request.id}/",
			).status_code,
			405,
		)
