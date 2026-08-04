from django.contrib.auth.models import User
from datetime import date
from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta

from hospitals.models import Hospital
from staff.models import StaffProfile
from patients.models import Patient
from billing.models import Bill, SubscriptionPayment
from appointments.models import Appointment
from laboratory.models import LabTest
from pharmacy.models import Prescription
from saas_billing.models import HospitalSubscription, SubscriptionPlan
from reports.views import _date_range_for_period


class ReportDateRangeTests(TestCase):
	def test_period_ranges_use_calendar_boundaries(self):
		end_date = date(2026, 8, 4)

		self.assertEqual(
			_date_range_for_period("weekly", end_date),
			(date(2026, 8, 3), end_date),
		)
		self.assertEqual(
			_date_range_for_period("monthly", end_date),
			(date(2026, 8, 1), end_date),
		)
		self.assertEqual(
			_date_range_for_period("quarterly", end_date),
			(date(2026, 7, 1), end_date),
		)


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
		LabTest.objects.create(
			hospital=self.hospital_pro,
			patient=self.pro_patient,
			test_name="Full Blood Count",
			status="requested",
		)
		Prescription.objects.create(
			hospital=self.hospital_pro,
			patient=self.pro_patient,
			medicine_name="Amoxicillin",
			dosage="500mg",
			status="dispensed",
			dispensed_at=timezone.now(),
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

	def test_dashboard_charts_use_core_module_records_and_scope_hospital(self):
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get("/api/v1/reports/dashboard-charts/")

		self.assertEqual(response.status_code, 200)
		today_row = next(
			row
			for row in response.data["weekly"]
			if row["day"] == timezone.now().strftime("%a")
		)
		self.assertEqual(today_row["consultations"], 1)
		self.assertEqual(today_row["lab"], 1)
		self.assertEqual(today_row["pharmacy"], 1)

	def test_pro_plan_can_access_detailed_reports(self):
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get("/api/v1/reports/detailed/?period=daily")

		self.assertEqual(response.status_code, 200)

	def test_saas_subscription_plan_takes_precedence_for_report_access(self):
		plan = SubscriptionPlan.objects.create(
			code="pro",
			name="Professional",
			monthly_price="89.90",
			service_fee="500.00",
			max_staff=100,
			max_patients=20000,
		)
		HospitalSubscription.objects.create(
			hospital=self.hospital_pro,
			plan=plan,
			current_monthly_price="89.90",
			current_service_fee="500.00",
		)
		self.hospital_pro.subscription_plan = "basic"
		self.hospital_pro.save(update_fields=["subscription_plan"])
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get("/api/v1/reports/detailed/?period=daily")

		self.assertEqual(response.status_code, 200)

	def test_user_without_hospital_cannot_access_dashboard_report(self):
		user = User.objects.create_user(
			username="no-hospital-user",
			email="no-hospital@example.com",
			password="Admin@1234",
		)
		self.client.force_authenticate(user=user)

		response = self.client.get("/api/v1/reports/dashboard/")

		self.assertEqual(response.status_code, 403)

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

	def test_detailed_report_scopes_gender_counts_to_requested_dates(self):
		old_patient = Patient.objects.create(
			hospital=self.hospital_pro,
			first_name="Historical",
			last_name="Patient",
			date_of_birth="1989-01-01",
			gender="M",
			phone="400500601",
		)
		Patient.objects.filter(pk=old_patient.pk).update(
			created_at=timezone.now() - timedelta(days=31),
		)
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get("/api/v1/reports/detailed/?period=daily")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["patients"]["male"], 0)
		self.assertEqual(response.data["patients"]["female"], 1)

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
