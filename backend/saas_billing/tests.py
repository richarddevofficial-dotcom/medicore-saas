from datetime import timedelta
from decimal import Decimal

from django.core.management import call_command
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from auditlog.models import AuditLog
from billing.models import SubscriptionPayment
from hospitals.models import Hospital
from staff.models import StaffProfile

from .models import HospitalSubscription, Invoice, Payment, SubscriptionPlan
from .plan_change_services import create_plan_change_invoice


class SubscriptionCatalogTests(TestCase):
	def test_seeded_catalog_has_free_trial_and_paid_plans(self):
		call_command("seed_subscription_plans")

		prices = dict(
			SubscriptionPlan.objects.values_list("code", "monthly_price"),
		)
		self.assertEqual(str(prices["starter"]), "0.00")
		self.assertEqual(str(prices["basic"]), "49.90")
		self.assertEqual(str(prices["pro"]), "89.90")
		self.assertEqual(str(prices["enterprise"]), "129.90")

	def test_seed_reconciles_legacy_professional_plan_by_name(self):
		legacy_plan = SubscriptionPlan.objects.create(
			code="professional",
			name="Professional",
			monthly_price="99.90",
			service_fee="500.00",
			max_staff=100,
			max_patients=20000,
		)

		call_command("seed_subscription_plans")

		legacy_plan.refresh_from_db()
		self.assertEqual(legacy_plan.code, "pro")
		self.assertEqual(str(legacy_plan.monthly_price), "89.90")
		self.assertEqual(
			SubscriptionPlan.objects.filter(name="Professional").count(),
			1,
		)


class BackfillLegacySubscriptionsTests(TestCase):
	def setUp(self):
		self.hospital = Hospital.objects.create(
			name="Legacy Hospital",
			slug="legacy-hospital",
			hospital_type="general",
			registration_number="LEGACY-001",
			email="legacy@example.com",
			phone="1234567890",
			address="123 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
			subscription_plan="basic",
		)
		self.basic_plan = SubscriptionPlan.objects.create(
			code="basic",
			name="Basic",
			monthly_price="49.90",
			service_fee="300.00",
			max_staff=20,
			max_patients=2000,
		)

	def test_backfill_creates_basic_subscription_from_paid_basic_payment(self):
		paid_at = timezone.now()
		payment_end = timezone.localdate() + timedelta(days=180)
		SubscriptionPayment.objects.create(
			hospital=self.hospital,
			plan="basic",
			amount="299.40",
			billing_cycle_months=6,
			status="paid",
			payment_date=paid_at,
			subscription_start=timezone.localdate(),
			subscription_end=payment_end,
		)

		call_command("backfill_legacy_subscriptions")

		subscription = HospitalSubscription.objects.get(hospital=self.hospital)
		self.assertEqual(subscription.plan, self.basic_plan)
		self.assertEqual(subscription.status, HospitalSubscription.STATUS_ACTIVE)
		self.assertEqual(subscription.next_billing_date, payment_end)
		self.assertFalse(subscription.service_fee_paid)


class HospitalBillingAuthorizationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Billing Authorization Hospital",
			slug="billing-authorization-hospital",
			hospital_type="general",
			registration_number="BILLING-AUTH-001",
			email="billing-auth@example.com",
			phone="1234567890",
			address="123 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.starter_plan = SubscriptionPlan.objects.create(
			code="billing-auth-starter",
			name="Billing Authorization Starter",
			monthly_price="49.90",
			service_fee="300.00",
			max_staff=20,
			max_patients=2000,
		)
		self.pro_plan = SubscriptionPlan.objects.create(
			code="billing-auth-pro",
			name="Billing Authorization Professional",
			monthly_price="89.90",
			service_fee="500.00",
			max_staff=100,
			max_patients=20000,
		)
		HospitalSubscription.objects.create(
			hospital=self.hospital,
			plan=self.starter_plan,
			status=HospitalSubscription.STATUS_ACTIVE,
			current_monthly_price="49.90",
			current_service_fee="300.00",
		)
		self.admin_user = User.objects.create_user(
			username="billing-admin@example.com",
			email="billing-admin@example.com",
			password="Admin@1234",
		)
		self.nurse_user = User.objects.create_user(
			username="billing-nurse@example.com",
			email="billing-nurse@example.com",
			password="Admin@1234",
		)
		StaffProfile.objects.create(
			user=self.admin_user,
			hospital=self.hospital,
			role="admin",
			phone="700001",
		)
		StaffProfile.objects.create(
			user=self.nurse_user,
			hospital=self.hospital,
			role="nurse",
			phone="700002",
		)

	def test_hospital_admin_can_view_billing_dashboard_and_plan_changes(self):
		self.client.force_authenticate(user=self.admin_user)

		dashboard_response = self.client.get(
			"/api/v1/saas-billing/dashboard/",
		)
		plan_changes_response = self.client.get(
			"/api/v1/saas-billing/plan-changes/",
		)

		self.assertEqual(dashboard_response.status_code, 200)
		self.assertEqual(plan_changes_response.status_code, 200)
		self.assertEqual(
			plan_changes_response.data["current_plan"]["code"],
			self.starter_plan.code,
		)

	def test_non_admin_cannot_view_billing_dashboard_or_plan_changes(self):
		self.client.force_authenticate(user=self.nurse_user)

		dashboard_response = self.client.get(
			"/api/v1/saas-billing/dashboard/",
		)
		plan_changes_response = self.client.get(
			"/api/v1/saas-billing/plan-changes/",
		)

		self.assertEqual(dashboard_response.status_code, 403)
		self.assertEqual(plan_changes_response.status_code, 403)

	def test_scheduled_plan_change_updates_subscription_and_hospital(self):
		subscription = HospitalSubscription.objects.get(
			hospital=self.hospital,
		)
		subscription.pending_plan = self.pro_plan
		subscription.pending_plan_effective_date = timezone.localdate()
		subscription.save(
			update_fields=[
				"pending_plan",
				"pending_plan_effective_date",
			]
		)

		call_command("apply_scheduled_plan_changes")

		subscription.refresh_from_db()
		self.pro_plan.refresh_from_db()
		self.hospital.refresh_from_db()
		self.assertEqual(subscription.plan, self.pro_plan)
		self.assertEqual(
			subscription.current_monthly_price,
			self.pro_plan.monthly_price,
		)
		self.assertIsNone(subscription.pending_plan)
		self.assertEqual(
			self.hospital.subscription_plan,
			self.pro_plan.code,
		)
		self.assertEqual(self.hospital.max_staff, self.pro_plan.max_staff)
		self.assertEqual(
			self.hospital.max_patients,
			self.pro_plan.max_patients,
		)

	def test_billing_dashboard_returns_the_subscription_price_snapshot(self):
		subscription = HospitalSubscription.objects.get(
			hospital=self.hospital,
		)
		subscription.plan = self.pro_plan
		subscription.current_monthly_price = "89.90"
		subscription.current_service_fee = "500.00"
		subscription.save(
			update_fields=[
				"plan",
				"current_monthly_price",
				"current_service_fee",
			]
		)
		self.client.force_authenticate(user=self.admin_user)

		response = self.client.get("/api/v1/saas-billing/dashboard/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			response.data["subscription"]["monthly_price"],
			"89.90",
		)

	def test_billing_dashboard_returns_scheduled_plan_change(self):
		subscription = HospitalSubscription.objects.get(
			hospital=self.hospital,
		)
		effective_date = timezone.localdate() + timedelta(days=30)
		subscription.pending_plan = self.pro_plan
		subscription.pending_plan_effective_date = effective_date
		subscription.pending_plan_requested_at = timezone.now()
		subscription.save(
			update_fields=[
				"pending_plan",
				"pending_plan_effective_date",
				"pending_plan_requested_at",
			]
		)
		self.client.force_authenticate(user=self.admin_user)

		response = self.client.get("/api/v1/saas-billing/dashboard/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			response.data["subscription"]["pending_plan"]["code"],
			self.pro_plan.code,
		)
		self.assertEqual(
			response.data["subscription"]["pending_plan_effective_date"],
			effective_date.isoformat(),
		)

	def test_hospital_admin_plan_change_accepts_sidebar_page_payload(self):
		self.client.force_authenticate(user=self.admin_user)

		response = self.client.post(
			"/api/v1/saas-billing/plan-changes/request/",
			{"plan_code": self.pro_plan.code},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertTrue(response.data["success"])
		self.assertEqual(
			response.data["target_plan"]["code"],
			self.pro_plan.code,
		)

	def test_starter_trial_upgrade_charges_basic_service_fee_once(self):
		self.starter_plan.monthly_price = "0.00"
		self.starter_plan.service_fee = "0.00"
		self.starter_plan.save(
			update_fields=["monthly_price", "service_fee"],
		)
		basic_plan = SubscriptionPlan.objects.create(
			code="billing-auth-basic",
			name="Billing Authorization Basic",
			monthly_price="49.90",
			service_fee="300.00",
			max_staff=20,
			max_patients=2000,
		)
		subscription = HospitalSubscription.objects.get(
			hospital=self.hospital,
		)
		subscription.current_monthly_price = "0.00"
		subscription.current_service_fee = "0.00"
		subscription.status = HospitalSubscription.STATUS_TRIAL
		subscription.save(
			update_fields=[
				"current_monthly_price",
				"current_service_fee",
				"status",
			]
		)

		invoice, created = create_plan_change_invoice(
			subscription=subscription,
			target_plan=basic_plan,
		)

		self.assertTrue(created)
		self.assertEqual(invoice.service_fee_amount, Decimal("300.00"))
		self.assertEqual(invoice.subscription_amount, Decimal("49.90"))
		self.assertEqual(invoice.total_amount, Decimal("349.90"))

	def test_upgrade_omits_service_fee_after_initial_fee_is_paid(self):
		subscription = HospitalSubscription.objects.get(
			hospital=self.hospital,
		)
		subscription.service_fee_paid = True
		subscription.save(update_fields=["service_fee_paid"])

		invoice, created = create_plan_change_invoice(
			subscription=subscription,
			target_plan=self.pro_plan,
		)

		self.assertTrue(created)
		self.assertEqual(invoice.service_fee_amount, Decimal("0.00"))
		self.assertEqual(invoice.subscription_amount, Decimal("40.00"))
		self.assertEqual(invoice.total_amount, Decimal("40.00"))


class SuperAdminBillingCenterTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.super_admin = User.objects.create_superuser(
			username="billing-center@example.com",
			email="billing-center@example.com",
			password="Admin@1234",
		)
		self.regular_user = User.objects.create_user(
			username="billing-viewer@example.com",
			email="billing-viewer@example.com",
			password="Admin@1234",
		)
		self.hospital = Hospital.objects.create(
			name="Billing Center Hospital",
			slug="billing-center-hospital",
			hospital_type="general",
			registration_number="BILLING-CENTER-001",
			email="billing-center-hospital@example.com",
			phone="1234567890",
			address="123 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.basic_plan = SubscriptionPlan.objects.create(
			code="center-basic",
			name="Center Basic",
			monthly_price="49.90",
			service_fee="300.00",
		)
		self.pro_plan = SubscriptionPlan.objects.create(
			code="center-pro",
			name="Center Professional",
			monthly_price="89.90",
			service_fee="500.00",
		)
		self.subscription = HospitalSubscription.objects.create(
			hospital=self.hospital,
			plan=self.basic_plan,
			status=HospitalSubscription.STATUS_ACTIVE,
			current_monthly_price="49.90",
			current_service_fee="300.00",
		)
		StaffProfile.objects.create(
			user=self.regular_user,
			hospital=self.hospital,
			role="admin",
			phone="700003",
		)

	def test_non_super_admin_cannot_access_payment_center(self):
		self.client.force_authenticate(user=self.regular_user)

		response = self.client.get("/api/v1/billing-center/payments/")

		self.assertEqual(response.status_code, 403)

	def test_mark_plan_change_invoice_paid_creates_valid_payment_and_applies_plan(self):
		invoice, _created = create_plan_change_invoice(
			subscription=self.subscription,
			target_plan=self.pro_plan,
		)
		self.client.force_authenticate(user=self.super_admin)

		response = self.client.post(
			f"/api/v1/billing-center/invoices/{invoice.id}/mark-paid/",
			{"reference": "BANK-PLAN-001"},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		invoice.refresh_from_db()
		self.subscription.refresh_from_db()
		payment = Payment.objects.get(invoice=invoice)
		self.assertEqual(invoice.status, Invoice.STATUS_PAID)
		self.assertEqual(payment.payment_type, Payment.TYPE_COMBINED)
		self.assertEqual(payment.gateway, Payment.GATEWAY_MANUAL)
		self.assertEqual(self.subscription.plan, self.pro_plan)
		self.assertTrue(
			AuditLog.objects.filter(
				action="mark_subscription_invoice_paid",
				target=f"invoice:{invoice.id}",
				hospital=self.hospital,
			).exists()
		)

	def test_mark_void_invoice_paid_is_rejected_without_creating_payment(self):
		invoice, _created = create_plan_change_invoice(
			subscription=self.subscription,
			target_plan=self.pro_plan,
		)
		invoice.status = Invoice.STATUS_VOID
		invoice.save(update_fields=["status"])
		self.client.force_authenticate(user=self.super_admin)

		response = self.client.post(
			f"/api/v1/billing-center/invoices/{invoice.id}/mark-paid/",
			{"reference": "BANK-VOID-001"},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertFalse(Payment.objects.filter(invoice=invoice).exists())

	def test_approve_plan_change_payment_marks_invoice_paid_and_applies_plan(self):
		invoice, _created = create_plan_change_invoice(
			subscription=self.subscription,
			target_plan=self.pro_plan,
		)
		payment = Payment.objects.create(
			payment_reference=Payment.generate_reference(),
			invoice=invoice,
			hospital=self.hospital,
			subscription=self.subscription,
			payment_type=Payment.TYPE_COMBINED,
			amount=invoice.balance_due,
			currency=invoice.currency,
			gateway=Payment.GATEWAY_BANK,
			status=Payment.STATUS_PENDING,
		)
		self.client.force_authenticate(user=self.super_admin)

		response = self.client.post(
			f"/api/v1/billing-center/payments/{payment.id}/approve/",
			{},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		invoice.refresh_from_db()
		payment.refresh_from_db()
		self.subscription.refresh_from_db()
		self.assertEqual(payment.status, Payment.STATUS_SUCCESS)
		self.assertEqual(invoice.status, Invoice.STATUS_PAID)
		self.assertEqual(self.subscription.plan, self.pro_plan)
		self.assertTrue(
			AuditLog.objects.filter(
				action="approve_subscription_payment",
				target=f"payment:{payment.id}",
				hospital=self.hospital,
			).exists()
		)

	def test_hospital_admin_submits_payment_then_super_admin_approves_it(self):
		invoice, _created = create_plan_change_invoice(
			subscription=self.subscription,
			target_plan=self.pro_plan,
		)
		self.client.force_authenticate(user=self.regular_user)

		submit_response = self.client.post(
			"/api/v1/saas-billing/payments/manual/",
			{
				"invoice_id": invoice.id,
				"amount": str(invoice.balance_due),
				"transaction_id": "BANK-E2E-001",
				"payment_method": "bank_transfer",
				"notes": "Verified test transfer",
			},
			format="json",
		)

		self.assertEqual(submit_response.status_code, 201)
		payment = Payment.objects.get(
			id=submit_response.data["payment"]["id"],
		)
		self.assertEqual(payment.status, Payment.STATUS_PENDING)
		self.assertEqual(payment.hospital, self.hospital)
		self.assertEqual(payment.invoice, invoice)

		payments_response = self.client.get(
			"/api/v1/saas-billing/payments/",
		)
		self.assertEqual(payments_response.status_code, 200)
		self.assertEqual(payments_response.data["count"], 1)
		self.assertEqual(
			payments_response.data["payments"][0]["id"],
			payment.id,
		)

		self.client.force_authenticate(user=self.super_admin)
		approve_response = self.client.post(
			f"/api/v1/billing-center/payments/{payment.id}/approve/",
			{},
			format="json",
		)

		self.assertEqual(approve_response.status_code, 200)
		payment.refresh_from_db()
		invoice.refresh_from_db()
		self.subscription.refresh_from_db()
		self.assertEqual(payment.status, Payment.STATUS_SUCCESS)
		self.assertIsNotNone(payment.paid_at)
		self.assertEqual(payment.receipt_delivery_status, "sent")
		self.assertEqual(invoice.status, Invoice.STATUS_PAID)
		self.assertEqual(invoice.amount_paid, invoice.total_amount)
		self.assertEqual(self.subscription.plan, self.pro_plan)
		self.assertTrue(
			AuditLog.objects.filter(
				action="approve_subscription_payment",
				target=f"payment:{payment.id}",
				hospital=self.hospital,
			).exists()
		)
