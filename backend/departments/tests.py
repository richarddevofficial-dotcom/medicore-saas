from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from hospitals.models import Hospital
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
