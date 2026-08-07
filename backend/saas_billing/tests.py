from datetime import timedelta

from django.core.management import call_command
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from billing.models import SubscriptionPayment
from hospitals.models import Hospital
from staff.models import StaffProfile

from .models import HospitalSubscription, SubscriptionPlan


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
		self.starter_plan = SubscriptionPlan.objects.create(
			code="starter",
			name="Starter",
			monthly_price="49.90",
			service_fee="300.00",
			max_staff=20,
			max_patients=2000,
		)

	def test_backfill_creates_starter_subscription_from_paid_basic_payment(self):
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
		self.assertEqual(subscription.plan, self.starter_plan)
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
