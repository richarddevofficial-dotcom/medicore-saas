from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from django.core.management import call_command
from unittest.mock import patch
from django.http import JsonResponse
from django.test import RequestFactory, override_settings

from billing.models import SubscriptionPayment
from hospitals.models import Hospital
from staff.models import StaffProfile
from auditlog.models import AuditLog
from config.middleware import TenantDomainMiddleware, DynamicTenantCorsGuardMiddleware


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
		self.assertEqual(response.data["platform_subdomain"], "hospital-one.medicore.com")

	def test_domain_setup_generates_verification_token(self):
		self.client.force_authenticate(user=self.user)

		response = self.client.post(
			"/api/v1/hospitals/domain_setup/",
			{"custom_domain": "new.one.example.com"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.hospital_one.refresh_from_db()
		self.assertEqual(self.hospital_one.custom_domain, "new.one.example.com")
		self.assertEqual(self.hospital_one.domain_status, "pending")
		self.assertTrue(bool(self.hospital_one.domain_verification_token))
		self.assertEqual(response.data["domain_status"], "pending")
		self.assertEqual(response.data["verification"]["type"], "dns-txt")
		self.assertTrue(
			AuditLog.objects.filter(
				hospital=self.hospital_one,
				target="custom_domain",
				action__icontains="Domain setup requested",
			).exists()
		)

	def test_domain_verify_fails_when_dns_not_resolved(self):
		from unittest.mock import patch

		self.client.force_authenticate(user=self.user)
		self.hospital_one.custom_domain = "verify.one.example.com"
		self.hospital_one.domain_status = "pending"
		self.hospital_one.save(update_fields=["custom_domain", "domain_status"])

		with patch("hospitals.views.resolve_domain_to_ip", return_value=""):
			response = self.client.post(
				"/api/v1/hospitals/domain_verify/",
				{"custom_domain": "verify.one.example.com"},
				format="json",
			)

		self.assertEqual(response.status_code, 400)
		self.hospital_one.refresh_from_db()
		self.assertEqual(self.hospital_one.domain_status, "failed")

	def test_domain_verify_marks_verified_on_dns_resolution(self):
		from unittest.mock import patch

		self.client.force_authenticate(user=self.user)
		self.hospital_one.custom_domain = "verify.ok.example.com"
		self.hospital_one.domain_status = "pending"
		self.hospital_one.save(update_fields=["custom_domain", "domain_status"])

		with patch("hospitals.views.resolve_domain_to_ip", return_value="1.2.3.4"):
			response = self.client.post(
				"/api/v1/hospitals/domain_verify/",
				{"custom_domain": "verify.ok.example.com"},
				format="json",
			)

		self.assertEqual(response.status_code, 200)
		self.hospital_one.refresh_from_db()
		self.assertEqual(self.hospital_one.domain_status, "verified")
		self.assertIsNotNone(self.hospital_one.domain_verified_at)
		self.assertTrue(
			AuditLog.objects.filter(
				hospital=self.hospital_one,
				target="custom_domain",
				action__icontains="Domain verified",
			).exists()
		)

	def test_hospital_settings_domain_change_resets_verification_state(self):
		self.client.force_authenticate(user=self.user)
		self.hospital_one.domain_status = "verified"
		self.hospital_one.domain_verification_token = "oldtoken"
		self.hospital_one.save(
			update_fields=["domain_status", "domain_verification_token"]
		)

		response = self.client.put(
			"/api/v1/hospitals/settings/",
			{"custom_domain": "changed.one.example.com"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.hospital_one.refresh_from_db()
		self.assertEqual(self.hospital_one.custom_domain, "changed.one.example.com")
		self.assertEqual(self.hospital_one.domain_status, "pending")
		self.assertNotEqual(self.hospital_one.domain_verification_token, "oldtoken")
		self.assertTrue(
			AuditLog.objects.filter(
				hospital=self.hospital_one,
				target="custom_domain",
				action__icontains="Domain changed from",
			).exists()
		)

	def test_refresh_domain_health_marks_failed_when_dns_missing(self):
		self.hospital_one.custom_domain = "missing.example.com"
		self.hospital_one.domain_status = "pending"
		self.hospital_one.save(update_fields=["custom_domain", "domain_status"])

		with patch(
			"hospitals.management.commands.refresh_domain_health.resolve_domain_to_ip",
			return_value="",
		):
			call_command("refresh_domain_health", limit=10)

		self.hospital_one.refresh_from_db()
		self.assertEqual(self.hospital_one.domain_status, "failed")
		self.assertEqual(self.hospital_one.domain_ssl_status, "failed")
		self.assertEqual(self.hospital_one.domain_last_resolved_ip, "")

	def test_refresh_domain_health_marks_ssl_valid(self):
		from django.utils import timezone

		self.hospital_one.custom_domain = "ok.example.com"
		self.hospital_one.domain_status = "pending"
		self.hospital_one.save(update_fields=["custom_domain", "domain_status"])

		with patch(
			"hospitals.management.commands.refresh_domain_health.resolve_domain_to_ip",
			return_value="1.2.3.4",
		), patch(
			"hospitals.management.commands.refresh_domain_health._fetch_ssl_expiry",
			return_value=timezone.now(),
		):
			call_command("refresh_domain_health", limit=10)

		self.hospital_one.refresh_from_db()
		self.assertEqual(self.hospital_one.domain_status, "verified")
		self.assertEqual(self.hospital_one.domain_ssl_status, "valid")
		self.assertEqual(self.hospital_one.domain_last_resolved_ip, "1.2.3.4")

	def test_toggle_hospital_status_deactivates_hospital_staff_users(self):
		superadmin = User.objects.create_superuser(
			username="drichigroup@gmail.com",
			email="drichigroup@gmail.com",
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
			username="drichigroup@gmail.com",
			email="drichigroup@gmail.com",
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

	def test_super_admin_stats_includes_payment_analytics(self):
		superadmin = User.objects.create_superuser(
			username="drichigroup@gmail.com",
			email="drichigroup@gmail.com",
			password="Admin@1234",
		)
		SubscriptionPayment.objects.create(
			hospital=self.hospital_one,
			plan="pro",
			amount="149.90",
			payment_method="bank",
			transaction_id="TX-ANALYTICS-PAID",
			status="paid",
		)
		SubscriptionPayment.objects.create(
			hospital=self.hospital_two,
			plan="basic",
			amount="99.90",
			payment_method="bank",
			transaction_id="TX-ANALYTICS-PENDING",
			status="pending",
		)

		self.client.force_authenticate(user=superadmin)
		response = self.client.get("/api/v1/super-admin/stats/")

		self.assertEqual(response.status_code, 200)
		self.assertIn("subscription_collections_total", response.data)
		self.assertIn("subscription_collections_this_month", response.data)
		self.assertIn("pending_subscription_amount", response.data)
		self.assertIn("plan_distribution", response.data)
		self.assertIn("payment_status_counts", response.data)
		self.assertIn("monthly_subscription_collections", response.data)
		self.assertIn("recent_subscription_payments", response.data)
		self.assertEqual(response.data["payment_status_counts"]["paid"], 1)
		self.assertEqual(response.data["payment_status_counts"]["pending"], 1)


class TenantDomainMiddlewareTests(TestCase):
	def setUp(self):
		self.factory = RequestFactory()
		self.hospital = Hospital.objects.create(
			name="Tenant Hospital",
			slug="tenant-hospital",
			hospital_type="general",
			registration_number="REG-TENANT",
			email="tenant@example.com",
			phone="100200300",
			address="Addr",
			city="Juba",
			state="Central",
			country="South Sudan",
			custom_domain="tenant.example.com",
			domain_status="verified",
		)

	@override_settings(DEBUG=False)
	@patch("config.middleware.os.getenv")
	def test_tenant_middleware_blocks_unknown_host_when_enforced(self, getenv_mock):
		def env_value(key, default=""):
			if key == "ENABLE_TENANT_HOST_ENFORCEMENT":
				return "true"
			if key == "PLATFORM_HOSTS":
				return "localhost,127.0.0.1,medicore.com"
			return default

		getenv_mock.side_effect = env_value

		middleware = TenantDomainMiddleware(lambda request: JsonResponse({"ok": True}))
		request = self.factory.get("/api/v1/hospitals/my_hospital/", HTTP_HOST="unknown.example.com")

		response = middleware(request)
		self.assertEqual(response.status_code, 400)

	@patch("config.middleware.os.getenv")
	def test_tenant_middleware_attaches_verified_tenant(self, getenv_mock):
		def env_value(key, default=""):
			if key == "ENABLE_TENANT_HOST_ENFORCEMENT":
				return "true"
			if key == "PLATFORM_HOSTS":
				return "localhost,127.0.0.1,medicore.com"
			return default

		getenv_mock.side_effect = env_value

		middleware = TenantDomainMiddleware(lambda request: JsonResponse({"ok": True}))
		request = self.factory.get("/", HTTP_HOST="tenant.example.com")

		response = middleware(request)
		self.assertEqual(response.status_code, 200)
		self.assertEqual(getattr(request, "tenant_hospital", None), self.hospital)

	@patch("config.middleware.os.getenv")
	def test_dynamic_cors_guard_blocks_unverified_origin(self, getenv_mock):
		def env_value(key, default=""):
			if key == "ENABLE_DYNAMIC_CORS_GUARD":
				return "true"
			if key == "PLATFORM_HOSTS":
				return "localhost,127.0.0.1,medicore.com"
			return default

		getenv_mock.side_effect = env_value

		middleware = DynamicTenantCorsGuardMiddleware(
			lambda request: JsonResponse({"ok": True})
		)
		request = self.factory.get(
			"/api/v1/hospitals/my_hospital/",
			HTTP_ORIGIN="https://evil.example.com",
		)

		response = middleware(request)
		self.assertEqual(response.status_code, 403)

	@override_settings(PLATFORM_SUBDOMAIN_MODE=True, PLATFORM_BASE_DOMAIN="medicore.com")
	@patch("config.middleware.os.getenv")
	def test_tenant_middleware_accepts_managed_subdomain(self, getenv_mock):
		def env_value(key, default=""):
			if key == "ENABLE_TENANT_HOST_ENFORCEMENT":
				return "true"
			if key == "PLATFORM_HOSTS":
				return "localhost,127.0.0.1,medicore.com"
			return default

		getenv_mock.side_effect = env_value

		middleware = TenantDomainMiddleware(lambda request: JsonResponse({"ok": True}))
		request = self.factory.get("/", HTTP_HOST="tenant-hospital.medicore.com")

		response = middleware(request)
		self.assertEqual(response.status_code, 200)
		self.assertEqual(getattr(request, "tenant_hospital", None), self.hospital)
