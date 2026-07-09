from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta

from hospitals.models import Hospital
from staff.models import StaffProfile
from patients.models import Patient
from billing.models import Bill, SubscriptionPayment
from appointments.models import Appointment


class ReportsPlanAccessTests(TestCase):
	def setUp(self):
		self.client = APIClient()

		self.hospital_basic = Hospital.objects.create(
			name="Basic Reports Hospital",
			slug="basic-reports-hospital",
			hospital_type="general",
			registration_number="REG-BASIC-REP",
			email="basic-reports@example.com",
			phone="333333333",
			address="Addr 1",
			city="Juba",
			state="Central",
			country="South Sudan",
			subscription_plan="basic",
		)
		self.hospital_pro = Hospital.objects.create(
			name="Pro Reports Hospital",
			slug="pro-reports-hospital",
			hospital_type="general",
			registration_number="REG-PRO-REP",
			email="pro-reports@example.com",
			phone="444444444",
			address="Addr 2",
			city="Juba",
			state="Central",
			country="South Sudan",
			subscription_plan="pro",
		)

		self.basic_user = User.objects.create_user(
			username="basic-reports-admin",
			email="basic-reports-admin@example.com",
			password="Admin@1234",
		)
		self.pro_user = User.objects.create_user(
			username="pro-reports-admin",
			email="pro-reports-admin@example.com",
			password="Admin@1234",
		)

		StaffProfile.objects.create(
			user=self.basic_user,
			hospital=self.hospital_basic,
			role="admin",
			phone="555000333",
		)
		StaffProfile.objects.create(
			user=self.pro_user,
			hospital=self.hospital_pro,
			role="admin",
			phone="555000444",
		)

		self.basic_patient = Patient.objects.create(
			hospital=self.hospital_basic,
			first_name="Basic",
			last_name="Patient",
			date_of_birth="1990-01-01",
			gender="M",
			phone="100200300",
			status="treated",
		)
		self.pro_patient = Patient.objects.create(
			hospital=self.hospital_pro,
			first_name="Pro",
			last_name="Patient",
			date_of_birth="1991-01-01",
			gender="F",
			phone="400500600",
			status="treated",
		)

		Bill.objects.create(
			hospital=self.hospital_basic,
			patient_name="Basic Patient",
			consultation_fee=40,
			total_amount=40,
			amount_paid=40,
			balance=0,
			status="paid",
		)
		Bill.objects.create(
			hospital=self.hospital_pro,
			patient_name="Pro Patient",
			consultation_fee=90,
			total_amount=90,
			amount_paid=90,
			balance=0,
			status="paid",
		)

		Appointment.objects.create(
			hospital=self.hospital_basic,
			patient=self.basic_patient,
			appointment_date=timezone.now().date(),
			appointment_time="08:30",
			reason="Review",
			status="completed",
		)
		Appointment.objects.create(
			hospital=self.hospital_pro,
			patient=self.pro_patient,
			appointment_date=timezone.now().date(),
			appointment_time="10:15",
			reason="Consult",
			status="completed",
		)

		SubscriptionPayment.objects.create(
			hospital=self.hospital_pro,
			plan="pro",
			amount="149.90",
			status="paid",
			receipt_delivery_status="sent",
		)
		SubscriptionPayment.objects.create(
			hospital=self.hospital_pro,
			plan="pro",
			amount="149.90",
			status="paid",
			receipt_delivery_status="failed",
			receipt_last_error="SMTP timeout",
		)

	def test_basic_plan_cannot_access_detailed_reports(self):
		self.client.force_authenticate(user=self.basic_user)

		response = self.client.get("/api/v1/reports/detailed/?period=daily")

		self.assertEqual(response.status_code, 403)

	def test_pro_plan_can_access_detailed_reports(self):
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get("/api/v1/reports/detailed/?period=daily")

		self.assertEqual(response.status_code, 200)

	def test_detailed_report_rejects_invalid_custom_date_range(self):
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get(
			"/api/v1/reports/detailed/?start_date=2026-07-10&end_date=2026-07-01"
		)

		self.assertEqual(response.status_code, 400)

	def test_detailed_report_scopes_data_to_request_hospital(self):
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get("/api/v1/reports/detailed/?period=monthly")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["patients"]["total"], 1)
		self.assertEqual(response.data["billing"]["revenue"], 90.0)

	def test_pro_plan_can_access_reconciliation_report(self):
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get("/api/v1/reports/reconciliation/?period=monthly")

		self.assertEqual(response.status_code, 200)
		self.assertIn("summary", response.data)
		self.assertIn("rows", response.data)
		self.assertGreaterEqual(response.data["summary"]["paid_count"], 1)

	def test_basic_plan_cannot_access_reconciliation_report(self):
		self.client.force_authenticate(user=self.basic_user)

		response = self.client.get("/api/v1/reports/reconciliation/?period=daily")

		self.assertEqual(response.status_code, 403)
