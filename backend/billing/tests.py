from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from billing.models import Bill
from billing.models import SubscriptionPayment
from hospitals.models import Hospital
from staff.models import StaffProfile


class AuthAndBillingSmokeTests(TestCase):
    def setUp(self):
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

    def test_login_returns_token_and_user_payload(self):
        response = self.client.post(
            reverse("login"),
            {"email": "richard@gmail.com", "password": "Admin@1234"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], "richard@gmail.com")

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
                "payment_method": "bank",
                "transaction_id": "TX-TEST-001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            SubscriptionPayment.objects.filter(
                transaction_id="TX-TEST-001",
                hospital=self.hospital,
            ).exists()
        )

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
            {"status": "paid"},
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
            {"status": "failed"},
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
