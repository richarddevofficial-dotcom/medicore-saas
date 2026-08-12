from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User
from django.http import HttpResponse
from django.test import RequestFactory, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from auditlog.models import AuditLog
from billing.models import SubscriptionPayment
from hospitals.models import Hospital
from staff.models import StaffProfile

from .models import HospitalSubscription, Invoice, Payment, SubscriptionPlan
from .invoice_services import (
	create_plan_change_invoice as create_legacy_plan_change_invoice,
)
from .middleware import SubscriptionAccessMiddleware
from .plan_change_services import create_plan_change_invoice
from .services import refresh_subscription_status
from .subscription_services import (
	calculate_subscription_end_date,
	get_renewal_period,
)


class SubscriptionCycleCalculationTests(TestCase):
	def test_supported_cycles_add_calendar_months(self):
		start_date = date(2026, 8, 10)

		self.assertEqual(
			calculate_subscription_end_date(start_date, "monthly"),
			date(2026, 9, 10),
		)
		self.assertEqual(
			calculate_subscription_end_date(start_date, "six_months"),
			date(2027, 2, 10),
		)
		self.assertEqual(
			calculate_subscription_end_date(start_date, "annual"),
			date(2027, 8, 10),
		)

	def test_month_end_uses_calendar_arithmetic(self):
		self.assertEqual(
			calculate_subscription_end_date(
				date(2027, 1, 31),
				"monthly",
			),
			date(2027, 2, 28),
		)

	def test_early_renewal_extends_from_current_end_date(self):
		start_date, end_date = get_renewal_period(
			current_end_date=date(2026, 9, 30),
			billing_cycle="six_months",
			today=date(2026, 9, 10),
		)

		self.assertEqual(start_date, date(2026, 9, 30))
		self.assertEqual(end_date, date(2027, 3, 30))

	def test_expired_renewal_starts_from_today(self):
		start_date, end_date = get_renewal_period(
			current_end_date=date(2026, 7, 31),
			billing_cycle="annual",
			today=date(2026, 8, 10),
		)

		self.assertEqual(start_date, date(2026, 8, 10))
		self.assertEqual(end_date, date(2027, 8, 10))


