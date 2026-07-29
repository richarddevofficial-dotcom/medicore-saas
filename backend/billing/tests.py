from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
import hashlib
from calendar import monthrange
from unittest.mock import patch
from rest_framework.test import APIClient

from billing.models import Bill
from billing.models import ReceiptEmailJob, SubscriptionPayment
from auditlog.models import AuditLog, NotificationEvent
from hospitals.models import Hospital, LoginOTP, TrustedDevice
from staff.models import StaffProfile


class AuthAndBillingSmokeTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.hospital = Hospital.objects.create(
            name="Test Hospital",
            slug="test-hospital",
            hospital_type="general",
            registration_number="REG-001",
            email="hospital@example.com",
            phone="1234567890",
            address="123 Main Street",
            city="Juba",
            state="Central",
            country="South Sudan",
        )
        self.user = User.objects.create_user(
            username="richard@gmail.com",
            email="richard@gmail.com",
            password="Admin@1234",
            first_name="Richard",
            last_name="Admin",
        )
        self.staff_profile = StaffProfile.objects.create(
            user=self.user,
            hospital=self.hospital,
            role="admin",
            phone="1234567890",
        )
        Bill.objects.create(
            hospital=self.hospital,
            bill_number="BILL-001",
            patient_name="Alice Sample",
            consultation_fee=20,
            total_amount=20,
            amount_paid=20,
            balance=0,
            status="paid",
        )

    def _add_months(self, start_date, months):
        target_month_index = (start_date.month - 1) + months
        year = start_date.year + (target_month_index // 12)
        month = (target_month_index % 12) + 1
        day = min(start_date.day, monthrange(year, month)[1])
        return start_date.replace(year=year, month=month, day=day)

    def test_login_returns_token_and_user_payload(self):
        response = self.client.post(
            reverse("login"),
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], "richard@gmail.com")

    @patch("config.urls.send_password_setup_email")
    def test_password_setup_request_returns_success_and_triggers_email(self, mock_send_setup):
        mock_send_setup.return_value = True

        response = self.client.post(
            "/api/v1/auth/password/setup-request/",
            {"email": "richard@gmail.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("success"))
        self.assertTrue(mock_send_setup.called)
        self.assertTrue(
            AuditLog.objects.filter(
                user="richard@gmail.com",
                action="Password setup requested",
                target="password_setup",
                action_type="security",
            ).exists()
        )

    @patch("config.urls.send_password_setup_email")
    def test_password_setup_request_for_unknown_email_creates_no_audit_log(self, mock_send_setup):
        response = self.client.post(
            "/api/v1/auth/password/setup-request/",
            {"email": "unknown@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("success"))
        self.assertFalse(mock_send_setup.called)
        self.assertFalse(
            AuditLog.objects.filter(
                action="Password setup requested",
                target="password_setup",
                action_type="security",
            ).exists()
        )

    def test_password_setup_confirm_sets_password(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        response = self.client.post(
            "/api/v1/auth/password/setup-confirm/",
            {
                "uid": uid,
                "token": token,
                "new_password": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewStrongPass123!"))
        self.assertTrue(
            AuditLog.objects.filter(
                user="richard@gmail.com",
                action="Password setup confirmed",
                target="password_setup",
                action_type="security",
            ).exists()
        )

    def test_password_setup_confirm_rejects_invalid_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        response = self.client.post(
            "/api/v1/auth/password/setup-confirm/",
            {
                "uid": uid,
                "token": "invalid-token",
                "new_password": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Admin@1234"))

    def test_password_change_requires_current_password_and_changes_it(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/v1/auth/password/change/",
            {
                "current_password": "Admin@1234",
                "new_password": "AnotherStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("AnotherStrongPass123!"))
        self.assertTrue(
            AuditLog.objects.filter(
                user="richard@gmail.com",
                action="Password changed",
                target="password_change",
                action_type="security",
            ).exists()
        )

    def test_password_change_rejects_wrong_current_password(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/v1/auth/password/change/",
            {
                "current_password": "WrongPassword123!",
                "new_password": "AnotherStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Admin@1234"))

    def test_password_change_requires_authentication(self):
        response = self.client.post(
            "/api/v1/auth/password/change/",
            {
                "current_password": "Admin@1234",
                "new_password": "AnotherStrongPass123!",
            },
            format="json",
        )

        self.assertIn(response.status_code, [401, 403])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Admin@1234"))

    def test_system_super_admin_login_is_not_hospital_scoped(self):
        super_admin = User.objects.create_superuser(
            username="drichigroup@gmail.com",
            email="drichigroup@gmail.com",
            password="Admin@1234",
            first_name="System",
            last_name="Admin",
        )
        StaffProfile.objects.create(
            user=super_admin,
            hospital=self.hospital,
            role="admin",
            phone="999888777",
        )

        response = self.client.post(
            reverse("login"),
            {"email": "drichigroup@gmail.com", "password": "Admin@1234"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["role"], "super_admin")
        self.assertNotIn("hospital", response.data)

    def test_secondary_super_admin_login_is_not_hospital_scoped(self):
        super_admin = User.objects.create_superuser(
            username="platform-admin-2@example.com",
            email="platform-admin-2@example.com",
            password="Admin@1234",
            first_name="Platform",
            last_name="Admin2",
        )
        StaffProfile.objects.create(
            user=super_admin,
            hospital=self.hospital,
            role="admin",
            phone="888777666",
        )

        response = self.client.post(
            reverse("login"),
            {"email": "platform-admin-2@example.com", "password": "Admin@1234"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["role"], "super_admin")
        self.assertNotIn("hospital", response.data)

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    def test_login_initiate_generates_otp_session(self, _mock_randint, mock_send_mail):
        response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("mfa_required"))
        self.assertIn("otp_session_id", response.data)
        self.assertTrue(LoginOTP.objects.filter(user=self.user, is_used=False).exists())
        self.assertTrue(mock_send_mail.called)

    @patch("config.urls.send_mail", side_effect=Exception("SMTP unavailable"))
    @patch("config.urls.random.randint", return_value=123456)
    def test_login_initiate_records_failed_otp_notification(self, _mock_randint, _mock_send_mail):
        response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )

        self.assertEqual(response.status_code, 500)
        self.assertTrue(
            NotificationEvent.objects.filter(
                notification_type="otp",
                recipient="richard@gmail.com",
                status="failed",
            ).exists()
        )

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    def test_trusted_device_token_skips_otp_on_next_login(self, _mock_randint, _mock_send_mail):
        initiate_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
        )
        self.assertEqual(initiate_response.status_code, 200)
        self.assertTrue(initiate_response.data.get("mfa_required"))

        verify_response = self.client.post(
            "/api/v1/auth/login/verify/",
            {
                "otp_session_id": initiate_response.data["otp_session_id"],
                "otp": "123456",
                "remember_device": True,
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
            REMOTE_ADDR="10.1.1.1",
        )

        self.assertEqual(verify_response.status_code, 200)
        self.assertIn("trusted_device_token", verify_response.data)
        first_trusted_token = verify_response.data["trusted_device_token"]

        trusted_login_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {
                "email": "richard@gmail.com",
                "password": "Admin@1234",
                "trusted_device_token": first_trusted_token,
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
            REMOTE_ADDR="10.1.1.1",
        )

        self.assertEqual(trusted_login_response.status_code, 200)
        self.assertFalse(trusted_login_response.data.get("mfa_required"))
        self.assertTrue(trusted_login_response.data.get("trusted_device"))
        self.assertIn("token", trusted_login_response.data)
        self.assertNotIn("otp_session_id", trusted_login_response.data)
        self.assertIn("trusted_device_token", trusted_login_response.data)
        self.assertNotEqual(
            trusted_login_response.data["trusted_device_token"],
            first_trusted_token,
        )

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    @patch("config.urls.OTP_RESEND_COOLDOWN_SECONDS", 0)
    def test_trusted_device_login_requires_otp_when_ip_changes(
        self,
        _mock_randint,
        _mock_send_mail,
    ):
        initiate_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            HTTP_USER_AGENT="pytest-browser-ip",
            REMOTE_ADDR="10.10.10.1",
        )
        self.assertEqual(initiate_response.status_code, 200)

        verify_response = self.client.post(
            "/api/v1/auth/login/verify/",
            {
                "otp_session_id": initiate_response.data["otp_session_id"],
                "otp": "123456",
                "remember_device": True,
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-ip",
            REMOTE_ADDR="10.10.10.1",
        )
        self.assertEqual(verify_response.status_code, 200)
        trusted_token = verify_response.data["trusted_device_token"]

        trusted_login_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {
                "email": "richard@gmail.com",
                "password": "Admin@1234",
                "trusted_device_token": trusted_token,
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-ip",
            REMOTE_ADDR="10.10.10.9",
        )

        self.assertEqual(trusted_login_response.status_code, 200)
        self.assertTrue(trusted_login_response.data.get("mfa_required"))
        self.assertIn("otp_session_id", trusted_login_response.data)

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    @patch("config.urls.OTP_RESEND_COOLDOWN_SECONDS", 0)
    def test_revoked_trusted_device_token_requires_otp_again(
        self,
        _mock_randint,
        _mock_send_mail,
    ):
        initiate_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
        )
        self.assertEqual(initiate_response.status_code, 200)

        verify_response = self.client.post(
            "/api/v1/auth/login/verify/",
            {
                "otp_session_id": initiate_response.data["otp_session_id"],
                "otp": "123456",
                "remember_device": True,
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
        )
        self.assertEqual(verify_response.status_code, 200)
        trusted_token = verify_response.data["trusted_device_token"]

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {verify_response.data['token']}"
        )
        revoke_response = self.client.post(
            "/api/v1/auth/trusted-device/revoke/",
            {"trusted_device_token": trusted_token},
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
        )
        self.assertEqual(revoke_response.status_code, 200)

        self.client.credentials()
        post_revoke_login_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {
                "email": "richard@gmail.com",
                "password": "Admin@1234",
                "trusted_device_token": trusted_token,
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
        )

        self.assertEqual(post_revoke_login_response.status_code, 200)
        self.assertTrue(post_revoke_login_response.data.get("mfa_required"))
        self.assertIn("otp_session_id", post_revoke_login_response.data)

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    @patch("config.urls.OTP_RESEND_COOLDOWN_SECONDS", 0)
    def test_trusted_device_list_and_revoke_all(
        self,
        _mock_randint,
        _mock_send_mail,
    ):
        initiate_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            HTTP_USER_AGENT="pytest-browser-list",
            REMOTE_ADDR="10.3.3.1",
        )
        self.assertEqual(initiate_response.status_code, 200)

        verify_response = self.client.post(
            "/api/v1/auth/login/verify/",
            {
                "otp_session_id": initiate_response.data["otp_session_id"],
                "otp": "123456",
                "remember_device": True,
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-list",
            REMOTE_ADDR="10.3.3.1",
        )
        self.assertEqual(verify_response.status_code, 200)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {verify_response.data['token']}")
        list_response = self.client.get("/api/v1/auth/trusted-devices/")
        self.assertEqual(list_response.status_code, 200)
        self.assertGreaterEqual(len(list_response.data.get("results", [])), 1)

        revoke_all_response = self.client.post(
            "/api/v1/auth/trusted-device/revoke-all/",
            {},
            format="json",
        )
        self.assertEqual(revoke_all_response.status_code, 200)
        self.assertGreaterEqual(revoke_all_response.data.get("revoked_count", 0), 1)

        self.client.credentials()
        login_after_revoke_all = self.client.post(
            "/api/v1/auth/login/initiate/",
            {
                "email": "richard@gmail.com",
                "password": "Admin@1234",
                "trusted_device_token": verify_response.data["trusted_device_token"],
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-list",
            REMOTE_ADDR="10.3.3.1",
        )
        self.assertEqual(login_after_revoke_all.status_code, 200)
        self.assertTrue(login_after_revoke_all.data.get("mfa_required"))

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    @patch("config.urls.OTP_RESEND_COOLDOWN_SECONDS", 0)
    def test_invalid_trusted_device_token_falls_back_to_otp(
        self,
        _mock_randint,
        _mock_send_mail,
    ):
        response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {
                "email": "richard@gmail.com",
                "password": "Admin@1234",
                "trusted_device_token": "invalid-token",
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("mfa_required"))
        self.assertIn("otp_session_id", response.data)

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    @patch("config.urls.OTP_RESEND_COOLDOWN_SECONDS", 0)
    def test_expired_trusted_device_record_falls_back_to_otp(
        self,
        _mock_randint,
        _mock_send_mail,
    ):
        initiate_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
        )
        self.assertEqual(initiate_response.status_code, 200)

        verify_response = self.client.post(
            "/api/v1/auth/login/verify/",
            {
                "otp_session_id": initiate_response.data["otp_session_id"],
                "otp": "123456",
                "remember_device": True,
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
        )
        self.assertEqual(verify_response.status_code, 200)
        trusted_token = verify_response.data["trusted_device_token"]

        token_hash = hashlib.sha256(trusted_token.encode("utf-8")).hexdigest()
        TrustedDevice.objects.filter(token_hash=token_hash).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        trusted_login_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {
                "email": "richard@gmail.com",
                "password": "Admin@1234",
                "trusted_device_token": trusted_token,
            },
            format="json",
            HTTP_USER_AGENT="pytest-browser-a",
        )

        self.assertEqual(trusted_login_response.status_code, 200)
        self.assertTrue(trusted_login_response.data.get("mfa_required"))
        self.assertIn("otp_session_id", trusted_login_response.data)

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    def test_login_initiate_enforces_resend_cooldown(self, _mock_randint, _mock_send_mail):
        first_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )
        self.assertEqual(first_response.status_code, 200)

        second_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )

        self.assertEqual(second_response.status_code, 429)
        self.assertIn("retry_after_seconds", second_response.data)

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    @patch("config.urls.OTP_RESEND_COOLDOWN_SECONDS", 0)
    @patch("config.urls.OTP_INITIATE_IP_MAX_REQUESTS", 1)
    def test_login_initiate_rate_limits_by_ip(
        self,
        _mock_randint,
        _mock_send_mail,
    ):
        first_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            REMOTE_ADDR="10.1.1.1",
        )
        self.assertEqual(first_response.status_code, 200)

        second_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            REMOTE_ADDR="10.1.1.1",
        )

        self.assertEqual(second_response.status_code, 429)
        self.assertIn("retry_after_seconds", second_response.data)

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    @patch("config.urls.OTP_RESEND_COOLDOWN_SECONDS", 0)
    @patch("config.urls.OTP_INITIATE_ACCOUNT_MAX_REQUESTS", 1)
    def test_login_initiate_rate_limits_by_account(
        self,
        _mock_randint,
        _mock_send_mail,
    ):
        first_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            REMOTE_ADDR="10.1.1.1",
        )
        self.assertEqual(first_response.status_code, 200)

        second_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            REMOTE_ADDR="10.1.1.2",
        )

        self.assertEqual(second_response.status_code, 429)
        self.assertIn("retry_after_seconds", second_response.data)

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    def test_login_verify_returns_token_after_valid_otp(self, _mock_randint, _mock_send_mail):
        initiate_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )

        verify_response = self.client.post(
            "/api/v1/auth/login/verify/",
            {
                "otp_session_id": initiate_response.data["otp_session_id"],
                "otp": "123456",
            },
            format="json",
        )

        self.assertEqual(verify_response.status_code, 200)
        self.assertIn("token", verify_response.data)
        self.assertEqual(verify_response.data["user"]["email"], "richard@gmail.com")

    @patch("config.urls.send_mail")
    @patch("config.urls.random.randint", return_value=123456)
    @patch("config.urls.OTP_VERIFY_IP_MAX_REQUESTS", 1)
    def test_login_verify_rate_limits_by_ip(
        self,
        _mock_randint,
        _mock_send_mail,
    ):
        initiate_response = self.client.post(
            "/api/v1/auth/login/initiate/",
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
            REMOTE_ADDR="10.2.2.1",
        )
        self.assertEqual(initiate_response.status_code, 200)

        first_verify = self.client.post(
            "/api/v1/auth/login/verify/",
            {
                "otp_session_id": initiate_response.data["otp_session_id"],
                "otp": "000000",
            },
            format="json",
            REMOTE_ADDR="10.2.2.1",
        )
        self.assertEqual(first_verify.status_code, 400)

        second_verify = self.client.post(
            "/api/v1/auth/login/verify/",
            {
                "otp_session_id": initiate_response.data["otp_session_id"],
                "otp": "000000",
            },
            format="json",
            REMOTE_ADDR="10.2.2.1",
        )

        self.assertEqual(second_verify.status_code, 429)
        self.assertIn("retry_after_seconds", second_verify.data)

    def test_billing_stats_endpoint_returns_summary_for_authenticated_user(self):
        login_response = self.client.post(
            reverse("login"),
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )
        token = login_response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(reverse("bill-stats"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_bills"], 1)
        self.assertEqual(response.data["paid"], 1)
        self.assertEqual(response.data["revenue"], 20.0)
        self.assertIn("revenue_today", response.data)
        self.assertIn("collected_today", response.data)
        self.assertIn("paid_today", response.data)

    def test_subscription_payment_create_assigns_hospital_from_authenticated_user(self):
        login_response = self.client.post(
            reverse("login"),
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )
        token = login_response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.post(
            "/api/v1/subscription-payments/",
            {
                "plan": "basic",
                "amount": "50.00",
                "billing_cycle_months": 6,
                "payment_method": "bank",
                "transaction_id": "TX-TEST-001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data.get("billing_cycle_months"), 6)
        self.assertTrue(
            SubscriptionPayment.objects.filter(
                transaction_id="TX-TEST-001",
                hospital=self.hospital,
                billing_cycle_months=6,
            ).exists()
        )

    def test_subscription_payment_create_rejects_invalid_billing_cycle(self):
        login_response = self.client.post(
            reverse("login"),
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )
        token = login_response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.post(
            "/api/v1/subscription-payments/",
            {
                "plan": "basic",
                "amount": "50.00",
                "billing_cycle_months": 2,
                "payment_method": "bank",
                "transaction_id": "TX-TEST-INVALID-CYCLE",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("billing_cycle_months", response.data)

    def test_subscription_payment_create_is_idempotent_with_header_key(self):
        login_response = self.client.post(
            reverse("login"),
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )
        token = login_response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        payload = {
            "plan": "basic",
            "amount": "50.00",
            "billing_cycle_months": 3,
            "payment_method": "bank",
            "transaction_id": "TX-IDEMP-001",
        }

        first_response = self.client.post(
            "/api/v1/subscription-payments/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-key-001",
        )
        second_response = self.client.post(
            "/api/v1/subscription-payments/",
            {
                "plan": "pro",
                "amount": "149.90",
                "billing_cycle_months": 6,
                "payment_method": "bank",
                "transaction_id": "TX-IDEMP-002",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-key-001",
        )

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 200)
        self.assertTrue(second_response.data.get("idempotent_replay"))
        self.assertEqual(first_response.data["id"], second_response.data["id"])
        self.assertEqual(
            SubscriptionPayment.objects.filter(
                hospital=self.hospital,
                idempotency_key="idem-key-001",
            ).count(),
            1,
        )

    def test_subscription_payment_create_rejects_duplicate_transaction_id(self):
        login_response = self.client.post(
            reverse("login"),
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )
        token = login_response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="basic",
            amount="99.90",
            transaction_id="TX-DUP-001",
            status="pending",
        )

        response = self.client.post(
            "/api/v1/subscription-payments/",
            {
                "plan": "basic",
                "amount": "99.90",
                "billing_cycle_months": 1,
                "payment_method": "bank",
                "transaction_id": "TX-DUP-001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)

    def test_superadmin_review_paid_activates_hospital_and_users(self):
        reviewer = User.objects.create_superuser(
            username="superadmin@example.com",
            email="superadmin@example.com",
            password="Admin@1234",
        )
        payment = SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="pro",
            amount="149.90",
            billing_cycle_months=6,
            payment_method="bank",
            transaction_id="TX-REVIEW-PAID",
            status="pending",
        )

        self.hospital.is_active = False
        self.hospital.subscription_status = "inactive"
        self.hospital.save(update_fields=["is_active", "subscription_status"])
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        self.client.force_authenticate(user=reviewer)
        response = self.client.post(
            f"/api/v1/subscription-payments/{payment.id}/review/",
            {"status": "paid", "review_note": "Approved after bank proof verification"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.hospital.refresh_from_db()
        self.user.refresh_from_db()
        payment.refresh_from_db()
        self.assertTrue(self.hospital.is_active)
        self.assertEqual(self.hospital.subscription_status, "active")
        self.assertEqual(self.hospital.subscription_plan, "pro")
        self.assertTrue(self.user.is_active)
        self.assertEqual(payment.status, "paid")
        self.assertIsNotNone(payment.subscription_start)
        self.assertIsNotNone(payment.subscription_end)
        self.assertEqual(
            payment.subscription_end,
            self._add_months(payment.subscription_start, 6),
        )

    @patch("billing.views.EmailMessage.send")
    def test_superadmin_review_paid_sends_receipt_email(self, mock_email_send):
        reviewer = User.objects.create_superuser(
            username="superadmin-receipt@example.com",
            email="superadmin-receipt@example.com",
            password="Admin@1234",
        )
        payment = SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="basic",
            amount="99.90",
            payment_method="bank",
            transaction_id="TX-RECEIPT-001",
            status="pending",
        )

        self.client.force_authenticate(user=reviewer)
        response = self.client.post(
            f"/api/v1/subscription-payments/{payment.id}/review/",
            {"status": "paid", "review_note": "Approved and invoice confirmed"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("receipt_email_sent"))
        self.assertTrue(mock_email_send.called)
        payment.refresh_from_db()
        self.assertEqual(payment.receipt_delivery_status, "sent")
        self.assertIsNotNone(payment.receipt_sent_at)
        self.assertEqual(payment.receipt_last_error, "")

    def test_superadmin_review_paid_fails_when_hospital_email_missing(self):
        reviewer = User.objects.create_superuser(
            username="superadmin-noemail@example.com",
            email="superadmin-noemail@example.com",
            password="Admin@1234",
        )
        self.hospital.email = ""
        self.hospital.save(update_fields=["email"])

        payment = SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="basic",
            amount="99.90",
            billing_cycle_months=3,
            payment_method="bank",
            transaction_id="TX-NO-EMAIL-001",
            status="pending",
        )

        self.client.force_authenticate(user=reviewer)
        response = self.client.post(
            f"/api/v1/subscription-payments/{payment.id}/review/",
            {"status": "paid", "review_note": "Approve"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        payment.refresh_from_db()
        self.assertEqual(payment.status, "pending")

    def test_superadmin_review_requires_review_note_for_paid(self):
        reviewer = User.objects.create_superuser(
            username="superadmin-note@example.com",
            email="superadmin-note@example.com",
            password="Admin@1234",
        )
        payment = SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="basic",
            amount="99.90",
            payment_method="bank",
            transaction_id="TX-NOTE-001",
            status="pending",
        )

        self.client.force_authenticate(user=reviewer)
        response = self.client.post(
            f"/api/v1/subscription-payments/{payment.id}/review/",
            {"status": "paid"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("review_note", response.data.get("error", ""))

    def test_superadmin_review_writes_audit_log(self):
        reviewer = User.objects.create_superuser(
            username="superadmin-audit@example.com",
            email="superadmin-audit@example.com",
            password="Admin@1234",
        )
        payment = SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="pro",
            amount="149.90",
            payment_method="bank",
            transaction_id="TX-AUDIT-001",
            status="pending",
        )

        self.client.force_authenticate(user=reviewer)
        response = self.client.post(
            f"/api/v1/subscription-payments/{payment.id}/review/",
            {"status": "failed", "review_note": "Rejected due to invalid transfer slip"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            AuditLog.objects.filter(
                hospital=self.hospital,
                action="subscription_payment_review",
                target__contains=f"payment:{payment.id}",
            ).exists()
        )

    def test_superadmin_can_fetch_comprehensive_subscription_report(self):
        reviewer = User.objects.create_superuser(
            username="superadmin-report@example.com",
            email="superadmin-report@example.com",
            password="Admin@1234",
        )
        SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="pro",
            amount="149.90",
            payment_method="bank",
            transaction_id="TX-COMP-001",
            status="paid",
        )

        self.client.force_authenticate(user=reviewer)
        response = self.client.get("/api/v1/subscription-payments/comprehensive_report/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("summary", response.data)
        self.assertIn("rows", response.data)
        self.assertGreaterEqual(len(response.data["rows"]), 1)

    def test_superadmin_can_resend_receipt_for_paid_payment(self):
        reviewer = User.objects.create_superuser(
            username="superadmin-resend@example.com",
            email="superadmin-resend@example.com",
            password="Admin@1234",
        )
        payment = SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="pro",
            amount="149.90",
            payment_method="bank",
            transaction_id="TX-RESEND-001",
            status="paid",
        )

        self.client.force_authenticate(user=reviewer)
        response = self.client.post(
            f"/api/v1/subscription-payments/{payment.id}/resend_receipt/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertTrue(response.data.get("success"))
        self.assertTrue(
            ReceiptEmailJob.objects.filter(payment=payment, status="pending").exists()
        )
        payment.refresh_from_db()
        self.assertEqual(payment.receipt_delivery_status, "queued")
        self.assertIsNotNone(payment.receipt_last_attempt_at)
        self.assertIsNone(payment.receipt_sent_at)

    @patch("billing.views.EmailMessage.send")
    def test_receipt_queue_worker_sends_pending_jobs(self, mock_email_send):
        payment = SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="pro",
            amount="149.90",
            payment_method="bank",
            transaction_id="TX-QUEUE-001",
            status="paid",
            receipt_delivery_status="queued",
        )
        ReceiptEmailJob.objects.create(payment=payment, status="pending")

        call_command("process_receipt_email_queue", limit=10)

        payment.refresh_from_db()
        job = ReceiptEmailJob.objects.get(payment=payment)
        self.assertEqual(job.status, "sent")
        self.assertEqual(payment.receipt_delivery_status, "sent")
        self.assertIsNotNone(payment.receipt_sent_at)
        self.assertTrue(mock_email_send.called)

    def test_superadmin_review_failed_deactivates_hospital_and_users(self):
        reviewer = User.objects.create_superuser(
            username="superadmin2@example.com",
            email="superadmin2@example.com",
            password="Admin@1234",
        )
        payment = SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="basic",
            amount="99.90",
            payment_method="bank",
            transaction_id="TX-REVIEW-FAILED",
            status="pending",
        )

        self.hospital.is_active = True
        self.hospital.subscription_status = "active"
        self.hospital.save(update_fields=["is_active", "subscription_status"])
        self.user.is_active = True
        self.user.save(update_fields=["is_active"])

        self.client.force_authenticate(user=reviewer)
        response = self.client.post(
            f"/api/v1/subscription-payments/{payment.id}/review/",
            {"status": "failed", "review_note": "Rejected after mismatch with bank statement"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.hospital.refresh_from_db()
        self.user.refresh_from_db()
        payment.refresh_from_db()
        self.assertFalse(self.hospital.is_active)
        self.assertEqual(self.hospital.subscription_status, "inactive")
        self.assertFalse(self.user.is_active)
        self.assertEqual(payment.status, "failed")

    def test_primary_super_admin_can_create_platform_super_admin(self):
        primary_super_admin = User.objects.create_superuser(
            username="drichigroup@gmail.com",
            email="drichigroup@gmail.com",
            password="Admin@1234",
        )

        self.client.force_authenticate(user=primary_super_admin)
        response = self.client.post(
            "/api/v1/super-admin/platform-admins/create/",
            {
                "email": "new-platform-admin@example.com",
                "first_name": "New",
                "last_name": "Platform",
                "password": "Admin@1234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            User.objects.filter(
                email="new-platform-admin@example.com",
                is_superuser=True,
            ).exists()
        )
        created_user = User.objects.get(email="new-platform-admin@example.com")
        self.assertTrue(
            AuditLog.objects.filter(
                action="create_platform_super_admin",
                target__contains=f"user:{created_user.id}",
            ).exists()
        )

    def test_secondary_super_admin_cannot_create_platform_super_admin(self):
        secondary_super_admin = User.objects.create_superuser(
            username="platform-admin@example.com",
            email="platform-admin@example.com",
            password="Admin@1234",
        )

        self.client.force_authenticate(user=secondary_super_admin)
        response = self.client.post(
            "/api/v1/super-admin/platform-admins/create/",
            {
                "email": "blocked-create@example.com",
                "password": "Admin@1234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_primary_super_admin_cannot_deactivate_primary_account(self):
        primary_super_admin = User.objects.create_superuser(
            username="drichigroup@gmail.com",
            email="drichigroup@gmail.com",
            password="Admin@1234",
        )

        self.client.force_authenticate(user=primary_super_admin)
        response = self.client.post(
            "/api/v1/super-admin/platform-admins/toggle-status/",
            {"user_id": primary_super_admin.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        primary_super_admin.refresh_from_db()
        self.assertTrue(primary_super_admin.is_active)

    def test_primary_super_admin_can_toggle_secondary_super_admin_status(self):
        primary_super_admin = User.objects.create_superuser(
            username="drichigroup@gmail.com",
            email="drichigroup@gmail.com",
            password="Admin@1234",
        )
        secondary_super_admin = User.objects.create_superuser(
            username="platform-admin-toggle@example.com",
            email="platform-admin-toggle@example.com",
            password="Admin@1234",
        )

        self.client.force_authenticate(user=primary_super_admin)
        response = self.client.post(
            "/api/v1/super-admin/platform-admins/toggle-status/",
            {"user_id": secondary_super_admin.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        secondary_super_admin.refresh_from_db()
        self.assertFalse(secondary_super_admin.is_active)
        self.assertTrue(
            AuditLog.objects.filter(
                action="toggle_platform_super_admin_status",
                target__contains=f"user:{secondary_super_admin.id}",
            ).exists()
        )

    def test_superadmin_can_list_notification_failures_and_retry_receipt_jobs(self):
        primary_super_admin = User.objects.create_superuser(
            username="drichigroup@gmail.com",
            email="drichigroup@gmail.com",
            password="Admin@1234",
        )
        payment = SubscriptionPayment.objects.create(
            hospital=self.hospital,
            plan="pro",
            amount="149.90",
            payment_method="bank",
            transaction_id="TX-NOTIF-FAIL-001",
            status="paid",
        )
        failed_job = ReceiptEmailJob.objects.create(
            payment=payment,
            status="failed",
            attempts=5,
            max_attempts=5,
            last_error="SMTP timeout",
        )
        NotificationEvent.objects.create(
            notification_type="otp",
            recipient="ops@example.com",
            subject="OTP",
            status="failed",
            attempts=3,
            error_message="SMTP unavailable",
            reference="otp_session:test",
        )

        self.client.force_authenticate(user=primary_super_admin)
        failures_response = self.client.get("/api/v1/super-admin/notifications/failures/")
        self.assertEqual(failures_response.status_code, 200)
        self.assertGreaterEqual(len(failures_response.data.get("failed_notifications", [])), 1)
        self.assertGreaterEqual(len(failures_response.data.get("failed_receipt_jobs", [])), 1)

        retry_response = self.client.post(
            "/api/v1/super-admin/notifications/retry-receipts/",
            {},
            format="json",
        )
        self.assertEqual(retry_response.status_code, 200)
        self.assertGreaterEqual(retry_response.data.get("retried_count", 0), 1)

        failed_job.refresh_from_db()
        self.assertEqual(failed_job.status, "pending")

    def test_secondary_super_admin_can_list_platform_super_admins(self):
        primary_super_admin = User.objects.create_superuser(
            username="drichigroup@gmail.com",
            email="drichigroup@gmail.com",
            password="Admin@1234",
        )
        secondary_super_admin = User.objects.create_superuser(
            username="platform-admin-list@example.com",
            email="platform-admin-list@example.com",
            password="Admin@1234",
        )

        self.client.force_authenticate(user=secondary_super_admin)
        response = self.client.get("/api/v1/super-admin/platform-admins/")

        self.assertEqual(response.status_code, 200)
        returned_emails = {item["email"] for item in response.data.get("results", [])}
        self.assertIn(primary_super_admin.email, returned_emails)
        self.assertIn(secondary_super_admin.email, returned_emails)

    def test_primary_can_create_primary_platform_super_admin(self):
        primary_super_admin = User.objects.create_superuser(
            username="drichigroup@gmail.com",
            email="drichigroup@gmail.com",
            password="Admin@1234",
        )

        self.client.force_authenticate(user=primary_super_admin)
        response = self.client.post(
            "/api/v1/super-admin/platform-admins/create/",
            {
                "email": "new-primary-admin@example.com",
                "first_name": "Chief",
                "last_name": "Admin",
                "password": "Admin@1234",
                "admin_type": "primary",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data.get("admin_type"), "primary")

        list_response = self.client.get("/api/v1/super-admin/platform-admins/")
        self.assertEqual(list_response.status_code, 200)
        primary_count = sum(
            1 for row in list_response.data.get("results", []) if row.get("admin_type") == "primary"
        )
        self.assertEqual(primary_count, 1)

    def test_primary_can_create_secondary_platform_super_admin(self):
        primary_super_admin = User.objects.create_superuser(
            username="drichigroup@gmail.com",
            email="drichigroup@gmail.com",
            password="Admin@1234",
        )

        self.client.force_authenticate(user=primary_super_admin)
        response = self.client.post(
            "/api/v1/super-admin/platform-admins/create/",
            {
                "email": "new-secondary-admin@example.com",
                "password": "Admin@1234",
                "admin_type": "secondary",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data.get("admin_type"), "secondary")
