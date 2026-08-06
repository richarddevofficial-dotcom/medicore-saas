from decimal import Decimal

from django.test import TestCase
from django.contrib.auth.models import User

from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile
from finance.models import AccountCategory, ChartOfAccount, JournalEntry



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

	def test_accounting_reports_include_opening_balances(self):
		asset_category = AccountCategory.objects.create(
			hospital=self.hospital,
			name="Current Assets",
			code="ASSET",
			account_type="asset",
			normal_balance="debit",
		)
		equity_category = AccountCategory.objects.create(
			hospital=self.hospital,
			name="Owner Equity",
			code="EQUITY",
			account_type="equity",
			normal_balance="credit",
		)
		cash_account = ChartOfAccount.objects.create(
			hospital=self.hospital,
			category=asset_category,
			name="Cash",
			code="1000",
			opening_balance="100.00",
		)
		ChartOfAccount.objects.create(
			hospital=self.hospital,
			category=equity_category,
			name="Opening Equity",
			code="3000",
			opening_balance="100.00",
		)
		self.client.force_authenticate(user=self.user)

		trial_balance = self.client.get(
			"/api/v1/finance/accounting/reports/trial-balance/",
		)
		general_ledger = self.client.get(
			"/api/v1/finance/accounting/reports/general-ledger/",
			{"account": cash_account.id},
		)
		balance_sheet = self.client.get(
			"/api/v1/finance/accounting/reports/balance-sheet/",
		)

		self.assertEqual(trial_balance.status_code, 200)
		self.assertEqual(
			trial_balance.data["totals"]["debit"],
			Decimal("100.00"),
		)
		self.assertEqual(
			trial_balance.data["totals"]["credit"],
			Decimal("100.00"),
		)
		self.assertEqual(general_ledger.status_code, 200)
		self.assertEqual(
			general_ledger.data["opening_balance"],
			Decimal("100.00"),
		)
		self.assertEqual(
			general_ledger.data["closing_balance"],
			Decimal("100.00"),
		)
		self.assertEqual(balance_sheet.status_code, 200)
		self.assertEqual(
			balance_sheet.data["totals"]["assets"],
			Decimal("100.00"),
		)
		self.assertEqual(
			balance_sheet.data["totals"]["equity"],
			Decimal("100.00"),
		)


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

	def test_accountant_can_load_shared_dashboard_metrics(self):
		self.client.force_authenticate(user=self.accountant)

		for endpoint in (
			"/api/v1/patients/stats/",
			"/api/v1/bills/stats/",
			"/api/v1/staff/stats/",
			"/api/v1/reports/dashboard-charts/",
		):
			with self.subTest(endpoint=endpoint):
				response = self.client.get(endpoint)
				self.assertEqual(response.status_code, 200)


class JournalPostingAuthorizationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Journal Authorization Hospital",
			slug="journal-authorization-hospital",
			hospital_type="general",
			registration_number="JOURNAL-AUTH-001",
			email="journal-auth@example.com",
			phone="1234567892",
			address="123 Finance Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.finance_user = User.objects.create_user(
			username="finance-officer",
			password="Finance@1234",
		)
		StaffProfile.objects.create(
			user=self.finance_user,
			hospital=self.hospital,
			role="finance",
			phone="1234567893",
		)
		self.accountant = User.objects.create_user(
			username="journal-accountant",
			password="Accountant@1234",
		)
		StaffProfile.objects.create(
			user=self.accountant,
			hospital=self.hospital,
			role="accountant",
			phone="1234567894",
		)
		asset_category = AccountCategory.objects.create(
			hospital=self.hospital,
			name="Current Assets",
			code="ASSET",
			account_type="asset",
			normal_balance="debit",
		)
		revenue_category = AccountCategory.objects.create(
			hospital=self.hospital,
			name="Revenue",
			code="REVENUE",
			account_type="revenue",
			normal_balance="credit",
		)
		self.cash_account = ChartOfAccount.objects.create(
			hospital=self.hospital,
			category=asset_category,
			name="Cash",
			code="1000",
		)
		self.revenue_account = ChartOfAccount.objects.create(
			hospital=self.hospital,
			category=revenue_category,
			name="Service Revenue",
			code="4000",
		)

	def journal_payload(self):
		return {
			"hospital": self.hospital.id,
			"description": "Record service income",
			"lines": [
				{"account": self.cash_account.id, "debit": "100.00"},
				{"account": self.revenue_account.id, "credit": "100.00"},
			],
			"post_immediately": True,
		}

	def test_finance_officer_cannot_post_a_journal_during_creation(self):
		self.client.force_authenticate(self.finance_user)

		response = self.client.post(
			"/api/v1/finance/accounting/journals/",
			self.journal_payload(),
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("post_immediately", response.data)
		self.assertEqual(JournalEntry.objects.count(), 0)

	def test_accountant_can_post_a_journal_during_creation(self):
		self.client.force_authenticate(self.accountant)

		response = self.client.post(
			"/api/v1/finance/accounting/journals/",
			self.journal_payload(),
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		journal = JournalEntry.objects.get()
		self.assertEqual(journal.status, JournalEntry.Status.POSTED)
		self.assertEqual(journal.posted_by, self.accountant)

	def test_finance_officer_can_create_a_journal_without_hospital_input(self):
		self.client.force_authenticate(self.finance_user)
		payload = self.journal_payload()
		payload.pop("hospital")
		payload["post_immediately"] = False

		response = self.client.post(
			"/api/v1/finance/accounting/journals/",
			payload,
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(
			JournalEntry.objects.get().hospital,
			self.hospital,
		)


class PayrollPermissionsTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Payroll Permissions Hospital",
			slug="payroll-permissions-hospital",
			hospital_type="general",
			registration_number="PAYROLL-PERM-001",
			email="payroll-permissions@example.com",
			phone="1234567895",
			address="123 Payroll Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.admin = User.objects.create_user(
			username="payroll-admin",
			password="Admin@1234",
		)
		StaffProfile.objects.create(
			user=self.admin,
			hospital=self.hospital,
			role="admin",
			phone="1234567896",
		)
		self.hr_officer = User.objects.create_user(
			username="payroll-hr-officer",
			password="HrOfficer@1234",
		)
		StaffProfile.objects.create(
			user=self.hr_officer,
			hospital=self.hospital,
			role="hr_officer",
			phone="1234567897",
		)

	def test_staff_profile_admin_can_access_payroll_years(self):
		self.client.force_authenticate(self.admin)

		response = self.client.get("/api/v1/finance/payroll-years/")

		self.assertEqual(response.status_code, 200)

	def test_hr_officer_cannot_bulk_generate_salary_slips(self):
		self.client.force_authenticate(self.hr_officer)

		response = self.client.post(
			"/api/v1/finance/salary-slips/generate_bulk/",
			{"month": "2026-08-01"},
			format="json",
		)

		self.assertEqual(response.status_code, 403)
