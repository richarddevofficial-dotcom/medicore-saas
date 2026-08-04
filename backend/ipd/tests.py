from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from hospitals.models import Hospital
from patients.models import Patient
from rooms.models import Bed, BedAssignment, Room, Ward
from staff.models import StaffProfile

from .models import Admission, InpatientTransfer, NursingObservation


class IPDLifecycleTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name="IPD Test Hospital",
			slug="ipd-test",
			hospital_type="general",
			registration_number="IPD-001",
			email="ipd@example.com",
			phone="1234567890",
			address="123 Main Street",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.user = User.objects.create_user(
			username="ipd-admin@example.com",
			email="ipd-admin@example.com",
			password="Admin@1234",
		)
		self.profile = StaffProfile.objects.create(
			user=self.user,
			hospital=self.hospital,
			role="admin",
			phone="1234567890",
		)
		self.patient = Patient.objects.create(
			hospital=self.hospital,
			mrn="IPD-0001",
			first_name="Inpatient",
			last_name="Test",
			date_of_birth="1990-01-01",
			gender="F",
			phone="5550000001",
		)
		self.ward = Ward.objects.create(
			hospital=self.hospital,
			name="General Ward",
		)
		self.room = Room.objects.create(
			hospital=self.hospital,
			ward=self.ward,
			room_number="101",
		)
		self.first_bed = Bed.objects.create(
			hospital=self.hospital,
			room=self.room,
			bed_number="A",
		)
		self.second_bed = Bed.objects.create(
			hospital=self.hospital,
			room=self.room,
			bed_number="B",
		)
		self.admission = Admission.objects.create(
			hospital=self.hospital,
			patient=self.patient,
			admitting_doctor=self.profile,
			ward=self.ward,
			room=self.room,
			admission_type=Admission.ADMISSION_ELECTIVE,
			provisional_diagnosis="Observation",
			reason_for_admission="Needs inpatient care",
			admitted_by=self.user,
		)
		self.client.force_authenticate(self.user)

	def test_admit_transfer_and_discharge_preserve_actor_types(self):
		admit_response = self.client.post(
			f"/api/v1/ipd/admissions/{self.admission.id}/admit/",
			{"bed_id": self.first_bed.id},
			format="json",
		)

		self.assertEqual(admit_response.status_code, 200)
		first_assignment = BedAssignment.objects.get(
			bed=self.first_bed,
			released_at__isnull=True,
		)
		self.assertEqual(first_assignment.assigned_by, self.profile)

		transfer_response = self.client.post(
			f"/api/v1/ipd/admissions/{self.admission.id}/transfer/",
			{"target_bed_id": self.second_bed.id, "reason": "Closer monitoring"},
			format="json",
		)

		self.assertEqual(transfer_response.status_code, 200)
		first_assignment.refresh_from_db()
		self.assertEqual(first_assignment.released_by, self.profile)
		second_assignment = BedAssignment.objects.get(
			bed=self.second_bed,
			released_at__isnull=True,
		)
		self.assertEqual(second_assignment.assigned_by, self.profile)
		self.assertEqual(
			InpatientTransfer.objects.get(admission=self.admission).transferred_by,
			self.user,
		)

		discharge_response = self.client.post(
			f"/api/v1/ipd/admissions/{self.admission.id}/discharge/",
			{
				"final_diagnosis": "Recovered",
				"clinical_summary": "Patient stable for discharge.",
			},
			format="json",
		)

		self.assertEqual(discharge_response.status_code, 200)
		second_assignment.refresh_from_db()
		self.assertEqual(second_assignment.released_by, self.profile)

	def test_discharge_rejects_invalid_bed_status_without_partial_discharge(self):
		self.client.post(
			f"/api/v1/ipd/admissions/{self.admission.id}/admit/",
			{"bed_id": self.first_bed.id},
			format="json",
		)

		response = self.client.post(
			f"/api/v1/ipd/admissions/{self.admission.id}/discharge/",
			{
				"final_diagnosis": "Recovered",
				"clinical_summary": "Patient stable for discharge.",
				"next_bed_status": "invalid",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.admission.refresh_from_db()
		self.assertEqual(self.admission.status, Admission.STATUS_ADMITTED)
		self.assertFalse(hasattr(self.admission, "discharge_summary"))

	def test_pending_admission_rejects_nursing_observations(self):
		response = self.client.post(
			f"/api/v1/ipd/admissions/{self.admission.id}/observations/",
			{"temperature": "37.0", "nursing_notes": "Initial observation"},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertFalse(
			NursingObservation.objects.filter(admission=self.admission).exists()
		)