class SubscriptionStatusAndAccessTests(TestCase):
	def setUp(self):
		self.hospital = Hospital.objects.create(
			name="Status Hospital",
			slug="status-hospital",
			hospital_type="general",
			registration_number="STATUS-001",
			email="status@example.com",
			phone="1234567890",
			address="123 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.plan = SubscriptionPlan.objects.create(
			code="status-plan",
			name="Status Plan",
			monthly_price="49.90",
			service_fee="300.00",
		)
		self.subscription = HospitalSubscription.objects.create(
			hospital=self.hospital,
			plan=self.plan,
			status=HospitalSubscription.STATUS_ACTIVE,
			current_monthly_price="49.90",
			current_service_fee="300.00",
		)
		self.user = User.objects.create_user(
			username="status-admin@example.com",
			email="status-admin@example.com",
			password="Admin@1234",
		)
		StaffProfile.objects.create(
			user=self.user,
			hospital=self.hospital,
			role="admin",
			phone="700010",
		)

	def test_statuses_progress_and_command_is_idempotent(self):
		self.subscription.end_date = timezone.localdate() + timedelta(days=10)
		self.subscription.save(update_fields=["end_date"])
		refresh_subscription_status(self.subscription)
		self.assertEqual(
			self.subscription.status,
			HospitalSubscription.STATUS_EXPIRING_SOON,
		)

		self.subscription.end_date = timezone.localdate() - timedelta(days=1)
		self.subscription.save(update_fields=["end_date"])
		refresh_subscription_status(self.subscription)
		self.assertEqual(
			self.subscription.status,
			HospitalSubscription.STATUS_GRACE,
		)

		self.subscription.grace_period_ends_at = timezone.now() - timedelta(days=1)
		self.subscription.save(update_fields=["grace_period_ends_at"])
		call_command("update_subscription_statuses")
		call_command("update_subscription_statuses")
		self.subscription.refresh_from_db()
		self.assertEqual(
			self.subscription.status,
			HospitalSubscription.STATUS_EXPIRED,
		)
		self.assertTrue(Hospital.objects.filter(id=self.hospital.id).exists())

	def test_suspended_subscription_is_not_automatically_reactivated(self):
		self.subscription.status = HospitalSubscription.STATUS_SUSPENDED
		self.subscription.end_date = timezone.localdate() + timedelta(days=90)
		self.subscription.save(update_fields=["status", "end_date"])

		refresh_subscription_status(self.subscription)

		self.assertEqual(
			self.subscription.status,
			HospitalSubscription.STATUS_SUSPENDED,
		)

	def test_expired_access_blocks_operations_but_allows_billing(self):
		self.subscription.status = HospitalSubscription.STATUS_EXPIRED
		self.subscription.end_date = timezone.localdate() - timedelta(days=10)
		self.subscription.save(update_fields=["status", "end_date"])
		middleware = SubscriptionAccessMiddleware(lambda request: HttpResponse("ok"))
		factory = RequestFactory()

		operational_request = factory.get("/api/v1/patients/")
		operational_request.user = self.user
		operational_response = middleware(operational_request)
		billing_request = factory.get("/api/v1/saas-billing/dashboard/")
		billing_request.user = self.user
		billing_response = middleware(billing_request)

		self.assertEqual(operational_response.status_code, 403)
		self.assertJSONEqual(
			operational_response.content,
			{
				"code": "SUBSCRIPTION_EXPIRED",
				"message": "Your MediCoreCloud subscription has expired.",
				"status": "expired",
				"subscription_end_date": self.subscription.end_date.isoformat(),
				"renewal_required": True,
				"billing_only": True,
				"billing_url": "/settings/billing",
			},
		)
		self.assertEqual(billing_response.status_code, 200)

	def test_platform_super_admin_bypasses_subscription_guard(self):
		super_admin = User.objects.create_superuser(
			username="status-super@example.com",
			email="status-super@example.com",
			password="Admin@1234",
		)
		request = RequestFactory().get("/api/v1/patients/")
		request.user = super_admin
		response = SubscriptionAccessMiddleware(
			lambda current_request: HttpResponse("ok")
		)(request)

		self.assertEqual(response.status_code, 200)


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
		starter = SubscriptionPlan.objects.get(code="starter")
		self.assertFalse(
			starter.plan_features.filter(is_enabled=False).exists()
		)

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

	def test_hospital_payment_history_and_proof_are_tenant_isolated(self):
		other_hospital = Hospital.objects.create(
			name="Other Billing Hospital",
			slug="other-billing-hospital",
			hospital_type="general",
			registration_number="BILLING-OTHER-001",
			email="other-billing@example.com",
			phone="1234567891",
			address="456 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		other_subscription = HospitalSubscription.objects.create(
			hospital=other_hospital,
			plan=self.starter_plan,
			status=HospitalSubscription.STATUS_ACTIVE,
			current_monthly_price="49.90",
			current_service_fee="300.00",
		)
		other_invoice = Invoice.objects.create(
			invoice_number=Invoice.generate_invoice_number(),
			hospital=other_hospital,
			subscription=other_subscription,
			invoice_type=Invoice.TYPE_SUBSCRIPTION,
			status=Invoice.STATUS_PENDING,
			subscription_amount=Decimal("49.90"),
			subtotal=Decimal("49.90"),
			total_amount=Decimal("49.90"),
			currency="USD",
			due_date=timezone.localdate() + timedelta(days=7),
		)
		other_payment = Payment.objects.create(
			payment_reference=Payment.generate_reference(),
			invoice=other_invoice,
			hospital=other_hospital,
			subscription=other_subscription,
			plan=self.starter_plan,
			payment_type=Payment.TYPE_SUBSCRIPTION,
			amount=Decimal("49.90"),
			currency="USD",
			gateway=Payment.GATEWAY_BANK,
			status=Payment.STATUS_PENDING,
		)
		self.client.force_authenticate(user=self.admin_user)

		history_response = self.client.get("/api/v1/saas-billing/payments/")
		proof_response = self.client.get(
			f"/api/v1/saas-billing/payments/{other_payment.id}/proof/",
		)

		self.assertEqual(history_response.status_code, 200)
		self.assertEqual(history_response.data["count"], 0)
		self.assertEqual(proof_response.status_code, 404)

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

	def test_six_month_invoice_uses_cycle_price(self):
		self.starter_plan.six_month_price = Decimal("269.40")
		self.starter_plan.save(update_fields=["six_month_price"])
		self.client.force_authenticate(user=self.admin_user)

		response = self.client.post(
			"/api/v1/saas-billing/invoices/generate-initial/",
			{"billing_cycle": "six_months"},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.data["invoice"]["billing_cycle"], "six_months")
		self.assertEqual(response.data["invoice"]["subscription_amount"], "269.40")

	def test_current_plan_reuses_matching_open_subscription_invoice(self):
		subscription = HospitalSubscription.objects.get(hospital=self.hospital)
		subscription.service_fee_paid = True
		subscription.save(update_fields=["service_fee_paid"])
		self.client.force_authenticate(user=self.admin_user)

		first_response = self.client.post(
			"/api/v1/saas-billing/invoices/generate-initial/",
			{"billing_cycle": "monthly"},
			format="json",
		)
		second_response = self.client.post(
			"/api/v1/saas-billing/invoices/generate-initial/",
			{"billing_cycle": "monthly"},
			format="json",
		)

		self.assertEqual(first_response.status_code, 201)
		self.assertEqual(second_response.status_code, 200)
		self.assertEqual(
			first_response.data["invoice"]["id"],
			second_response.data["invoice"]["id"],
		)
		self.assertEqual(
			Invoice.objects.filter(subscription=subscription).count(),
			1,
		)

	def test_conflicting_open_plan_change_invoice_is_rejected(self):
		self.pro_plan.code = "pro"
		self.pro_plan.save(update_fields=["code"])
		enterprise_plan = SubscriptionPlan.objects.create(
			code="enterprise",
			name="Enterprise",
			monthly_price="129.90",
			six_month_price="779.40",
			annual_price="1558.80",
			service_fee="1000.00",
		)
		self.client.force_authenticate(user=self.admin_user)

		first_response = self.client.post(
			"/api/v1/saas-billing/invoices/generate-initial/",
			{"plan_code": "pro", "billing_cycle": "monthly"},
			format="json",
		)
		conflict_response = self.client.post(
			"/api/v1/saas-billing/invoices/generate-initial/",
			{"plan_code": enterprise_plan.code, "billing_cycle": "annual"},
			format="json",
		)

		self.assertEqual(first_response.status_code, 201)
		self.assertEqual(conflict_response.status_code, 409)
		self.assertIn("unpaid invoice", conflict_response.data["error"].lower())
		self.assertEqual(
			Invoice.objects.filter(hospital=self.hospital).count(),
			1,
		)

	def test_admin_selects_professional_annual_plan_and_submits_cash(self):
		self.pro_plan.code = "pro"
		self.pro_plan.annual_price = Decimal("1078.80")
		self.pro_plan.save(update_fields=["code", "annual_price"])
		self.client.force_authenticate(user=self.admin_user)

		invoice_response = self.client.post(
			"/api/v1/saas-billing/invoices/generate-initial/",
			{"plan_code": self.pro_plan.code, "billing_cycle": "annual"},
			format="json",
		)

		self.assertEqual(invoice_response.status_code, 201)
		self.assertEqual(
			invoice_response.data["invoice"]["subscription_amount"],
			"1078.80",
		)
		invoice = Invoice.objects.get(id=invoice_response.data["invoice"]["id"])
		self.assertEqual(invoice.metadata["target_plan_id"], self.pro_plan.id)
		self.assertEqual(invoice.metadata["billing_cycle"], "annual")

		payment_response = self.client.post(
			"/api/v1/saas-billing/payments/manual/",
			{
				"invoice_id": invoice.id,
				"payment_method": "cash",
				"payment_date": timezone.localdate().isoformat(),
			},
			format="json",
		)

		self.assertEqual(payment_response.status_code, 201)
		payment = Payment.objects.get(id=payment_response.data["payment"]["id"])
		self.assertEqual(payment.plan, self.pro_plan)
		self.assertEqual(payment.billing_cycle, HospitalSubscription.CYCLE_ANNUAL)
		self.assertTrue(payment.transaction_id.startswith("CASH-MC-PAY-"))

		super_admin = User.objects.create_superuser(
			username="selected-plan-super@example.com",
			email="selected-plan-super@example.com",
			password="Admin@1234",
		)
		self.client.force_authenticate(user=super_admin)
		approve_response = self.client.post(
			f"/api/v1/billing-center/payments/{payment.id}/approve/",
			{},
			format="json",
		)

		self.assertEqual(approve_response.status_code, 200)
		subscription = HospitalSubscription.objects.get(hospital=self.hospital)
		self.assertEqual(subscription.plan, self.pro_plan)
		self.assertEqual(
			subscription.billing_cycle,
			HospitalSubscription.CYCLE_ANNUAL,
		)
		self.assertEqual(subscription.status, HospitalSubscription.STATUS_ACTIVE)

	def test_cash_payment_submission_is_pending_and_audited(self):
		self.client.force_authenticate(user=self.admin_user)
		invoice_response = self.client.post(
			"/api/v1/saas-billing/invoices/generate-initial/",
			{"billing_cycle": "monthly"},
			format="json",
		)

		response = self.client.post(
			"/api/v1/saas-billing/payments/manual/",
			{
				"invoice_id": invoice_response.data["invoice"]["id"],
				"payment_method": "cash",
				"transaction_id": "CASH-RECEIPT-001",
				"payment_date": timezone.localdate().isoformat(),
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		payment = Payment.objects.get(id=response.data["payment"]["id"])
		self.assertEqual(payment.status, Payment.STATUS_PENDING)
		self.assertEqual(payment.gateway, Payment.GATEWAY_CASH)
		self.assertEqual(payment.submitted_by, self.admin_user)
		self.assertEqual(payment.hospital, self.hospital)
		self.assertTrue(
			AuditLog.objects.filter(
				action__startswith="PAYMENT_SUBMITTED",
				hospital=self.hospital,
			).exists()
		)

	def test_payment_submission_rejects_unsupported_method_and_proof(self):
		self.client.force_authenticate(user=self.admin_user)
		invoice_response = self.client.post(
			"/api/v1/saas-billing/invoices/generate-initial/",
			{"billing_cycle": "monthly"},
			format="json",
		)
		invoice_id = invoice_response.data["invoice"]["id"]

		method_response = self.client.post(
			"/api/v1/saas-billing/payments/manual/",
			{
				"invoice_id": invoice_id,
				"payment_method": "mobile_money",
				"transaction_id": "MOBILE-001",
			},
			format="json",
		)
		proof_response = self.client.post(
			"/api/v1/saas-billing/payments/manual/",
			{
				"invoice_id": invoice_id,
				"payment_method": "bank_transfer",
				"transaction_id": "BANK-PROOF-001",
				"proof_of_payment": SimpleUploadedFile(
					"receipt.txt",
					b"not an allowed payment proof",
					content_type="text/plain",
				),
			},
			format="multipart",
		)

		self.assertEqual(method_response.status_code, 400)
		self.assertEqual(proof_response.status_code, 400)
		self.assertFalse(Payment.objects.filter(invoice_id=invoice_id).exists())

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

	def test_super_admin_can_manually_extend_subscription_with_reason(self):
		current_end_date = timezone.localdate() + timedelta(days=20)
		self.subscription.end_date = current_end_date
		self.subscription.next_billing_date = current_end_date
		self.subscription.save(update_fields=["end_date", "next_billing_date"])
		self.client.force_authenticate(user=self.super_admin)

		missing_reason_response = self.client.post(
			f"/api/v1/billing-center/hospitals/{self.hospital.id}/extend-subscription/",
			{"duration_months": 6, "reason": ""},
			format="json",
		)
		response = self.client.post(
			f"/api/v1/billing-center/hospitals/{self.hospital.id}/extend-subscription/",
			{"duration_months": 6, "reason": "Approved service credit."},
			format="json",
		)

		self.assertEqual(missing_reason_response.status_code, 400)
		self.assertEqual(response.status_code, 200)
		self.subscription.refresh_from_db()
		self.assertEqual(
			self.subscription.end_date,
			calculate_subscription_end_date(current_end_date, "six_months"),
		)
		self.assertTrue(
			AuditLog.objects.filter(
				action="SUBSCRIPTION_MANUALLY_EXTENDED",
				hospital=self.hospital,
			).exists()
		)

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
				action="PAYMENT_CONFIRMED",
				target=f"payment:{payment.id}",
				hospital=self.hospital,
			).exists()
		)

	def test_approval_extends_early_six_month_renewal_from_current_expiry(self):
		current_end_date = timezone.localdate() + timedelta(days=30)
		self.subscription.end_date = current_end_date
		self.subscription.next_billing_date = current_end_date
		self.subscription.save(update_fields=["end_date", "next_billing_date"])
		invoice = Invoice.objects.create(
			invoice_number=Invoice.generate_invoice_number(),
			hospital=self.hospital,
			subscription=self.subscription,
			invoice_type=Invoice.TYPE_SUBSCRIPTION,
			status=Invoice.STATUS_PENDING,
			subscription_amount=Decimal("539.40"),
			subtotal=Decimal("539.40"),
			total_amount=Decimal("539.40"),
			currency="USD",
			due_date=timezone.localdate() + timedelta(days=7),
			metadata={"billing_cycle": "six_months"},
		)
		payment = Payment.objects.create(
			payment_reference=Payment.generate_reference(),
			invoice=invoice,
			hospital=self.hospital,
			subscription=self.subscription,
			plan=self.pro_plan,
			billing_cycle=HospitalSubscription.CYCLE_SIX_MONTHS,
			payment_type=Payment.TYPE_SUBSCRIPTION,
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
		self.subscription.refresh_from_db()
		payment.refresh_from_db()
		self.assertEqual(
			self.subscription.end_date,
			calculate_subscription_end_date(
				current_end_date,
				HospitalSubscription.CYCLE_SIX_MONTHS,
			),
		)
		self.assertEqual(
			self.subscription.billing_cycle,
			HospitalSubscription.CYCLE_SIX_MONTHS,
		)
		self.assertEqual(payment.confirmed_by, self.super_admin)
		self.assertIsNotNone(payment.confirmed_at)

		duplicate_response = self.client.post(
			f"/api/v1/billing-center/payments/{payment.id}/approve/",
			{},
			format="json",
		)
		self.assertEqual(duplicate_response.status_code, 409)

	def test_approval_uses_invoice_cycle_for_legacy_payment_without_cycle(self):
		invoice = Invoice.objects.create(
			invoice_number=Invoice.generate_invoice_number(),
			hospital=self.hospital,
			subscription=self.subscription,
			invoice_type=Invoice.TYPE_SUBSCRIPTION,
			status=Invoice.STATUS_PENDING,
			subscription_amount=Decimal("539.40"),
			subtotal=Decimal("539.40"),
			total_amount=Decimal("539.40"),
			currency="USD",
			due_date=timezone.localdate() + timedelta(days=7),
			metadata={"billing_cycle": "six_months"},
		)
		payment = Payment.objects.create(
			payment_reference=Payment.generate_reference(),
			invoice=invoice,
			hospital=self.hospital,
			subscription=self.subscription,
			plan=self.pro_plan,
			billing_cycle="",
			payment_type=Payment.TYPE_SUBSCRIPTION,
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
		self.subscription.refresh_from_db()
		self.assertEqual(
			self.subscription.billing_cycle,
			HospitalSubscription.CYCLE_SIX_MONTHS,
		)

	def test_approval_of_expired_annual_subscription_starts_today(self):
		self.subscription.status = HospitalSubscription.STATUS_EXPIRED
		self.subscription.end_date = timezone.localdate() - timedelta(days=10)
		self.subscription.save(update_fields=["status", "end_date"])
		invoice = Invoice.objects.create(
			invoice_number=Invoice.generate_invoice_number(),
			hospital=self.hospital,
			subscription=self.subscription,
			invoice_type=Invoice.TYPE_SUBSCRIPTION,
			status=Invoice.STATUS_PENDING,
			subscription_amount=Decimal("1078.80"),
			subtotal=Decimal("1078.80"),
			total_amount=Decimal("1078.80"),
			currency="USD",
			due_date=timezone.localdate() + timedelta(days=7),
			metadata={"billing_cycle": "annual"},
		)
		payment = Payment.objects.create(
			payment_reference=Payment.generate_reference(),
			invoice=invoice,
			hospital=self.hospital,
			subscription=self.subscription,
			plan=self.pro_plan,
			billing_cycle=HospitalSubscription.CYCLE_ANNUAL,
			payment_type=Payment.TYPE_SUBSCRIPTION,
			amount=invoice.balance_due,
			currency=invoice.currency,
			gateway=Payment.GATEWAY_CASH,
			status=Payment.STATUS_PENDING,
		)
		self.client.force_authenticate(user=self.super_admin)

		response = self.client.post(
			f"/api/v1/billing-center/payments/{payment.id}/approve/",
			{},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.subscription.refresh_from_db()
		self.assertEqual(self.subscription.start_date, timezone.localdate())
		self.assertEqual(
			self.subscription.end_date,
			calculate_subscription_end_date(
				timezone.localdate(),
				HospitalSubscription.CYCLE_ANNUAL,
			),
		)

	@patch(
		"saas_billing.billing_center_views.send_payment_receipt_email",
		side_effect=RuntimeError("Receipt provider unavailable"),
	)
	def test_receipt_failure_does_not_roll_back_approval(self, _send_receipt):
		invoice = Invoice.objects.create(
			invoice_number=Invoice.generate_invoice_number(),
			hospital=self.hospital,
			subscription=self.subscription,
			invoice_type=Invoice.TYPE_SUBSCRIPTION,
			status=Invoice.STATUS_PENDING,
			subscription_amount=Decimal("89.90"),
			subtotal=Decimal("89.90"),
			total_amount=Decimal("89.90"),
			currency="USD",
			due_date=timezone.localdate() + timedelta(days=7),
		)
		payment = Payment.objects.create(
			payment_reference=Payment.generate_reference(),
			invoice=invoice,
			hospital=self.hospital,
			subscription=self.subscription,
			plan=self.subscription.plan,
			billing_cycle=HospitalSubscription.CYCLE_MONTHLY,
			payment_type=Payment.TYPE_SUBSCRIPTION,
			amount=invoice.total_amount,
			currency=invoice.currency,
			gateway=Payment.GATEWAY_BANK,
			status=Payment.STATUS_PENDING,
		)
		self.client.force_authenticate(user=self.super_admin)

		with self.captureOnCommitCallbacks(execute=True):
			response = self.client.post(
				f"/api/v1/billing-center/payments/{payment.id}/approve/",
				{},
				format="json",
			)

		self.assertEqual(response.status_code, 200)
		payment.refresh_from_db()
		invoice.refresh_from_db()
		self.subscription.refresh_from_db()
		self.assertEqual(payment.status, Payment.STATUS_SUCCESS)
		self.assertEqual(invoice.status, Invoice.STATUS_PAID)
		self.assertEqual(
			self.subscription.status,
			HospitalSubscription.STATUS_ACTIVE,
		)

	def test_rejected_payment_records_reason_without_renewing_subscription(self):
		original_end_date = timezone.localdate() + timedelta(days=10)
		self.subscription.end_date = original_end_date
		self.subscription.save(update_fields=["end_date"])
		invoice = Invoice.objects.create(
			invoice_number=Invoice.generate_invoice_number(),
			hospital=self.hospital,
			subscription=self.subscription,
			invoice_type=Invoice.TYPE_SUBSCRIPTION,
			status=Invoice.STATUS_PENDING,
			subscription_amount=Decimal("49.90"),
			subtotal=Decimal("49.90"),
			total_amount=Decimal("49.90"),
			currency="USD",
			due_date=timezone.localdate() + timedelta(days=7),
		)
		payment = Payment.objects.create(
			payment_reference=Payment.generate_reference(),
			invoice=invoice,
			hospital=self.hospital,
			subscription=self.subscription,
			plan=self.basic_plan,
			payment_type=Payment.TYPE_SUBSCRIPTION,
			amount=invoice.balance_due,
			currency=invoice.currency,
			gateway=Payment.GATEWAY_BANK,
			status=Payment.STATUS_PENDING,
		)
		self.client.force_authenticate(user=self.super_admin)

		missing_reason_response = self.client.post(
			f"/api/v1/billing-center/payments/{payment.id}/reject/",
			{"reason": ""},
			format="json",
		)
		oversized_reason_response = self.client.post(
			f"/api/v1/billing-center/payments/{payment.id}/reject/",
			{"reason": "x" * 501},
			format="json",
		)
		response = self.client.post(
			f"/api/v1/billing-center/payments/{payment.id}/reject/",
			{"reason": "Reference could not be verified."},
			format="json",
		)

		self.assertEqual(missing_reason_response.status_code, 400)
		self.assertEqual(oversized_reason_response.status_code, 400)
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["payment"]["status_label"], "Rejected")
		payment.refresh_from_db()
		self.subscription.refresh_from_db()
		self.assertEqual(payment.status, Payment.STATUS_FAILED)
		self.assertEqual(
			payment.rejection_reason,
			"Reference could not be verified.",
		)
		self.assertEqual(payment.rejected_by, self.super_admin)
		self.assertIsNotNone(payment.rejected_at)
		self.assertEqual(self.subscription.end_date, original_end_date)
		self.assertTrue(
			AuditLog.objects.filter(
				action="PAYMENT_REJECTED",
				target=f"payment:{payment.id}",
				hospital=self.hospital,
			).exists()
		)
		duplicate_response = self.client.post(
			f"/api/v1/billing-center/payments/{payment.id}/reject/",
			{"reason": "Second decision"},
			format="json",
		)
		self.assertEqual(duplicate_response.status_code, 400)

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
		with self.captureOnCommitCallbacks(execute=True):
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
				action="PAYMENT_CONFIRMED",
				target=f"payment:{payment.id}",
				hospital=self.hospital,
			).exists()
		)


