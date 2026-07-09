from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from hospitals.models import Hospital
from patients.models import Patient
from staff.models import StaffProfile
from departments.models import Department
from pharmacy.models import Prescription, Medicine


class PrescriptionDispenseFlowTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="Pharmacy Test Hospital",
			slug="pharm-test",
			hospital_type="general",
			registration_number="PHARM-001",
			email="pharm@example.com",
			phone="0900000000",
			address="Main St",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.department = Department.objects.create(
			hospital=self.hospital,
			name="General",
		)

		self.user = User.objects.create_user(
			username="pharm@example.com",
			email="pharm@example.com",
			password="Admin@1234",
			first_name="Pharm",
			last_name="User",
		)
		self.staff_profile = StaffProfile.objects.create(
			user=self.user,
			hospital=self.hospital,
			department=self.department,
			role="pharmacist",
			phone="0911111111",
		)

		self.patient = Patient.objects.create(
			hospital=self.hospital,
			first_name="John",
			last_name="Doe",
			date_of_birth="1990-01-01",
			gender="M",
			phone="0922222222",
			status="waiting",
		)

		self.medicine = Medicine.objects.create(
			hospital=self.hospital,
			name="Paracetamol",
			quantity=50,
			selling_price=100,
			reorder_level=10,
		)

		self.prescription = Prescription.objects.create(
			hospital=self.hospital,
			patient=self.patient,
			medicine_name="Paracetamol",
			dosage="1 tab bd",
			quantity_prescribed=5,
			quantity_dispensed=0,
			status="ready",
			medicine_amount=500,
		)

		self.client.force_authenticate(user=self.user)

	def test_queue_returns_ready_prescriptions(self):
		response = self.client.get("/api/v1/prescriptions/queue/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["status"], "ready")

	def test_dispense_endpoint_marks_prescription_dispensed(self):
		response = self.client.post(
			f"/api/v1/prescriptions/{self.prescription.id}/dispense/",
			{"quantity": 5},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.prescription.refresh_from_db()
		self.medicine.refresh_from_db()
		self.assertEqual(self.prescription.status, "dispensed")
		self.assertEqual(self.prescription.quantity_dispensed, 5)
		self.assertEqual(self.medicine.quantity, 45)

	def test_dispense_endpoint_rejects_when_stock_is_insufficient(self):
		self.medicine.quantity = 2
		self.medicine.save(update_fields=["quantity"])

		response = self.client.post(
			f"/api/v1/prescriptions/{self.prescription.id}/dispense/",
			{"quantity": 5},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.prescription.refresh_from_db()
		self.medicine.refresh_from_db()
		self.assertEqual(self.prescription.status, "ready")
		self.assertEqual(self.prescription.quantity_dispensed, 0)
		self.assertEqual(self.medicine.quantity, 2)

	def test_dispense_endpoint_returns_404_when_medicine_missing(self):
		self.medicine.delete()

		response = self.client.post(
			f"/api/v1/prescriptions/{self.prescription.id}/dispense/",
			{"quantity": 1},
			format="json",
		)

		self.assertEqual(response.status_code, 404)
		self.prescription.refresh_from_db()
		self.assertEqual(self.prescription.status, "ready")
		self.assertEqual(self.prescription.quantity_dispensed, 0)

	def test_queue_hides_other_hospital_prescriptions(self):
		other_hospital = Hospital.objects.create(
			name="Other Hospital",
			slug="other-hospital",
			hospital_type="general",
			registration_number="PHARM-002",
			email="other@example.com",
			phone="0900000001",
			address="Other St",
			city="Juba",
			state="Central",
			country="South Sudan",
		)

		other_patient = Patient.objects.create(
			hospital=other_hospital,
			first_name="Jane",
			last_name="Smith",
			date_of_birth="1991-01-01",
			gender="F",
			phone="0933333333",
			status="waiting",
		)

		Prescription.objects.create(
			hospital=other_hospital,
			patient=other_patient,
			medicine_name="Amoxicillin",
			dosage="1 cap bd",
			quantity_prescribed=3,
			quantity_dispensed=0,
			status="ready",
			medicine_amount=300,
		)

		response = self.client.get("/api/v1/prescriptions/queue/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["id"], self.prescription.id)

	def test_dispense_rejects_cross_hospital_prescription_access(self):
		other_hospital = Hospital.objects.create(
			name="Other Hospital 2",
			slug="other-hospital-2",
			hospital_type="general",
			registration_number="PHARM-003",
			email="other2@example.com",
			phone="0900000002",
			address="Other 2 St",
			city="Juba",
			state="Central",
			country="South Sudan",
		)

		other_patient = Patient.objects.create(
			hospital=other_hospital,
			first_name="Paul",
			last_name="Lee",
			date_of_birth="1992-01-01",
			gender="M",
			phone="0944444444",
			status="waiting",
		)

		other_medicine = Medicine.objects.create(
			hospital=other_hospital,
			name="Ibuprofen",
			quantity=20,
			selling_price=100,
			reorder_level=5,
		)

		other_prescription = Prescription.objects.create(
			hospital=other_hospital,
			patient=other_patient,
			medicine_name="Ibuprofen",
			dosage="1 tab daily",
			quantity_prescribed=2,
			quantity_dispensed=0,
			status="ready",
			medicine_amount=200,
		)

		response = self.client.post(
			f"/api/v1/prescriptions/{other_prescription.id}/dispense/",
			{"quantity": 1},
			format="json",
		)

		self.assertEqual(response.status_code, 404)
		other_prescription.refresh_from_db()
		other_medicine.refresh_from_db()
		self.assertEqual(other_prescription.status, "ready")
		self.assertEqual(other_prescription.quantity_dispensed, 0)
		self.assertEqual(other_medicine.quantity, 20)


class PrescriptionQueueSuperadminScopeTests(TestCase):
	def setUp(self):
		self.client = APIClient()

		self.hospital_a = Hospital.objects.create(
			name="Hospital A",
			slug="hospital-a",
			hospital_type="general",
			registration_number="SUP-001",
			email="a@example.com",
			phone="0800000001",
			address="A Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.hospital_b = Hospital.objects.create(
			name="Hospital B",
			slug="hospital-b",
			hospital_type="general",
			registration_number="SUP-002",
			email="b@example.com",
			phone="0800000002",
			address="B Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)

		self.patient_a = Patient.objects.create(
			hospital=self.hospital_a,
			first_name="Alice",
			last_name="One",
			date_of_birth="1993-01-01",
			gender="F",
			phone="0950000001",
			status="waiting",
		)
		self.patient_b = Patient.objects.create(
			hospital=self.hospital_b,
			first_name="Bob",
			last_name="Two",
			date_of_birth="1994-01-01",
			gender="M",
			phone="0950000002",
			status="waiting",
		)

		self.prescription_a = Prescription.objects.create(
			hospital=self.hospital_a,
			patient=self.patient_a,
			medicine_name="Drug A",
			dosage="1 daily",
			quantity_prescribed=2,
			status="ready",
		)
		self.prescription_b = Prescription.objects.create(
			hospital=self.hospital_b,
			patient=self.patient_b,
			medicine_name="Drug B",
			dosage="2 daily",
			quantity_prescribed=3,
			status="pending",
		)

		self.superadmin = User.objects.create_superuser(
			username="superadmin@example.com",
			email="superadmin@example.com",
			password="Admin@1234",
		)
		self.client.force_authenticate(user=self.superadmin)

	def test_superadmin_queue_without_hospital_id_returns_all_hospitals(self):
		response = self.client.get("/api/v1/prescriptions/queue/")

		self.assertEqual(response.status_code, 200)
		ids = {item["id"] for item in response.data}
		self.assertIn(self.prescription_a.id, ids)
		self.assertIn(self.prescription_b.id, ids)

	def test_superadmin_queue_with_hospital_id_scopes_results(self):
		response = self.client.get(
			f"/api/v1/prescriptions/queue/?hospital_id={self.hospital_a.id}"
		)

		self.assertEqual(response.status_code, 200)
		ids = {item["id"] for item in response.data}
		self.assertIn(self.prescription_a.id, ids)
		self.assertNotIn(self.prescription_b.id, ids)
