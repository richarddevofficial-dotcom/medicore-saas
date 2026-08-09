from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile

from .models import Expense, ExpenseApprovalLog, ExpenseCategory, ExpensePayment


class ExpenseSecurityWorkflowTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Expense Security Hospital",
			slug="expense-security-hospital",
			registration_number="EXPENSE-SEC-001",
			email="expense-security@example.com",
			phone="700002001",
		)
		self.other_hospital = Hospital.objects.create(
			name="Other Expense Hospital",
			slug="other-expense-hospital",
			registration_number="EXPENSE-SEC-002",
			email="other-expense@example.com",
			phone="700002002",
		)
		self.category = ExpenseCategory.objects.create(
			hospital=self.hospital,
			code="SUPPLIES",
			name="Supplies",
		)
		self.other_category = ExpenseCategory.objects.create(
			hospital=self.other_hospital,
			code="OTHER",
			name="Other",
		)
		self.finance_user = User.objects.create_user(
			username="expense-finance-user",
			password="TestPassword123!",
		)
		StaffProfile.objects.create(
			user=self.finance_user,
			hospital=self.hospital,
			role="finance",
			phone="700002003",
		)
		self.finance_manager = User.objects.create_user(
			username="expense-finance-manager",
			password="TestPassword123!",
		)
		StaffProfile.objects.create(
			user=self.finance_manager,
			hospital=self.hospital,
			role="finance_manager",
			phone="700002004",
		)

	def expense_payload(self, **overrides):
		payload = {
			"category": self.category.id,
			"description": "Medical supplies",
			"amount": "125.00",
			"expense_date": "2026-08-09",
		}
		payload.update(overrides)
		return payload

	def test_finance_user_creates_only_same_hospital_draft_expense(self):
		self.client.force_authenticate(self.finance_user)

		created = self.client.post(
			"/api/v1/expenses/expenses/",
			self.expense_payload(status="approved"),
			format="json",
		)
		cross_tenant = self.client.post(
			"/api/v1/expenses/expenses/",
			self.expense_payload(category=self.other_category.id),
			format="json",
		)

		self.assertEqual(created.status_code, 201, created.data)
		self.assertEqual(created.data["status"], "draft")
		self.assertEqual(cross_tenant.status_code, 400)
		self.assertEqual(
			Expense.objects.get(id=created.data["id"]).hospital,
			self.hospital,
		)

	def test_approved_expense_and_payment_cannot_be_changed_or_deleted(self):
		expense = Expense.objects.create(
			hospital=self.hospital,
			category=self.category,
			submitted_by=self.finance_user,
			description="Approved supplies",
			amount="125.00",
			expense_date="2026-08-09",
			status="submitted",
		)
		self.client.force_authenticate(self.finance_manager)
		approved = self.client.post(
			f"/api/v1/expenses/expenses/{expense.id}/approve/"
		)
		updated = self.client.patch(
			f"/api/v1/expenses/expenses/{expense.id}/",
			{"amount": "1.00"},
			format="json",
		)
		deleted = self.client.delete(
			f"/api/v1/expenses/expenses/{expense.id}/"
		)
		payment = ExpensePayment.objects.get(expense=expense)
		payment_created = self.client.post(
			"/api/v1/expenses/payments/",
			{"expense": expense.id},
			format="json",
		)
		payment_updated = self.client.patch(
			f"/api/v1/expenses/payments/{payment.id}/",
			{"status": "processed"},
			format="json",
		)
		payment_deleted = self.client.delete(
			f"/api/v1/expenses/payments/{payment.id}/"
		)

		self.assertEqual(approved.status_code, 200, approved.data)
		self.assertEqual(updated.status_code, 400)
		self.assertEqual(deleted.status_code, 400)
		self.assertEqual(payment_created.status_code, 405)
		self.assertEqual(payment_updated.status_code, 405)
		self.assertEqual(payment_deleted.status_code, 405)
		self.assertTrue(Expense.objects.filter(id=expense.id).exists())
		self.assertTrue(ExpensePayment.objects.filter(expense=expense).exists())


class ExpenseWorkflowTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Expense Test Hospital",
			email="expenses@example.com",
			phone="700000001",
		)
		self.category = ExpenseCategory.objects.create(
			hospital=self.hospital,
			code="SUPPLIES",
			name="Medical Supplies",
		)
		self.submitter = User.objects.create_user(
			username="expense-hr",
			password="TestPassword123!",
		)
		self.manager = User.objects.create_user(
			username="expense-manager",
			password="TestPassword123!",
		)
		StaffProfile.objects.create(
			user=self.submitter,
			hospital=self.hospital,
			role="hr",
			phone="700000002",
		)
		StaffProfile.objects.create(
			user=self.manager,
			hospital=self.hospital,
			role="hr_manager",
			phone="700000003",
		)
		self.expense = Expense.objects.create(
			hospital=self.hospital,
			category=self.category,
			submitted_by=self.submitter,
			description="Test medical supplies",
			amount=Decimal("125.00"),
			expense_date=timezone.localdate(),
		)

	def test_hr_manager_role_can_approve_submitted_expense(self):
		self.client.force_authenticate(self.submitter)
		submitted = self.client.post(
			f"/api/v1/expenses/expenses/{self.expense.id}/submit/",
		)
		self.assertEqual(submitted.status_code, 200)

		self.client.force_authenticate(self.manager)
		approved = self.client.post(
			f"/api/v1/expenses/expenses/{self.expense.id}/approve/",
			{"approval_notes": "Approved for testing."},
			format="json",
		)

		self.assertEqual(approved.status_code, 200)
		self.expense.refresh_from_db()
		self.assertEqual(self.expense.status, "approved")
		self.assertEqual(self.expense.approved_by, self.manager)
		self.assertTrue(ExpensePayment.objects.filter(expense=self.expense).exists())
		self.assertEqual(
			list(
				ExpenseApprovalLog.objects.filter(expense=self.expense)
				.order_by("action")
				.values_list("action", flat=True),
			),
			["approved", "submitted"],
		)
