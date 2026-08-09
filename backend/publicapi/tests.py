from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from hospitals.models import Hospital
from saas_billing.models import SubscriptionPlan


class HospitalRegistrationTimezoneTests(TestCase):
	def setUp(self):
		cache.clear()
		self.client = APIClient()
		SubscriptionPlan.objects.create(
			code="starter",
			name="Starter",
			monthly_price="49.00",
			service_fee="100.00",
			max_staff=10,
			max_patients=100,
		)

	def test_kenyan_hospital_uses_nairobi_timezone(self):
		response = self.client.post(
			"/api/v1/public/register-hospital/",
			{
				"hospital_name": "Nairobi Test Hospital",
				"hospital_email": "hospital@example.com",
				"hospital_phone": "+254700000001",
				"country": "Kenya",
				"admin_first_name": "Test",
				"admin_last_name": "Admin",
				"admin_email": "admin@example.com",
				"password": "secure-password",
			},
			format="json",
			REMOTE_ADDR="203.0.113.20",
		)

		self.assertEqual(response.status_code, 201)
		hospital = Hospital.objects.get(email="hospital@example.com")
		self.assertEqual(hospital.timezone, "Africa/Nairobi")


class HospitalRegistrationThrottleTests(TestCase):
	def setUp(self):
		cache.clear()
		self.client = APIClient()

	def test_registration_is_throttled_per_ip_before_creating_resources(self):
		for _ in range(3):
			response = self.client.post(
				"/api/v1/public/register-hospital/",
				{},
				format="json",
				REMOTE_ADDR="203.0.113.10",
			)
			self.assertEqual(response.status_code, 400)

		throttled_response = self.client.post(
			"/api/v1/public/register-hospital/",
			{},
			format="json",
			REMOTE_ADDR="203.0.113.10",
		)

		self.assertEqual(throttled_response.status_code, 429)
