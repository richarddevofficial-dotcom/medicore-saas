from django.test import TestCase
from django.contrib.auth.models import User

from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile
from finance.models import AccountCategory, ChartOfAccount



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


class AccountingPermissionsTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Accountant Permissions Hospital",
			slug="accountant-permissions-hospital",
			hospital_type="general",
			registration_number="ACCOUNTANT-PERMISSIONS-001",
			email="accountant-permissions@example.com",
			phone="1234567890",
			address="123 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.accountant = User.objects.create_user(
			username="accountant-user",
			password="Accountant@1234",
			is_staff=True,
		)
		StaffProfile.objects.create(
			user=self.accountant,
			hospital=self.hospital,
			role="accountant",
			phone="1234567890",
		)
		self.nurse = User.objects.create_user(
			username="nurse-user",
			password="Nurse@1234",
			is_staff=True,
		)
		StaffProfile.objects.create(
			user=self.nurse,
			hospital=self.hospital,
			role="nurse",
			phone="1234567891",
		)
		category = AccountCategory.objects.create(
			hospital=self.hospital,
			name="Current Assets",
			code="ASSET",
			account_type="asset",
			normal_balance="debit",
		)
		self.account = ChartOfAccount.objects.create(
			hospital=self.hospital,
			category=category,
			name="Cash on Hand",
			code="1000",
			is_active=False,
		)

	def test_accountant_can_activate_an_account(self):
		self.client.force_authenticate(user=self.accountant)

		response = self.client.post(
			f"/api/v1/finance/accounting/accounts/{self.account.id}/activate/",
		)

		self.assertEqual(response.status_code, 200)
		self.account.refresh_from_db()
		self.assertTrue(self.account.is_active)

	def test_non_finance_staff_cannot_activate_an_account(self):
		self.client.force_authenticate(user=self.nurse)

		response = self.client.post(
			f"/api/v1/finance/accounting/accounts/{self.account.id}/activate/",
		)

		self.assertEqual(response.status_code, 403)

	def test_non_finance_staff_cannot_list_accounts(self):
		self.client.force_authenticate(user=self.nurse)

		response = self.client.get(
			"/api/v1/finance/accounting/accounts/",
		)

		self.assertEqual(response.status_code, 403)
