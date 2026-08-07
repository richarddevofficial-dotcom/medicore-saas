from django.contrib.auth.models import User
from datetime import date, time, timedelta
from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone

from hospitals.models import Hospital
from staff.models import StaffProfile
from patients.models import Patient
from billing.models import Bill, BillPayment, SubscriptionPayment
from appointments.models import Appointment
from laboratory.models import LabTest
from imaging.models import ImagingTest
from human_resources.models import (
	Attendance,
	Employee,
	LeaveRequest,
	LeaveType,
	Shift,
	ShiftAssignment,
)
from pharmacy.models import Medicine, Prescription
from ipd.models import (
	Admission,
	InpatientMedicationOrder,
	MedicationAdministration,
	NursingObservation,
)
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


class PersonalShiftReportTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Personal Shift Hospital",
			slug="personal-shift-hospital",
			hospital_type="general",
			registration_number="REG-PERSONAL-SHIFT",
			email="personal-shift@example.com",
			phone="555000111",
			address="Shift Road",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.user = User.objects.create_user(
			username="receptionist@example.com",
			password="Password123!",
			first_name="Reception",
			last_name="One",
		)
		self.profile = StaffProfile.objects.create(
			user=self.user,
			hospital=self.hospital,
			role="receptionist",
			phone="555000112",
		)
		self.employee = Employee.objects.create(
			hospital=self.hospital,
			user=self.user,
			employee_number="SHIFT-001",
			first_name="Reception",
			last_name="One",
			national_id="SHIFT-TEST-001",
			passport_number="SHIFT-PASSPORT-001",
			bank_account_number="SHIFT-BANK-001",
			tax_number="SHIFT-TAX-001",
		)
		self.shift = Shift.objects.create(
			hospital=self.hospital,
			name="Morning",
			code="MORN",
			start_time=time(8, 0),
			end_time=time(16, 0),
			break_minutes=30,
		)
		ShiftAssignment.objects.create(
			employee=self.employee,
			shift=self.shift,
			start_date=timezone.localdate(),
		)
		Attendance.objects.create(
			employee=self.employee,
			shift=self.shift,
			attendance_date=timezone.localdate(),
			status="PRESENT",
			clock_in=timezone.now() - timedelta(hours=2),
			clock_out=timezone.now(),
		)
		self.client.force_authenticate(self.user)

	def test_receptionist_report_is_scoped_to_the_authenticated_staff_member(self):
		other_user = User.objects.create_user(
			username="other-receptionist@example.com",
			password="Password123!",
		)
		other_profile = StaffProfile.objects.create(
			user=other_user,
			hospital=self.hospital,
			role="receptionist",
			phone="555000113",
		)
		patient = Patient.objects.create(
			hospital=self.hospital,
			registered_by=self.profile,
			first_name="Registered",
			last_name="Patient",
			date_of_birth="1990-01-01",
			gender="F",
			phone="555000114",
		)
		other_patient = Patient.objects.create(
			hospital=self.hospital,
			registered_by=other_profile,
			first_name="Other",
			last_name="Patient",
			date_of_birth="1991-01-01",
			gender="M",
			phone="555000115",
		)
		Appointment.objects.create(
			hospital=self.hospital,
			patient=patient,
			booked_by=self.profile,
			appointment_date=timezone.localdate(),
			appointment_time="09:00",
			reason="Review",
		)
		Appointment.objects.create(
			hospital=self.hospital,
			patient=other_patient,
			booked_by=other_profile,
			appointment_date=timezone.localdate(),
			appointment_time="10:00",
			reason="Review",
		)

		response = self.client.get("/api/v1/reports/my-shift/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["shift"], "Morning")
		self.assertEqual(response.data["attendance_status"], "PRESENT")
		self.assertEqual(response.data["patients_registered"], 1)
		self.assertEqual(response.data["appointments_booked"], 1)

	def test_accountant_report_only_includes_own_recorded_payments(self):
		accountant_user = User.objects.create_user(
			username="accountant-shift@example.com",
			password="Password123!",
		)
		other_accountant_user = User.objects.create_user(
			username="other-accountant-shift@example.com",
			password="Password123!",
		)
		StaffProfile.objects.create(
			user=accountant_user,
			hospital=self.hospital,
			role="accountant",
			phone="555000115",
		)
		StaffProfile.objects.create(
			user=other_accountant_user,
			hospital=self.hospital,
			role="accountant",
			phone="555000116",
		)
		own_bill = Bill.objects.create(
			hospital=self.hospital,
			patient_name="Own Payment",
			consultation_fee="25.00",
			amount_paid="25.00",
			status="paid",
		)
		other_bill = Bill.objects.create(
			hospital=self.hospital,
			patient_name="Other Payment",
			consultation_fee="40.00",
			amount_paid="40.00",
			status="paid",
		)
		BillPayment.objects.create(
			bill=own_bill,
			hospital=self.hospital,
			amount="25.00",
			payment_method="cash",
			received_by=accountant_user,
			received_at=timezone.now(),
		)
		BillPayment.objects.create(
			bill=other_bill,
			hospital=self.hospital,
			amount="40.00",
			payment_method="cash",
			received_by=other_accountant_user,
			received_at=timezone.now(),
		)
		self.client.force_authenticate(accountant_user)

		response = self.client.get("/api/v1/reports/my-shift/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["payments_recorded"], 1)
		self.assertEqual(response.data["amount_collected"], 25.0)
		self.assertEqual(response.data["average_payment_value"], 25.0)

	def test_pharmacist_report_only_includes_own_dispensing_activity(self):
		pharmacist_user = User.objects.create_user(
			username="pharmacist-shift@example.com",
			password="Password123!",
		)
		other_pharmacist_user = User.objects.create_user(
			username="other-pharmacist-shift@example.com",
			password="Password123!",
		)
		pharmacist = StaffProfile.objects.create(
			user=pharmacist_user,
			hospital=self.hospital,
			role="pharmacist",
			phone="555000117",
		)
		other_pharmacist = StaffProfile.objects.create(
			user=other_pharmacist_user,
			hospital=self.hospital,
			role="pharmacist",
			phone="555000118",
		)
		own_prescription = Prescription.objects.create(
			hospital=self.hospital,
			medicine_name="Own Medicine",
			quantity_prescribed=1,
			quantity_dispensed=1,
			status="dispensed",
			dispensed_by=pharmacist,
			dispensed_at=timezone.now(),
		)
		Prescription.objects.create(
			hospital=self.hospital,
			medicine_name="Other Medicine",
			quantity_prescribed=2,
			quantity_dispensed=1,
			status="partial",
			dispensed_by=other_pharmacist,
			dispensed_at=timezone.now(),
		)
		self.client.force_authenticate(pharmacist_user)

		response = self.client.get("/api/v1/reports/my-shift/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["prescriptions_dispensed"], 1)
		self.assertEqual(response.data["fully_dispensed"], 1)
		self.assertEqual(response.data["partially_dispensed"], 0)
		self.assertEqual(own_prescription.dispensed_by, pharmacist)

	def test_nurse_report_only_includes_own_clinical_activity(self):
		nurse_user = User.objects.create_user(
			username="nurse-shift@example.com",
			password="Password123!",
		)
		other_nurse_user = User.objects.create_user(
			username="other-nurse-shift@example.com",
			password="Password123!",
		)
		nurse = StaffProfile.objects.create(
			user=nurse_user,
			hospital=self.hospital,
			role="nurse",
			phone="555000119",
		)
		other_nurse = StaffProfile.objects.create(
			user=other_nurse_user,
			hospital=self.hospital,
			role="nurse",
			phone="555000120",
		)
		patient = Patient.objects.create(
			hospital=self.hospital,
			first_name="Inpatient",
			last_name="Report",
			date_of_birth="1990-01-01",
			gender="F",
			phone="555000121",
		)
		admission = Admission.objects.create(
			hospital=self.hospital,
			patient=patient,
			status=Admission.STATUS_ADMITTED,
			provisional_diagnosis="Observation",
			reason_for_admission="Clinical monitoring",
		)
		medicine = Medicine.objects.create(
			hospital=self.hospital,
			name="Nurse Report Medicine",
			quantity=10,
			selling_price="10.00",
			reorder_level=1,
		)
		order = InpatientMedicationOrder.objects.create(
			admission=admission,
			medicine=medicine,
			dosage="1 tablet",
			frequency="daily",
		)
		NursingObservation.objects.create(
			admission=admission,
			recorded_by=nurse,
			observed_at=timezone.now(),
		)
		NursingObservation.objects.create(
			admission=admission,
			recorded_by=other_nurse,
			observed_at=timezone.now(),
		)
		MedicationAdministration.objects.create(
			medication_order=order,
			administered_by=nurse,
			administered_at=timezone.now(),
			dosage_given="1 tablet",
		)
		MedicationAdministration.objects.create(
			medication_order=order,
			administered_by=nurse,
			administered_at=timezone.now(),
			dosage_given="1 tablet",
			was_refused=True,
			refusal_reason="Patient declined",
		)
		MedicationAdministration.objects.create(
			medication_order=order,
			administered_by=other_nurse,
			administered_at=timezone.now(),
			dosage_given="1 tablet",
		)
		self.client.force_authenticate(nurse_user)

		response = self.client.get("/api/v1/reports/my-shift/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["observations_recorded"], 1)
		self.assertEqual(response.data["medications_administered"], 1)
		self.assertEqual(response.data["medications_refused"], 1)

	def test_hr_report_only_includes_own_leave_reviews(self):
		hr_user = User.objects.create_user(
			username="hr-shift@example.com",
			password="Password123!",
		)
		other_hr_user = User.objects.create_user(
			username="other-hr-shift@example.com",
			password="Password123!",
		)
		StaffProfile.objects.create(
			user=hr_user,
			hospital=self.hospital,
			role="hr_officer",
			phone="555000122",
		)
		StaffProfile.objects.create(
			user=other_hr_user,
			hospital=self.hospital,
			role="hr_manager",
			phone="555000123",
		)
		leave_type = LeaveType.objects.create(
			hospital=self.hospital,
			name="Annual Leave",
			code="ANNUAL",
			days_allowed=20,
		)
		LeaveRequest.objects.create(
			employee=self.employee,
			leave_type=leave_type,
			start_date=timezone.localdate(),
			end_date=timezone.localdate(),
			reason="Family commitment",
			status="APPROVED",
			reviewed_by=hr_user,
			reviewed_at=timezone.now(),
		)
		LeaveRequest.objects.create(
			employee=self.employee,
			leave_type=leave_type,
			start_date=timezone.localdate(),
			end_date=timezone.localdate(),
			reason="Personal appointment",
			status="REJECTED",
			reviewed_by=hr_user,
			reviewed_at=timezone.now(),
		)
		LeaveRequest.objects.create(
			employee=self.employee,
			leave_type=leave_type,
			start_date=timezone.localdate(),
			end_date=timezone.localdate(),
			reason="Other review",
			status="APPROVED",
			reviewed_by=other_hr_user,
			reviewed_at=timezone.now(),
		)
		self.client.force_authenticate(hr_user)

		response = self.client.get("/api/v1/reports/my-shift/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["leave_requests_reviewed"], 2)
		self.assertEqual(response.data["leave_requests_approved"], 1)
		self.assertEqual(response.data["leave_requests_rejected"], 1)

	def test_radiographer_report_only_includes_own_completed_tests(self):
		radiographer_user = User.objects.create_user(
			username="radiographer-shift@example.com",
			password="Password123!",
		)
		other_radiographer_user = User.objects.create_user(
			username="other-radiographer-shift@example.com",
			password="Password123!",
		)
		radiographer = StaffProfile.objects.create(
			user=radiographer_user,
			hospital=self.hospital,
			role="radiographer",
			phone="555000124",
		)
		other_radiographer = StaffProfile.objects.create(
			user=other_radiographer_user,
			hospital=self.hospital,
			role="radiographer",
			phone="555000125",
		)
		ImagingTest.objects.create(
			hospital=self.hospital,
			patient_name="Own Imaging Patient",
			test_type="xray",
			body_part="Chest",
			price="35.00",
			status="completed",
			completed_by=radiographer,
			completed_at=timezone.now(),
		)
		ImagingTest.objects.create(
			hospital=self.hospital,
			patient_name="Other Imaging Patient",
			test_type="ct",
			body_part="Head",
			price="60.00",
			status="completed",
			completed_by=other_radiographer,
			completed_at=timezone.now(),
		)
		self.client.force_authenticate(radiographer_user)

		response = self.client.get("/api/v1/reports/my-shift/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["imaging_tests_completed"], 1)
		self.assertEqual(response.data["imaging_revenue_processed"], 35.0)


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

		self.basic_bill = Bill.objects.create(
			hospital=self.hospital_basic,
			patient_name="Basic Patient",
			consultation_fee=40,
			total_amount=40,
			amount_paid=40,
			balance=0,
			status="paid",
		)
		self.pro_bill = Bill.objects.create(
			hospital=self.hospital_pro,
			patient_name="Pro Patient",
			consultation_fee=90,
			total_amount=90,
			amount_paid=90,
			balance=0,
			status="paid",
		)
		BillPayment.objects.create(
			bill=self.pro_bill,
			hospital=self.hospital_pro,
			amount="90.00",
			payment_method="cash",
			received_at=timezone.now(),
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
		self.assertIn("ipd", response.data)
		self.assertIn("laboratory", response.data)
		self.assertIn("imaging", response.data)
		self.assertIn("pharmacy", response.data)
		self.assertIn("expenses", response.data)

	def test_active_trial_can_access_detailed_reports(self):
		trial_hospital = Hospital.objects.create(
			name="Trial Reports Hospital",
			slug="trial-reports-hospital",
			hospital_type="general",
			registration_number="REG-TRIAL-REP",
			email="trial-reports@example.com",
			phone="555000555",
			address="Addr 3",
			city="Juba",
			state="Central",
			country="South Sudan",
			subscription_plan="trial",
		)
		trial_user = User.objects.create_user(
			username="trial-reports-admin",
			password="Admin@1234",
		)
		StaffProfile.objects.create(
			user=trial_user,
			hospital=trial_hospital,
			role="admin",
			phone="555000556",
		)
		starter_plan = SubscriptionPlan.objects.create(
			code="starter",
			name="Starter",
			monthly_price="49.90",
			service_fee="300.00",
			max_staff=20,
			max_patients=2000,
		)
		HospitalSubscription.objects.create(
			hospital=trial_hospital,
			plan=starter_plan,
			status=HospitalSubscription.STATUS_TRIAL,
			trial_started_at=timezone.now(),
			trial_ends_at=timezone.now() + timedelta(days=7),
			current_monthly_price="49.90",
			current_service_fee="300.00",
		)
		self.client.force_authenticate(user=trial_user)

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

	def test_detailed_report_uses_payment_ledger_for_period_revenue(self):
		today = timezone.localdate()
		old_bill = Bill.objects.create(
			hospital=self.hospital_pro,
			patient_name="Paid Later",
			consultation_fee="100.00",
			amount_paid="100.00",
			status="paid",
			payment_date=today,
		)
		Bill.objects.filter(pk=old_bill.pk).update(
			created_at=timezone.now() - timedelta(days=7),
		)
		BillPayment.objects.create(
			bill=old_bill,
			hospital=self.hospital_pro,
			amount="100.00",
			payment_method="cash",
			received_at=timezone.now(),
		)
		partial_bill = Bill.objects.create(
			hospital=self.hospital_pro,
			patient_name="Partial Payments",
			consultation_fee="60.00",
			amount_paid="50.00",
			status="partial",
			payment_date=today,
		)
		BillPayment.objects.create(
			bill=partial_bill,
			hospital=self.hospital_pro,
			amount="20.00",
			payment_method="cash",
			received_at=timezone.now() - timedelta(days=1),
		)
		BillPayment.objects.create(
			bill=partial_bill,
			hospital=self.hospital_pro,
			amount="30.00",
			payment_method="cash",
			received_at=timezone.now(),
		)
		other_hospital_bill = Bill.objects.create(
			hospital=self.hospital_basic,
			patient_name="Other Hospital Payment",
			consultation_fee="500.00",
			amount_paid="500.00",
			status="paid",
		)
		BillPayment.objects.create(
			bill=other_hospital_bill,
			hospital=self.hospital_basic,
			amount="500.00",
			payment_method="cash",
			received_at=timezone.now(),
		)
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get("/api/v1/reports/detailed/?period=daily")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["billing"]["revenue"], 220.0)
		self.assertEqual(response.data["billing"]["paid_bills"], 3)

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

	def test_non_admin_pro_staff_cannot_access_hospital_admin_reports(self):
		doctor_user = User.objects.create_user(
			username="pro-reports-doctor",
			email="pro-reports-doctor@example.com",
			password="Doctor@1234",
		)
		StaffProfile.objects.create(
			user=doctor_user,
			hospital=self.hospital_pro,
			role="doctor",
			phone="555000445",
		)
		self.client.force_authenticate(user=doctor_user)

		detailed_response = self.client.get("/api/v1/reports/detailed/?period=daily")
		reconciliation_response = self.client.get(
			"/api/v1/reports/reconciliation/?period=daily"
		)

		self.assertEqual(detailed_response.status_code, 403)
		self.assertEqual(reconciliation_response.status_code, 403)
