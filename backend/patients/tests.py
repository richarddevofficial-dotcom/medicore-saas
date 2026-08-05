from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from billing.models import Bill
from hospitals.models import Hospital
from patients.models import Patient
from pharmacy.models import Medicine, Prescription
from staff.models import StaffProfile


class DoctorAccessControlTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Primary Hospital",
			slug="primary-hospital",
			hospital_type="general",
			registration_number="PRIMARY-001",
			email="primary@example.com",
			phone="1234567890",
			address="1 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.other_hospital = Hospital.objects.create(
			name="Other Hospital",
			slug="other-hospital",
			hospital_type="general",
			registration_number="OTHER-001",
			email="other@example.com",
			phone="1234567891",
			address="2 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.doctor = self._create_staff("doctor-one@example.com", self.hospital, "doctor")
		self.other_doctor = self._create_staff("doctor-two@example.com", self.hospital, "doctor")
		self.external_doctor = self._create_staff(
			"external-doctor@example.com", self.other_hospital, "doctor"
		)
		self.admin = self._create_staff("admin@example.com", self.hospital, "admin")
		self.other_patient = Patient.objects.create(
			hospital=self.hospital,
			first_name="Other",
			last_name="Patient",
			date_of_birth="1990-01-01",
			gender="F",
			phone="5550000001",
			assigned_doctor=self.other_doctor,
			status="waiting",
		)

	def _create_staff(self, email, hospital, role):
		user = User.objects.create_user(username=email, email=email, password="Password123")
		return StaffProfile.objects.create(
			user=user,
			hospital=hospital,
			role=role,
			phone="5550000000",
		)

	def test_doctor_can_only_view_and_update_assigned_patients(self):
		self.client.force_authenticate(user=self.doctor.user)

		queue_response = self.client.get("/api/v1/patients/doctor_queue/")
		detail_response = self.client.get(f"/api/v1/patients/{self.other_patient.mrn}/")
		update_response = self.client.post(
			f"/api/v1/patients/{self.other_patient.mrn}/update_status/",
			{"status": "treated", "diagnosis": "Unauthorized"},
			format="json",
		)

		self.assertEqual(queue_response.status_code, 200)
		self.assertEqual(queue_response.data, [])
		self.assertEqual(detail_response.status_code, 404)
		self.assertEqual(update_response.status_code, 404)
		self.other_patient.refresh_from_db()
		self.assertEqual(self.other_patient.status, "waiting")

	def test_assign_doctor_rejects_doctor_from_another_hospital(self):
		self.client.force_authenticate(user=self.admin.user)

		response = self.client.post(
			f"/api/v1/patients/{self.other_patient.mrn}/assign_doctor/",
			{"assigned_doctor": self.external_doctor.id},
			format="json",
		)

		self.assertEqual(response.status_code, 404)
		self.other_patient.refresh_from_db()
		self.assertEqual(self.other_patient.assigned_doctor, self.other_doctor)

	def test_only_lab_staff_can_start_a_paid_lab_test(self):
		lab_technician = self._create_staff(
			"lab@example.com", self.hospital, "lab_technician"
		)
		Bill.objects.create(
			hospital=self.hospital,
			patient_name="Other Patient",
			patient_mrn=self.other_patient.mrn,
			consultation_fee="20.00",
			lab_fee="10.00",
			amount_paid="30.00",
			status="paid",
		)
		self.other_patient.status = "lab_requested"
		self.other_patient.save(update_fields=["status"])

		self.client.force_authenticate(user=self.doctor.user)
		doctor_response = self.client.post(
			f"/api/v1/patients/{self.other_patient.mrn}/start_lab_test/"
		)

		self.client.force_authenticate(user=lab_technician.user)
		lab_response = self.client.post(
			f"/api/v1/patients/{self.other_patient.mrn}/start_lab_test/"
		)

		self.assertEqual(doctor_response.status_code, 403)
		self.assertEqual(lab_response.status_code, 200)
		self.other_patient.refresh_from_db()
		self.assertEqual(self.other_patient.status, "lab_in_progress")

	def test_reactivation_creates_a_new_unpaid_consultation_bill(self):
		self.other_patient.assigned_doctor = self.doctor
		self.other_patient.status = "treated"
		self.other_patient.save(update_fields=["assigned_doctor", "status"])
		previous_bill = Bill.objects.create(
			hospital=self.hospital,
			patient_name="Other Patient",
			patient_mrn=self.other_patient.mrn,
			consultation_fee="20.00",
			lab_fee="10.00",
			amount_paid="30.00",
			status="paid",
		)

		self.client.force_authenticate(user=self.admin.user)
		reactivate_response = self.client.post(
			f"/api/v1/patients/{self.other_patient.mrn}/reactivate/"
		)

		self.assertEqual(reactivate_response.status_code, 200)
		self.other_patient.refresh_from_db()
		self.assertEqual(self.other_patient.status, "waiting")
		self.assertEqual(
			Bill.objects.filter(
				hospital=self.hospital,
				patient_mrn=self.other_patient.mrn,
			).count(),
			2,
		)
		new_bill = Bill.objects.exclude(pk=previous_bill.pk).get(
			hospital=self.hospital,
			patient_mrn=self.other_patient.mrn,
		)
		self.assertEqual(str(previous_bill.consultation_fee), "20.00")
		self.assertEqual(str(new_bill.consultation_fee), "20.00")
		self.assertEqual(str(new_bill.amount_paid), "0.00")
		self.assertEqual(new_bill.status, "pending")

		self.client.force_authenticate(user=self.doctor.user)
		unpaid_response = self.client.post(
			f"/api/v1/patients/{self.other_patient.mrn}/update_status/",
			{"status": "in_consultation"},
			format="json",
		)
		self.assertEqual(unpaid_response.status_code, 402)

		new_bill.amount_paid = new_bill.consultation_fee
		new_bill.status = "paid"
		new_bill.save()
		paid_response = self.client.post(
			f"/api/v1/patients/{self.other_patient.mrn}/update_status/",
			{"status": "in_consultation"},
			format="json",
		)
		self.assertEqual(paid_response.status_code, 200)

	def test_treatment_batch_rejects_invalid_medicine_without_partial_changes(self):
		assigned_patient = Patient.objects.create(
			hospital=self.hospital,
			first_name="Assigned",
			last_name="Patient",
			date_of_birth="1990-01-01",
			gender="F",
			phone="5550000002",
			assigned_doctor=self.doctor,
			status="in_consultation",
		)
		bill = Bill.objects.create(
			hospital=self.hospital,
			patient_name="Assigned Patient",
			patient_mrn=assigned_patient.mrn,
			consultation_fee="20.00",
			amount_paid="20.00",
			status="paid",
		)
		Medicine.objects.create(
			hospital=self.hospital,
			name="Available Medicine",
			quantity=10,
			selling_price="5.00",
		)
		self.client.force_authenticate(user=self.doctor.user)

		response = self.client.post(
			f"/api/v1/patients/{assigned_patient.mrn}/complete_treatment/",
			{
				"diagnosis": "Observation",
				"prescriptions": [
					{"medicine_name": "Available Medicine", "quantity_prescribed": 2},
					{"medicine_name": "Unavailable Medicine", "quantity_prescribed": 1},
				],
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertEqual(Prescription.objects.filter(patient=assigned_patient).count(), 0)
		bill.refresh_from_db()
		self.assertEqual(str(bill.medicine_fee), "0.00")
		assigned_patient.refresh_from_db()
		self.assertEqual(assigned_patient.status, "in_consultation")
