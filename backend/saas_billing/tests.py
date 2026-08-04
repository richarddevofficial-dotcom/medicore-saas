from datetime import timedelta

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from billing.models import SubscriptionPayment
from hospitals.models import Hospital

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
