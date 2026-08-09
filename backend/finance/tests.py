from decimal import Decimal

from django.test import TestCase
from django.contrib.auth.models import User

from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile
from human_resources.models import Employee
from finance.models import (
	AccountCategory,
	AllowanceType,
	ChartOfAccount,
	DeductionType,
	EmployeeSalary,
	JournalEntry,
	PayrollYear,
	SalaryPayment,
	SalarySlip,
	SalaryStructure,
)



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

	def test_finance_roles_can_load_patient_and_billing_dashboard_metrics(self):
		for index, role in enumerate(("finance", "finance_manager", "cashier")):
			with self.subTest(role=role):
				user = User.objects.create_user(username=f"dashboard-{role}")
				StaffProfile.objects.create(
					user=user,
					hospital=self.hospital,
					role=role,
					phone=f"123456789{index + 2}",
				)
				self.client.force_authenticate(user=user)

				patient_stats = self.client.get("/api/v1/patients/stats/")
				billing_stats = self.client.get("/api/v1/bills/stats/")

				self.assertEqual(patient_stats.status_code, 200)
				self.assertEqual(billing_stats.status_code, 200)

	def test_accountant_can_view_payroll_slips(self):
		self.client.force_authenticate(user=self.accountant)

		response = self.client.get("/api/v1/finance/salary-slips/")

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

	def test_accountant_can_edit_only_draft_journals(self):
		self.client.force_authenticate(self.accountant)
		payload = self.journal_payload()
		payload["post_immediately"] = False
		created = self.client.post(
			"/api/v1/finance/accounting/journals/",
			payload,
			format="json",
		)
		journal_id = created.data["id"]
		update_payload = {
			"reference": "EDITED-001",
			"description": "Edited service income",
			"lines": [
				{"account": self.cash_account.id, "debit": "125.00"},
				{"account": self.revenue_account.id, "credit": "125.00"},
			],
		}

		updated = self.client.patch(
			f"/api/v1/finance/accounting/journals/{journal_id}/",
			update_payload,
			format="json",
		)

		self.assertEqual(updated.status_code, 200, updated.data)
		journal = JournalEntry.objects.get(pk=journal_id)
		self.assertEqual(journal.reference, "EDITED-001")
		self.assertEqual(journal.lines.count(), 2)
		self.assertEqual(
			sum(line.debit for line in journal.lines.all()),
			Decimal("125.00"),
		)

		journal.post(user=self.accountant)
		rejected = self.client.patch(
			f"/api/v1/finance/accounting/journals/{journal_id}/",
			update_payload,
			format="json",
		)
		self.assertEqual(rejected.status_code, 400)


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


class PayrollSecurityWorkflowTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Payroll Security Hospital",
			slug="payroll-security-hospital",
			registration_number="PAYROLL-SEC-001",
			email="payroll-security@example.com",
			phone="700003001",
		)
		self.other_hospital = Hospital.objects.create(
			name="Other Payroll Hospital",
			slug="other-payroll-hospital",
			registration_number="PAYROLL-SEC-002",
			email="other-payroll@example.com",
			phone="700003002",
		)
		self.admin = User.objects.create_user(
			username="payroll-security-admin",
			password="TestPassword123!",
		)
		StaffProfile.objects.create(
			user=self.admin,
			hospital=self.hospital,
			role="admin",
			phone="700003003",
		)
		self.employee = Employee.objects.create(
			hospital=self.hospital,
			employee_number="PAY-001",
			first_name="Payroll",
			last_name="Employee",
		)
		self.structure = SalaryStructure.objects.create(
			hospital=self.hospital,
			name="Standard",
			base_salary="1000.00",
		)
		self.other_structure = SalaryStructure.objects.create(
			hospital=self.other_hospital,
			name="Other Standard",
			base_salary="1000.00",
		)

	def test_salary_assignment_rejects_cross_hospital_structure(self):
		self.client.force_authenticate(self.admin)

		response = self.client.post(
			"/api/v1/finance/employee-salaries/",
			{
				"employee": self.employee.id,
				"salary_structure_id": self.other_structure.id,
				"effective_from": "2026-01-01",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertFalse(EmployeeSalary.objects.exists())

	def test_hr_manager_can_create_and_update_salary_assignment(self):
		replacement_structure = SalaryStructure.objects.create(
			hospital=self.hospital,
			name="Senior Standard",
			base_salary="1500.00",
		)
		self.client.force_authenticate(self.admin)

		created = self.client.post(
			"/api/v1/finance/employee-salaries/",
			{
				"employee": self.employee.id,
				"salary_structure_id": self.structure.id,
				"effective_from": "2026-01-01",
			},
			format="json",
		)
		updated = self.client.patch(
			f"/api/v1/finance/employee-salaries/{created.data.get('id')}/",
			{
				"salary_structure_id": replacement_structure.id,
				"effective_from": "2026-08-01",
			},
			format="json",
		)

		self.assertEqual(created.status_code, 201, created.data)
		self.assertEqual(updated.status_code, 200, updated.data)
		assignment = EmployeeSalary.objects.get(employee=self.employee)
		self.assertEqual(assignment.salary_structure, replacement_structure)
		self.assertEqual(str(assignment.effective_from), "2026-08-01")

	def test_approved_salary_slip_creates_and_protects_payment(self):
		self.client.force_authenticate(self.admin)
		created = self.client.post(
			"/api/v1/finance/salary-slips/",
			{
				"employee": self.employee.id,
				"month": "2026-08-01",
				"salary_structure": self.structure.id,
				"status": "paid",
			},
			format="json",
		)
		self.assertEqual(created.status_code, 201, created.data)
		self.assertEqual(created.data["status"], "generated")
		slip_id = created.data["id"]

		approved = self.client.post(
			f"/api/v1/finance/salary-slips/{slip_id}/approve/"
		)
		updated = self.client.patch(
			f"/api/v1/finance/salary-slips/{slip_id}/",
			{"notes": "Changed after approval"},
			format="json",
		)
		rejected = self.client.post(
			f"/api/v1/finance/salary-slips/{slip_id}/reject/"
		)
		deleted = self.client.delete(
			f"/api/v1/finance/salary-slips/{slip_id}/"
		)

		self.assertEqual(approved.status_code, 200, approved.data)
		self.assertEqual(updated.status_code, 400)
		self.assertEqual(rejected.status_code, 400)
		self.assertEqual(deleted.status_code, 400)
		self.assertEqual(SalaryPayment.objects.filter(salary_slip_id=slip_id).count(), 1)
		self.assertEqual(
			SalaryPayment.objects.get(salary_slip_id=slip_id).status,
			"pending",
		)
		self.assertEqual(SalarySlip.objects.get(id=slip_id).status, "approved")

	def test_salary_payment_is_action_only_and_cannot_be_processed_twice(self):
		self.client.force_authenticate(self.admin)
		slip = SalarySlip.objects.create(
			employee=self.employee,
			month="2026-09-01",
			salary_structure=self.structure,
			base_salary="1000.00",
			total_allowances="0.00",
			gross_salary="1000.00",
			total_deductions="0.00",
			net_salary="1000.00",
			status="approved",
		)
		payment = SalaryPayment.objects.create(
			salary_slip=slip,
			status="pending",
		)

		created = self.client.post(
			"/api/v1/finance/salary-payments/",
			{"salary_slip": slip.id},
			format="json",
		)
		updated = self.client.patch(
			f"/api/v1/finance/salary-payments/{payment.id}/",
			{"status": "processed"},
			format="json",
		)
		deleted = self.client.delete(
			f"/api/v1/finance/salary-payments/{payment.id}/"
		)
		processed = self.client.post(
			f"/api/v1/finance/salary-payments/{payment.id}/mark_paid/",
			{"payment_method": "bank_transfer", "reference_number": "PAY-001"},
			format="json",
		)
		repeated = self.client.post(
			f"/api/v1/finance/salary-payments/{payment.id}/mark_paid/",
			{"payment_method": "cash"},
			format="json",
		)

		self.assertEqual(created.status_code, 405)
		self.assertEqual(updated.status_code, 405)
		self.assertEqual(deleted.status_code, 405)
		self.assertEqual(processed.status_code, 200, processed.data)
		self.assertEqual(repeated.status_code, 400)
		payment.refresh_from_db()
		slip.refresh_from_db()
		self.assertEqual(payment.status, "processed")
		self.assertEqual(payment.payment_method, "bank_transfer")
		self.assertEqual(slip.status, "paid")

	def test_salary_structure_persists_components_and_rejects_other_hospital(self):
		self.client.force_authenticate(self.admin)
		allowance = AllowanceType.objects.create(
			hospital=self.hospital,
			code="HOUSING",
			name="Housing",
		)
		deduction = DeductionType.objects.create(
			hospital=self.hospital,
			code="TAX",
			name="Tax",
		)
		other_allowance = AllowanceType.objects.create(
			hospital=self.other_hospital,
			code="OTHER",
			name="Other",
		)

		created = self.client.post(
			"/api/v1/finance/salary-structures/",
			{
				"name": "Clinical",
				"base_salary": "2000.00",
				"allowances": [{
					"allowance_type_id": allowance.id,
					"amount": "10.00",
					"is_percentage": True,
				}],
				"deductions": [{
					"deduction_type_id": deduction.id,
					"amount": "50.00",
					"is_percentage": False,
				}],
			},
			format="json",
		)
		cross_hospital = self.client.post(
			"/api/v1/finance/salary-structures/",
			{
				"name": "Invalid",
				"base_salary": "1000.00",
				"allowances": [{
					"allowance_type_id": other_allowance.id,
					"amount": "5.00",
					"is_percentage": True,
				}],
			},
			format="json",
		)

		self.assertEqual(created.status_code, 201, created.data)
		structure = SalaryStructure.objects.get(id=created.data["id"])
		self.assertEqual(structure.allowances.count(), 1)
		self.assertEqual(structure.deductions.count(), 1)
		self.assertEqual(cross_hospital.status_code, 400)

	def test_finance_manager_can_manage_payroll_configuration(self):
		finance_manager = User.objects.create_user(
			username="payroll-finance-manager",
			password="Finance@1234",
			is_staff=True,
		)
		StaffProfile.objects.create(
			user=finance_manager,
			hospital=self.hospital,
			role="finance_manager",
			phone="1234567899",
		)
		self.client.force_authenticate(finance_manager)

		payroll_year = self.client.post(
			"/api/v1/finance/payroll-years/",
			{
				"year": 2027,
				"start_date": "2027-01-01",
				"end_date": "2027-12-31",
			},
			format="json",
		)
		allowance = self.client.post(
			"/api/v1/finance/allowance-types/",
			{"code": "TRAVEL", "name": "Travel"},
			format="json",
		)
		deduction = self.client.post(
			"/api/v1/finance/deduction-types/",
			{"code": "LEVY", "name": "Levy"},
			format="json",
		)
		structure = self.client.post(
			"/api/v1/finance/salary-structures/",
			{
				"name": "Finance Managed",
				"base_salary": "1500.00",
				"allowances": [{
					"allowance_type_id": allowance.data.get("id"),
					"amount": "100.00",
					"is_percentage": False,
				}],
				"deductions": [{
					"deduction_type_id": deduction.data.get("id"),
					"amount": "5.00",
					"is_percentage": True,
				}],
			},
			format="json",
		)

		self.assertEqual(payroll_year.status_code, 201, payroll_year.data)
		self.assertEqual(allowance.status_code, 201, allowance.data)
		self.assertEqual(deduction.status_code, 201, deduction.data)
		self.assertEqual(structure.status_code, 201, structure.data)

	def test_salary_structure_update_replaces_components(self):
		allowance = AllowanceType.objects.create(
			hospital=self.hospital,
			code="MEAL",
			name="Meal",
		)
		deduction = DeductionType.objects.create(
			hospital=self.hospital,
			code="PENSION",
			name="Pension",
		)
		self.client.force_authenticate(self.admin)

		response = self.client.put(
			f"/api/v1/finance/salary-structures/{self.structure.id}/",
			{
				"name": "Updated Standard",
				"description": "Updated through payroll configuration",
				"base_salary": "1800.00",
				"is_active": True,
				"allowances": [{
					"allowance_type_id": allowance.id,
					"amount": "10.00",
					"is_percentage": True,
				}],
				"deductions": [{
					"deduction_type_id": deduction.id,
					"amount": "25.00",
					"is_percentage": False,
				}],
			},
			format="json",
		)

		self.assertEqual(response.status_code, 200, response.data)
		self.structure.refresh_from_db()
		self.assertEqual(self.structure.name, "Updated Standard")
		self.assertEqual(self.structure.allowances.count(), 1)
		self.assertEqual(self.structure.deductions.count(), 1)

	def test_payroll_year_is_unique_per_hospital(self):
		PayrollYear.objects.create(
			hospital=self.other_hospital,
			year=2027,
			start_date="2027-01-01",
			end_date="2027-12-31",
		)
		self.client.force_authenticate(self.admin)

		response = self.client.post(
			"/api/v1/finance/payroll-years/",
			{
				"year": 2027,
				"start_date": "2027-01-01",
				"end_date": "2027-12-31",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201, response.data)

	def test_payroll_year_rejects_reversed_dates(self):
		self.client.force_authenticate(self.admin)

		response = self.client.post(
			"/api/v1/finance/payroll-years/",
			{
				"year": 2027,
				"start_date": "2027-12-31",
				"end_date": "2027-01-01",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400, response.data)
		self.assertIn("end_date", response.data)

	def test_payroll_configuration_rejects_hospital_duplicates(self):
		PayrollYear.objects.create(
			hospital=self.hospital,
			year=2027,
			start_date="2027-01-01",
			end_date="2027-12-31",
		)
		AllowanceType.objects.create(
			hospital=self.hospital,
			code="HOUSE",
			name="Housing",
		)
		DeductionType.objects.create(
			hospital=self.hospital,
			code="TAX",
			name="Tax",
		)
		self.client.force_authenticate(self.admin)

		requests = (
			(
				"/api/v1/finance/payroll-years/",
				{
					"year": 2027,
					"start_date": "2027-01-01",
					"end_date": "2027-12-31",
				},
			),
			(
				"/api/v1/finance/allowance-types/",
				{"code": "HOUSE", "name": "Another Housing"},
			),
			(
				"/api/v1/finance/deduction-types/",
				{"code": "TAX", "name": "Another Tax"},
			),
			(
				"/api/v1/finance/salary-structures/",
				{"name": "Standard", "base_salary": "2000.00"},
			),
		)

		for endpoint, payload in requests:
			with self.subTest(endpoint=endpoint):
				response = self.client.post(endpoint, payload, format="json")
				self.assertEqual(response.status_code, 400, response.data)
