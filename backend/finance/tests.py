from django.test import TestCase
from django.contrib.auth.models import User

from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile



class AccountingReportsTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Accounting Reports Hospital",
			slug="accounting-reports-hospital",
			hospital_type="general",
			registration_number="ACCOUNTING-001",
			email="accounting@example.com",
			phone="1234567890",
			address="123 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.user = User.objects.create_user(
			username="accounting-admin",
			email="accounting-admin@example.com",
			password="Admin@1234",
			is_staff=True,
		)
		StaffProfile.objects.create(
			user=self.user,
			hospital=self.hospital,
			role="admin",
			phone="1234567890",
		)

	def test_trial_balance_uses_authenticated_users_hospital(self):
		self.client.force_authenticate(user=self.user)

		response = self.client.get(
			"/api/v1/finance/accounting/reports/trial-balance/",
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["hospital"]["id"], self.hospital.id)
		self.assertEqual(response.data["accounts"], [])
