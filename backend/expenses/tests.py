from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile

from .models import Expense, ExpenseApprovalLog, ExpenseCategory, ExpensePayment


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
