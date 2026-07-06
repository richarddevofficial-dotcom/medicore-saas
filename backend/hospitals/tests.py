from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile


class HospitalSettingsAndBrandingTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital_one = Hospital.objects.create(
			name="Hospital One",
			slug="hospital-one",
			hospital_type="general",
			registration_number="REG-H1",
			email="hospital1@example.com",
			phone="1234567890",
			address="Addr 1",
			city="Juba",
			state="Central",
			country="South Sudan",
			primary_color="#111111",
			secondary_color="#222222",
			custom_domain="one.example.com",
		)
		self.hospital_two = Hospital.objects.create(
			name="Hospital Two",
			slug="hospital-two",
			hospital_type="general",
			registration_number="REG-H2",
			email="hospital2@example.com",
			phone="0987654321",
			address="Addr 2",
			city="Juba",
			state="Central",
			country="South Sudan",
			primary_color="#333333",
			secondary_color="#444444",
			custom_domain="two.example.com",
		)

		self.user = User.objects.create_user(
			username="admin1@example.com",
			email="admin1@example.com",
			password="Admin@1234",
		)
		self.staff_profile = StaffProfile.objects.create(
			user=self.user,
			hospital=self.hospital_one,
			role="admin",
			phone="555111222",
		)

	def test_hospital_settings_requires_authentication(self):
		response = self.client.put(
			"/api/v1/hospitals/settings/",
			{"custom_domain": "blocked.example.com"},
			format="json",
		)

		self.assertEqual(response.status_code, 401)

	def test_hospital_settings_updates_only_authenticated_users_hospital(self):
		self.client.force_authenticate(user=self.user)

		response = self.client.put(
			"/api/v1/hospitals/settings/",
			{
				"custom_domain": "hospital-one-updated.example.com",
				"primary_color": "#225588",
				"secondary_color": "#334455",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 200)

		self.hospital_one.refresh_from_db()
		self.hospital_two.refresh_from_db()
		self.assertEqual(
			self.hospital_one.custom_domain,
			"hospital-one-updated.example.com",
		)
		self.assertEqual(self.hospital_one.primary_color, "#225588")
		self.assertEqual(self.hospital_one.secondary_color, "#334455")
		self.assertEqual(self.hospital_two.custom_domain, "two.example.com")

	def test_my_hospital_returns_branding_fields(self):
		self.client.force_authenticate(user=self.user)

		response = self.client.get("/api/v1/hospitals/my_hospital/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["name"], "Hospital One")
		self.assertEqual(response.data["primary_color"], "#111111")
		self.assertEqual(response.data["secondary_color"], "#222222")
		self.assertEqual(response.data["custom_domain"], "one.example.com")

	def test_toggle_hospital_status_deactivates_hospital_staff_users(self):
		superadmin = User.objects.create_superuser(
			username="super-toggle@example.com",
			email="super-toggle@example.com",
			password="Admin@1234",
		)

		self.client.force_authenticate(user=superadmin)
		response = self.client.post(
			"/api/v1/super-admin/toggle-hospital/",
			{"hospital_id": self.hospital_one.id},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.hospital_one.refresh_from_db()
		self.user.refresh_from_db()
		self.assertFalse(self.hospital_one.is_active)
		self.assertEqual(self.hospital_one.subscription_status, "inactive")
		self.assertFalse(self.user.is_active)

	def test_toggle_hospital_status_reactivates_hospital_staff_users(self):
		superadmin = User.objects.create_superuser(
			username="super-toggle-2@example.com",
			email="super-toggle-2@example.com",
			password="Admin@1234",
		)

		self.hospital_one.is_active = False
		self.hospital_one.subscription_status = "inactive"
		self.hospital_one.save(update_fields=["is_active", "subscription_status"])
		self.user.is_active = False
		self.user.save(update_fields=["is_active"])

		self.client.force_authenticate(user=superadmin)
		response = self.client.post(
			"/api/v1/super-admin/toggle-hospital/",
			{"hospital_id": self.hospital_one.id},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.hospital_one.refresh_from_db()
		self.user.refresh_from_db()
		self.assertTrue(self.hospital_one.is_active)
		self.assertEqual(self.hospital_one.subscription_status, "active")
		self.assertTrue(self.user.is_active)
