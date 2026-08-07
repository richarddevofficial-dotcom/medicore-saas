from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from hospitals.models import Hospital
from patients.models import Patient
from staff.models import StaffProfile

from .models import LabTest


class LabTestApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Laboratory Test Hospital",
			slug="laboratory-test-hospital",
			registration_number="LAB-TEST-001",
			email="lab@example.com",
			phone="700000101",
		)
		self.other_hospital = Hospital.objects.create(
			name="Other Laboratory Hospital",
			slug="other-laboratory-hospital",
			registration_number="LAB-TEST-002",
			email="other-lab@example.com",
			phone="700000102",
		)
		self.user = User.objects.create_user(
			username="lab-technician",
			password="TestPassword123!",
		)
		self.staff = StaffProfile.objects.create(
			user=self.user,
			hospital=self.hospital,
			role="lab_technician",
			phone="700000103",
		)
		self.patient = Patient.objects.create(
			hospital=self.hospital,
			first_name="Lab",
			last_name="Patient",
			date_of_birth=date(1990, 1, 1),
			gender="M",
			phone="700000104",
		)
		other_patient = Patient.objects.create(
			hospital=self.other_hospital,
			first_name="Other",
			last_name="Patient",
			date_of_birth=date(1991, 1, 1),
			gender="F",
			phone="700000105",
		)
		self.lab_test = LabTest.objects.create(
			hospital=self.hospital,
			patient=self.patient,
			test_name="Complete Blood Count",
			category="Hematology",
		)
		self.other_lab_test = LabTest.objects.create(
			hospital=self.other_hospital,
			patient=other_patient,
			test_name="Other Hospital Test",
		)

	def test_lab_technician_can_complete_own_hospital_test(self):
		self.client.force_authenticate(self.user)

		response = self.client.patch(
			f"/api/v1/lab-tests/{self.lab_test.id}/",
			{"status": "completed", "result": "Within normal range."},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.lab_test.refresh_from_db()
		self.assertEqual(self.lab_test.status, "completed")
		self.assertEqual(self.lab_test.performed_by, self.staff)
		self.assertIsNotNone(self.lab_test.completed_at)

	def test_lab_technician_cannot_access_another_hospitals_test(self):
		self.client.force_authenticate(self.user)

		list_response = self.client.get("/api/v1/lab-tests/")
		detail_response = self.client.get(
			f"/api/v1/lab-tests/{self.other_lab_test.id}/",
		)

		self.assertEqual(list_response.status_code, 200)
		self.assertEqual(len(list_response.data), 1)
		self.assertEqual(list_response.data[0]["id"], self.lab_test.id)
		self.assertEqual(detail_response.status_code, 404)
