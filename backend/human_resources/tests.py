from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from datetime import datetime, timedelta
from unittest.mock import patch

from rest_framework.test import APIClient

from hospitals.models import Hospital
from departments.models import Department
from staff.models import StaffProfile
from human_resources.models import (
	Attendance,
	Employee,
	JobPosition,
	LeaveBalance,
	LeaveRequest,
	LeaveType,
	Shift,
	ShiftAssignment,
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

	def test_hr_manager_can_create_shift_and_duplicate_code_is_rejected(self):
		self.client.force_authenticate(self.hr_manager)
		payload = {
			"code": "MORNING",
			"name": "Morning Shift",
			"start_time": "08:00",
			"end_time": "16:00",
			"break_minutes": 30,
			"is_night_shift": False,
			"is_active": True,
		}

		created = self.client.post(
			"/api/v1/hr/shifts/",
			payload,
			format="json",
		)
		duplicate = self.client.post(
			"/api/v1/hr/shifts/",
			{**payload, "code": "morning", "name": "Another Shift"},
			format="json",
		)

		self.assertEqual(created.status_code, 201, created.data)
		self.assertEqual(created.data["code"], "MORNING")
		self.assertEqual(created.data["break_minutes"], 30)
		self.assertEqual(duplicate.status_code, 400)
		self.assertIn("code", duplicate.data)

	def test_staff_self_service_is_scoped_to_linked_employee(self):
		doctor_employee = Employee.objects.create(
			hospital=self.hospital,
			user=self.doctor,
			employee_number="SELF-001",
			first_name="Doctor",
			last_name="Self",
		)
		other_user = User.objects.create_user(
			username="self-service-nurse",
			password="Nurse@1234",
		)
		StaffProfile.objects.create(
			user=other_user,
			hospital=self.hospital,
			role="nurse",
			phone="1234567897",
		)
		other_employee = Employee.objects.create(
			hospital=self.hospital,
			user=other_user,
			employee_number="SELF-002",
			first_name="Nurse",
			last_name="Other",
		)
		shift = Shift.objects.create(
			hospital=self.hospital,
			code="SELF",
			name="Self Service Shift",
			start_time="08:00",
			end_time="16:00",
		)
		own_assignment = ShiftAssignment.objects.create(
			employee=doctor_employee,
			shift=shift,
			start_date="2026-08-01",
		)
		ShiftAssignment.objects.create(
			employee=other_employee,
			shift=shift,
			start_date="2026-08-01",
		)
		Attendance.objects.create(
			employee=doctor_employee,
			shift=shift,
			attendance_date="2026-08-08",
			status="PRESENT",
		)
		Attendance.objects.create(
			employee=other_employee,
			shift=shift,
			attendance_date="2026-08-08",
			status="LATE",
		)
		self.client.force_authenticate(self.doctor)

		shift_response = self.client.get("/api/v1/hr/me/shifts/")
		attendance_response = self.client.get(
			"/api/v1/hr/me/attendance/",
		)

		self.assertEqual(shift_response.status_code, 200)
		self.assertEqual(shift_response.data["count"], 1)
		self.assertEqual(
			shift_response.data["results"][0]["id"],
			own_assignment.id,
		)
		self.assertEqual(attendance_response.status_code, 200)
		self.assertEqual(attendance_response.data["count"], 1)
		self.assertEqual(
			attendance_response.data["results"][0]["employee"],
			doctor_employee.id,
		)

	def test_shift_assignments_cannot_overlap(self):
		employee = Employee.objects.create(
			hospital=self.hospital,
			employee_number="SHIFT-OVERLAP-001",
			first_name="Shift",
			last_name="Employee",
		)
		first_shift = Shift.objects.create(
			hospital=self.hospital,
			code="SHIFT-FIRST",
			name="First Shift",
			start_time="08:00",
			end_time="16:00",
		)
		second_shift = Shift.objects.create(
			hospital=self.hospital,
			code="SHIFT-SECOND",
			name="Second Shift",
			start_time="10:00",
			end_time="18:00",
		)
		ShiftAssignment.objects.create(
			employee=employee,
			shift=first_shift,
			start_date="2026-08-01",
			end_date="2026-08-31",
		)
		self.client.force_authenticate(self.hr_manager)

		overlap = self.client.post(
			"/api/v1/hr/shift-assignments/",
			{
				"employee": employee.id,
				"shift": second_shift.id,
				"start_date": "2026-08-31",
				"end_date": "2026-09-30",
			},
			format="json",
		)
		adjacent = self.client.post(
			"/api/v1/hr/shift-assignments/",
			{
				"employee": employee.id,
				"shift": second_shift.id,
				"start_date": "2026-09-01",
				"end_date": "2026-09-30",
			},
			format="json",
		)

		self.assertEqual(overlap.status_code, 400)
		self.assertIn("start_date", overlap.data)
		self.assertEqual(adjacent.status_code, 201, adjacent.data)

	def test_staff_can_submit_and_view_only_own_leave_requests(self):
		doctor_employee = Employee.objects.create(
			hospital=self.hospital,
			user=self.doctor,
			employee_number="LEAVE-SELF-001",
			first_name="Doctor",
			last_name="Leave",
		)
		leave_type = LeaveType.objects.create(
			hospital=self.hospital,
			name="Annual Leave",
			code="SELF-ANNUAL",
			days_allowed=20,
		)
		balance = LeaveBalance.objects.create(
			employee=doctor_employee,
			leave_type=leave_type,
			year=2026,
			allocated_days=20,
		)
		self.client.force_authenticate(self.doctor)

		created = self.client.post(
			"/api/v1/hr/me/leave-requests/",
			{
				"employee": 999999,
				"leave_type": leave_type.id,
				"start_date": "2026-08-10",
				"end_date": "2026-08-11",
				"reason": "Personal leave",
			},
			format="json",
		)
		listed = self.client.get("/api/v1/hr/me/leave-requests/")

		self.assertEqual(created.status_code, 201, created.data)
		self.assertEqual(created.data["employee"], doctor_employee.id)
		self.assertEqual(created.data["total_days"], 2)
		self.assertEqual(listed.data["count"], 1)
		balance.refresh_from_db()
		self.assertEqual(balance.pending_days, 2)

		insufficient = self.client.post(
			"/api/v1/hr/me/leave-requests/",
			{
				"leave_type": leave_type.id,
				"start_date": "2026-09-01",
				"end_date": "2026-09-30",
				"reason": "Extended leave",
			},
			format="json",
		)
		self.assertEqual(insufficient.status_code, 400)
		self.assertIn("total_days", insufficient.data)

	def test_self_service_requires_authentication_and_employee_link(self):
		unauthenticated = self.client.get("/api/v1/hr/me/shifts/")
		self.assertEqual(unauthenticated.status_code, 401)

		leave_type = LeaveType.objects.create(
			hospital=self.hospital,
			name="Personal Leave",
			code="SELF-PERSONAL",
			days_allowed=5,
		)
		self.client.force_authenticate(self.doctor)
		shifts = self.client.get("/api/v1/hr/me/shifts/")
		leave_request = self.client.post(
			"/api/v1/hr/me/leave-requests/",
			{
				"leave_type": leave_type.id,
				"start_date": "2026-10-01",
				"end_date": "2026-10-01",
				"reason": "Personal appointment",
			},
			format="json",
		)

		self.assertEqual(shifts.status_code, 200)
		self.assertEqual(shifts.data["count"], 0)
		self.assertEqual(leave_request.status_code, 400)
		self.assertIn("employee", leave_request.data)

	def test_staff_clock_in_uses_server_time_and_shift_window(self):
		employee = Employee.objects.create(
			hospital=self.hospital,
			user=self.doctor,
			employee_number="CLOCK-001",
			first_name="Clock",
			last_name="Employee",
		)
		shift = Shift.objects.create(
			hospital=self.hospital,
			code="CLOCK-DAY",
			name="Clock Day Shift",
			start_time="08:00",
			end_time="16:00",
		)
		ShiftAssignment.objects.create(
			employee=employee,
			shift=shift,
			start_date="2026-08-01",
		)
		Attendance.objects.create(
			employee=employee,
			attendance_date="2026-08-07",
			clock_in=timezone.make_aware(
				datetime(2026, 8, 7, 8, 0),
				timezone.get_current_timezone(),
			),
			clock_out=timezone.make_aware(
				datetime(2026, 8, 7, 16, 0),
				timezone.get_current_timezone(),
			),
			status="PRESENT",
		)
		self.client.force_authenticate(self.doctor)
		current_timezone = timezone.get_current_timezone()
		too_early = timezone.make_aware(
			datetime(2026, 8, 8, 6, 59),
			current_timezone,
		)
		late_arrival = timezone.make_aware(
			datetime(2026, 8, 8, 8, 30),
			current_timezone,
		)
		too_late = timezone.make_aware(
			datetime(2026, 8, 8, 12, 1),
			current_timezone,
		)

		with patch(
			"human_resources.self_service_views.timezone.now",
			return_value=too_early,
		):
			rejected = self.client.post(
				"/api/v1/hr/me/attendance/clock-in/",
				{},
				format="json",
			)
		with patch(
			"human_resources.self_service_views.timezone.now",
			return_value=too_late,
		):
			closed = self.client.post(
				"/api/v1/hr/me/attendance/clock-in/",
				{},
				format="json",
			)
		with patch(
			"human_resources.self_service_views.timezone.now",
			return_value=late_arrival,
		):
			status_response = self.client.get(
				"/api/v1/hr/me/attendance/status/",
			)
			created = self.client.post(
				"/api/v1/hr/me/attendance/clock-in/",
				{"clock_in": "2026-08-08T07:00:00Z"},
				format="json",
			)
			duplicate = self.client.post(
				"/api/v1/hr/me/attendance/clock-in/",
				{},
				format="json",
			)

		self.assertEqual(rejected.status_code, 400)
		self.assertEqual(closed.status_code, 400)
		self.assertTrue(status_response.data["can_clock_in"])
		self.assertEqual(
			status_response.data["shift"]["name"],
			"Clock Day Shift",
		)
		self.assertEqual(created.status_code, 201, created.data)
		self.assertEqual(created.data["status"], "LATE")
		self.assertEqual(duplicate.status_code, 400)
		attendance = Attendance.objects.get(
			employee=employee,
			attendance_date="2026-08-08",
		)
		self.assertEqual(attendance.clock_in, late_arrival)

	def test_staff_can_clock_out_only_their_open_attendance(self):
		employee = Employee.objects.create(
			hospital=self.hospital,
			user=self.doctor,
			employee_number="CLOCK-OUT-001",
			first_name="Clock",
			last_name="Out",
		)
		clock_in = timezone.make_aware(
			datetime(2026, 8, 8, 8, 0),
			timezone.get_current_timezone(),
		)
		attendance = Attendance.objects.create(
			employee=employee,
			attendance_date="2026-08-08",
			clock_in=clock_in,
			status="PRESENT",
		)
		clock_out = timezone.make_aware(
			datetime(2026, 8, 8, 16, 0),
			timezone.get_current_timezone(),
		)
		self.client.force_authenticate(self.doctor)

		with patch(
			"human_resources.self_service_views.timezone.now",
			return_value=clock_out,
		):
			response = self.client.post(
				"/api/v1/hr/me/attendance/clock-out/",
				{},
				format="json",
			)

		self.assertEqual(response.status_code, 200, response.data)
		attendance.refresh_from_db()
		self.assertEqual(attendance.clock_out, clock_out)

	def test_only_hr_manager_can_adjust_attendance_working_hours(self):
		employee = Employee.objects.create(
			hospital=self.hospital,
			employee_number="ADJUST-HOURS-001",
			first_name="Adjust",
			last_name="Hours",
		)
		shift = Shift.objects.create(
			hospital=self.hospital,
			code="ADJUST-NIGHT",
			name="Adjustable Night Shift",
			start_time="22:00",
			end_time="06:00",
			is_night_shift=True,
		)
		attendance = Attendance.objects.create(
			employee=employee,
			shift=shift,
			attendance_date="2026-08-08",
			status="PRESENT",
		)
		payload = {
			"clock_in": "2026-08-08T22:15:00+05:30",
			"clock_out": "2026-08-09T06:10:00+05:30",
		}

		self.client.force_authenticate(self.hr_officer)
		forbidden = self.client.patch(
			f"/api/v1/hr/attendance/{attendance.id}/",
			payload,
			format="json",
		)

		self.client.force_authenticate(self.hr_manager)
		updated = self.client.patch(
			f"/api/v1/hr/attendance/{attendance.id}/",
			payload,
			format="json",
		)

		self.assertEqual(forbidden.status_code, 403)
		self.assertEqual(updated.status_code, 200, updated.data)
		attendance.refresh_from_db()
		self.assertEqual(
			attendance.clock_out - attendance.clock_in,
			timedelta(hours=7, minutes=55),
		)

	def test_staff_can_complete_an_empty_attendance_row(self):
		employee = Employee.objects.create(
			hospital=self.hospital,
			user=self.doctor,
			employee_number="CLOCK-EMPTY-001",
			first_name="Clock",
			last_name="Placeholder",
		)
		shift = Shift.objects.create(
			hospital=self.hospital,
			code="CLOCK-EMPTY",
			name="Placeholder Shift",
			start_time="08:00",
			end_time="16:00",
		)
		ShiftAssignment.objects.create(
			employee=employee,
			shift=shift,
			start_date="2026-08-01",
		)
		attendance = Attendance.objects.create(
			employee=employee,
			attendance_date="2026-08-08",
			status="PRESENT",
		)
		now = timezone.make_aware(
			datetime(2026, 8, 8, 8, 5),
			timezone.get_current_timezone(),
		)
		self.client.force_authenticate(self.doctor)

		with patch(
			"human_resources.self_service_views.timezone.now",
			return_value=now,
		):
			status_response = self.client.get(
				"/api/v1/hr/me/attendance/status/",
			)
			response = self.client.post(
				"/api/v1/hr/me/attendance/clock-in/",
				{},
				format="json",
			)

		self.assertTrue(status_response.data["can_clock_in"])
		self.assertEqual(response.status_code, 200, response.data)
		attendance.refresh_from_db()
		self.assertEqual(attendance.clock_in, now)
		self.assertEqual(attendance.shift, shift)

	def test_staff_cannot_clock_out_yesterdays_day_shift(self):
		employee = Employee.objects.create(
			hospital=self.hospital,
			user=self.doctor,
			employee_number="CLOCK-STALE-001",
			first_name="Clock",
			last_name="Stale",
		)
		shift = Shift.objects.create(
			hospital=self.hospital,
			code="CLOCK-STALE",
			name="Stale Day Shift",
			start_time="08:00",
			end_time="16:00",
		)
		attendance = Attendance.objects.create(
			employee=employee,
			shift=shift,
			attendance_date="2026-08-07",
			clock_in=timezone.make_aware(
				datetime(2026, 8, 7, 8, 0),
				timezone.get_current_timezone(),
			),
			status="PRESENT",
		)
		now = timezone.make_aware(
			datetime(2026, 8, 8, 8, 0),
			timezone.get_current_timezone(),
		)
		self.client.force_authenticate(self.doctor)

		with patch(
			"human_resources.self_service_views.timezone.now",
			return_value=now,
		):
			status_response = self.client.get(
				"/api/v1/hr/me/attendance/status/",
			)
			response = self.client.post(
				"/api/v1/hr/me/attendance/clock-out/",
				{},
				format="json",
			)

		self.assertFalse(status_response.data["can_clock_out"])
		self.assertEqual(response.status_code, 400)
		attendance.refresh_from_db()
		self.assertIsNone(attendance.clock_out)

	def test_open_overnight_attendance_blocks_another_clock_in(self):
		employee = Employee.objects.create(
			hospital=self.hospital,
			user=self.doctor,
			employee_number="CLOCK-NIGHT-001",
			first_name="Clock",
			last_name="Night",
		)
		shift = Shift.objects.create(
			hospital=self.hospital,
			code="CLOCK-NIGHT",
			name="Night Shift",
			start_time="22:00",
			end_time="06:00",
			is_night_shift=True,
		)
		ShiftAssignment.objects.create(
			employee=employee,
			shift=shift,
			start_date="2026-08-01",
		)
		Attendance.objects.create(
			employee=employee,
			shift=shift,
			attendance_date="2026-08-07",
			clock_in=timezone.make_aware(
				datetime(2026, 8, 7, 22, 0),
				timezone.get_current_timezone(),
			),
			status="PRESENT",
		)
		now = timezone.make_aware(
			datetime(2026, 8, 8, 22, 0),
			timezone.get_current_timezone(),
		)
		self.client.force_authenticate(self.doctor)

		with patch(
			"human_resources.self_service_views.timezone.now",
			return_value=now,
		):
			status_response = self.client.get(
				"/api/v1/hr/me/attendance/status/",
			)
			response = self.client.post(
				"/api/v1/hr/me/attendance/clock-in/",
				{},
				format="json",
			)

		self.assertFalse(status_response.data["can_clock_in"])
		self.assertTrue(status_response.data["can_clock_out"])
		self.assertEqual(
			status_response.data["shift"]["work_date"],
			"2026-08-07",
		)
		self.assertEqual(response.status_code, 400)
		self.assertEqual(Attendance.objects.filter(employee=employee).count(), 1)

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
