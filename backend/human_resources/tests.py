from django.contrib.auth.models import User
from django.test import TestCase

from rest_framework.test import APIClient

from hospitals.models import Hospital
from departments.models import Department
from staff.models import StaffProfile
from human_resources.models import (
	Employee,
	JobPosition,
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

	def test_hr_manager_can_create_employee_with_form_contract(self):
		department = Department.objects.create(
			hospital=self.hospital,
			name="Clinical Services",
		)
		position = JobPosition.objects.create(
			hospital=self.hospital,
			department=department,
			title="Clinical Officer",
			code="CLIN-OFF",
		)
		self.client.force_authenticate(self.hr_manager)

		response = self.client.post(
			"/api/v1/hr/employees/",
			{
				"employee_number": "EMP-100",
				"first_name": "Valid",
				"middle_name": "",
				"last_name": "Employee",
				"gender": "FEMALE",
				"email": "",
				"phone": "",
				"address": "",
				"department": department.id,
				"position": position.id,
				"employment_type": "PERMANENT",
				"employment_status": "ACTIVE",
				"emergency_contact_name": "",
				"emergency_contact_phone": "",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201, response.data)
		employee = Employee.objects.get(employee_number="EMP-100")
		self.assertEqual(employee.hospital, self.hospital)
		self.assertEqual(employee.department, department)
		self.assertEqual(employee.position, position)
		self.assertEqual(employee.gender, "FEMALE")
		self.assertEqual(employee.employment_type, "PERMANENT")
		self.assertEqual(employee.employment_status, "ACTIVE")

	def test_employee_number_must_be_unique_within_hospital(self):
		Employee.objects.create(
			hospital=self.hospital,
			employee_number="EMP-101",
			first_name="Existing",
			last_name="Employee",
		)
		self.client.force_authenticate(self.hr_manager)

		response = self.client.post(
			"/api/v1/hr/employees/",
			{
				"employee_number": "EMP-101",
				"first_name": "Duplicate",
				"last_name": "Employee",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("employee_number", response.data)

	def test_employee_rejects_mismatched_position_and_foreign_staff_user(self):
		department = Department.objects.create(
			hospital=self.hospital,
			name="Administration",
		)
		other_department = Department.objects.create(
			hospital=self.hospital,
			name="Pharmacy",
		)
		position = JobPosition.objects.create(
			hospital=self.hospital,
			department=other_department,
			title="Pharmacist",
			code="PHARM",
		)
		other_hospital = Hospital.objects.create(
			name="Foreign Staff Hospital",
			slug="foreign-staff-hospital",
			hospital_type="general",
			registration_number="HR-PERM-003",
			email="foreign-staff@example.com",
			phone="1234567895",
			address="789 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		foreign_user = User.objects.create_user(
			username="foreign-staff-user",
			password="Foreign@1234",
		)
		StaffProfile.objects.create(
			user=foreign_user,
			hospital=other_hospital,
			role="doctor",
			phone="1234567896",
		)
		self.client.force_authenticate(self.hr_manager)

		mismatched_position = self.client.post(
			"/api/v1/hr/employees/",
			{
				"employee_number": "EMP-102",
				"first_name": "Wrong",
				"last_name": "Position",
				"department": department.id,
				"position": position.id,
			},
			format="json",
		)
		foreign_account = self.client.post(
			"/api/v1/hr/employees/",
			{
				"employee_number": "EMP-103",
				"first_name": "Wrong",
				"last_name": "Account",
				"user": foreign_user.id,
			},
			format="json",
		)

		self.assertEqual(mismatched_position.status_code, 400)
		self.assertIn("position", mismatched_position.data)
		self.assertEqual(foreign_account.status_code, 400)
		self.assertIn("user", foreign_account.data)
