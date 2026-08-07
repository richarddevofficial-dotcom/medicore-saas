from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient


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
