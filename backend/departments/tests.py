from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from hospitals.models import Hospital
from budgets.models import BudgetAllocation, BudgetYear
from staff.models import StaffProfile

from .models import Department


class DepartmentTenantIsolationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Department Test Hospital",
			slug="department-test-hospital",
			registration_number="DEPT-TEST-001",
			email="department@example.com",
			phone="700000201",
			max_staff=10,
		)
		self.other_hospital = Hospital.objects.create(
			name="Other Department Hospital",
			slug="other-department-hospital",
			registration_number="DEPT-TEST-002",
			email="other-department@example.com",
			phone="700000202",
			max_staff=10,
		)
		self.department = Department.objects.create(
			hospital=self.hospital,
			name="Emergency",
		)
		self.other_department = Department.objects.create(
			hospital=self.other_hospital,
			name="Cardiology",
		)
		self.admin = User.objects.create_user(
			username="department-admin",
			password="TestPassword123!",
		)
		StaffProfile.objects.create(
			user=self.admin,
			hospital=self.hospital,
			role="admin",
			phone="700000203",
		)
		self.hr_officer = User.objects.create_user(
			username="department-hr-officer",
			password="TestPassword123!",
		)
		StaffProfile.objects.create(
			user=self.hr_officer,
			hospital=self.hospital,
			role="hr_officer",
			phone="700000205",
		)
		self.superuser = User.objects.create_superuser(
			username="department-superuser",
			password="TestPassword123!",
		)

	def test_superuser_requires_hospital_context_to_list_departments(self):
		self.client.force_authenticate(self.superuser)

		unscoped_response = self.client.get("/api/v1/departments/")
		scoped_response = self.client.get(
			f"/api/v1/departments/?hospital_id={self.hospital.id}",
		)

		self.assertEqual(unscoped_response.status_code, 200)
		self.assertEqual(unscoped_response.data["count"], 0)
		self.assertEqual(scoped_response.status_code, 200)
		self.assertEqual(scoped_response.data["count"], 1)
		self.assertEqual(scoped_response.data["results"][0]["id"], self.department.id)

	def test_admin_cannot_create_staff_in_another_hospitals_department(self):
		self.client.force_authenticate(self.admin)

		response = self.client.post(
			"/api/v1/staff/",
			{
				"first_name": "Cross",
				"last_name": "Tenant",
				"email": "cross-tenant@example.com",
				"password": "TestPassword123!",
				"role": "nurse",
				"department": self.other_department.id,
				"phone": "700000204",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("department", response.data)
		self.assertFalse(
			StaffProfile.objects.filter(
				user__email="cross-tenant@example.com",
			).exists()
		)

	def test_hr_officer_can_read_but_cannot_change_departments(self):
		self.client.force_authenticate(self.hr_officer)

		list_response = self.client.get("/api/v1/hr/departments/")
		create_response = self.client.post(
			"/api/v1/hr/departments/",
			{"name": "Laboratory"},
			format="json",
		)

		self.assertEqual(list_response.status_code, 200)
		self.assertEqual(list_response.data["count"], 1)
		self.assertEqual(
			list_response.data["results"][0]["id"],
			self.department.id,
		)
		self.assertEqual(create_response.status_code, 403)

	def test_admin_department_crud_is_persisted_and_tenant_scoped(self):
		self.client.force_authenticate(self.admin)

		created = self.client.post(
			"/api/v1/hr/departments/",
			{
				"name": "Laboratory",
				"description": "Diagnostic services",
				"rooms": 3,
			},
			format="json",
		)
		cross_tenant_update = self.client.patch(
			f"/api/v1/hr/departments/{self.other_department.id}/",
			{"name": "Changed"},
			format="json",
		)

		self.assertEqual(created.status_code, 201, created.data)
		created_department = Department.objects.get(id=created.data["id"])
		self.assertEqual(created_department.hospital, self.hospital)
		self.assertEqual(created_department.rooms, 3)
		self.assertEqual(cross_tenant_update.status_code, 404)
		self.other_department.refresh_from_db()
		self.assertEqual(self.other_department.name, "Cardiology")

	def test_department_input_validation_rejects_duplicates_and_negative_rooms(self):
		self.client.force_authenticate(self.admin)

		duplicate = self.client.post(
			"/api/v1/hr/departments/",
			{"name": " emergency "},
			format="json",
		)
		negative_rooms = self.client.post(
			"/api/v1/hr/departments/",
			{"name": "Laboratory", "rooms": -1},
			format="json",
		)

		self.assertEqual(duplicate.status_code, 400)
		self.assertIn("name", duplicate.data)
		self.assertEqual(negative_rooms.status_code, 400)
		self.assertIn("rooms", negative_rooms.data)

	def test_department_with_budget_records_cannot_be_deleted(self):
		budget_year = BudgetYear.objects.create(
			hospital=self.hospital,
			year=2026,
			start_date="2026-01-01",
			end_date="2026-12-31",
			total_budget="10000.00",
		)
		allocation = BudgetAllocation.objects.create(
			budget_year=budget_year,
			department=self.department,
			period_start="2026-01-01",
			period_end="2026-12-31",
			allocated_amount="5000.00",
		)
		self.client.force_authenticate(self.admin)

		response = self.client.delete(
			f"/api/v1/hr/departments/{self.department.id}/"
		)

		self.assertEqual(response.status_code, 400)
		self.assertTrue(Department.objects.filter(id=self.department.id).exists())
		self.assertTrue(BudgetAllocation.objects.filter(id=allocation.id).exists())