class ApproveManualPaymentPlanChangeTests(TestCase):
	"""Regression tests for the saas-billing approve_manual_payment endpoint."""

	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Approval Plan Change Hospital",
			slug="approval-plan-change-hospital",
			hospital_type="general",
			registration_number="APPROVAL-PLAN-001",
			email="approval-hospital@example.com",
			phone="1234567890",
			address="123 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.starter_plan = SubscriptionPlan.objects.create(
			code="approval-starter",
			name="Approval Starter",
			monthly_price="49.90",
			service_fee="300.00",
			max_staff=20,
			max_patients=2000,
		)
		self.pro_plan = SubscriptionPlan.objects.create(
			code="approval-pro",
			name="Approval Professional",
			monthly_price="89.90",
			service_fee="500.00",
			max_staff=100,
			max_patients=20000,
		)
		self.basic_plan = SubscriptionPlan.objects.create(
			code="approval-basic",
			name="Approval Basic",
			monthly_price="29.90",
			service_fee="100.00",
			max_staff=10,
			max_patients=1000,
		)
		self.subscription = HospitalSubscription.objects.create(
			hospital=self.hospital,
			plan=self.starter_plan,
			status=HospitalSubscription.STATUS_ACTIVE,
			current_monthly_price="49.90",
			current_service_fee="300.00",
			service_fee_paid=True,
			next_billing_date=timezone.localdate() + timedelta(days=20),
		)
		self.admin_user = User.objects.create_user(
			username="approval-admin@example.com",
			email="approval-admin@example.com",
			password="Admin@1234",
		)
		StaffProfile.objects.create(
			user=self.admin_user,
			hospital=self.hospital,
			role="admin",
			phone="700010",
		)
		self.super_admin = User.objects.create_superuser(
			username="approval-super@example.com",
			email="approval-super@example.com",
			password="Admin@1234",
		)

	def _submit_and_approve(self, invoice):
		self.client.force_authenticate(user=self.admin_user)
		submit_response = self.client.post(
			"/api/v1/saas-billing/payments/manual/",
			{
				"invoice_id": invoice.id,
				"transaction_id": f"BANK-REG-{invoice.id}",
				"payment_method": "bank_transfer",
				"payment_date": timezone.localdate().isoformat(),
			},
			format="json",
		)
		self.assertEqual(submit_response.status_code, 201)
		payment = Payment.objects.get(
			id=submit_response.data["payment"]["id"],
		)

		self.client.force_authenticate(user=self.super_admin)
		approve_response = self.client.post(
			f"/api/v1/saas-billing/payments/{payment.id}/approve/",
			{},
			format="json",
		)
		return payment, approve_response

	def test_legacy_pending_plan_change_invoice_backfills_target_plan_id(self):
		"""Invoices created before target_plan_id existed must still activate."""
		invoice, _created = create_legacy_plan_change_invoice(
			subscription=self.subscription,
			target_plan=self.pro_plan,
		)
		# Simulate a legacy invoice written before the fix.
		invoice.metadata.pop("target_plan_id", None)
		invoice.save(update_fields=["metadata"])

		_payment, response = self._submit_and_approve(invoice)

		self.assertEqual(response.status_code, 200)
		self.subscription.refresh_from_db()
		invoice.refresh_from_db()
		self.assertEqual(invoice.metadata.get("target_plan_id"), self.pro_plan.id)
		self.assertEqual(self.subscription.plan, self.pro_plan)
		self.assertEqual(
			self.subscription.current_monthly_price,
			Decimal(self.pro_plan.monthly_price),
		)

	def test_upgrade_activates_immediately_on_approval(self):
		invoice, _created = create_legacy_plan_change_invoice(
			subscription=self.subscription,
			target_plan=self.pro_plan,
		)

		_payment, response = self._submit_and_approve(invoice)

		self.assertEqual(response.status_code, 200)
		self.subscription.refresh_from_db()
		self.assertEqual(self.subscription.plan, self.pro_plan)
		self.assertIsNone(self.subscription.pending_plan)
		self.assertIsNone(self.subscription.pending_plan_effective_date)
		self.assertEqual(
			response.data["subscription"]["plan"],
			self.pro_plan.name,
		)

	def test_downgrade_is_scheduled_until_end_of_subscription(self):
		self.subscription.plan = self.pro_plan
		self.subscription.current_monthly_price = self.pro_plan.monthly_price
		self.subscription.save(
			update_fields=["plan", "current_monthly_price"],
		)
		current_period_end = self.subscription.next_billing_date

		invoice, _created = create_legacy_plan_change_invoice(
			subscription=self.subscription,
			target_plan=self.basic_plan,
		)

		_payment, response = self._submit_and_approve(invoice)

		self.assertEqual(response.status_code, 200)
		self.subscription.refresh_from_db()
		# Current plan stays active until the period ends.
		self.assertEqual(self.subscription.plan, self.pro_plan)
		self.assertEqual(self.subscription.pending_plan, self.basic_plan)
		self.assertEqual(
			self.subscription.pending_plan_effective_date,
			current_period_end,
		)
		self.assertEqual(
			response.data["subscription"]["pending_plan"]["code"],
			self.basic_plan.code,
		)
		self.assertIn(
			"takes effect",
			response.data["message"],
		)

	@patch(
		"saas_billing.receipt_services.EmailMessage.send",
		return_value=1,
	)
	def test_receipt_email_goes_to_hospital_and_submitting_admin(
		self,
		mock_send,
	):
		invoice, _created = create_legacy_plan_change_invoice(
			subscription=self.subscription,
			target_plan=self.pro_plan,
		)

		payment, response = self._submit_and_approve(invoice)

		self.assertEqual(response.status_code, 200)
		self.assertTrue(mock_send.called)
		email_message = mock_send.call_args.args[0] if mock_send.call_args.args else None
		payment.refresh_from_db()
		self.assertEqual(payment.receipt_delivery_status, "sent")
