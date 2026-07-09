from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from hospitals.models import Hospital
from rooms.models import Ward, Room, Bed
from patients.models import Patient
from staff.models import StaffProfile


class RoomBedManagementTests(TestCase):
	def setUp(self):
		self.client = APIClient()

		self.hospital_a = Hospital.objects.create(
			name="Hospital A",
			slug="hospital-a",
			hospital_type="general",
			registration_number="REG-ROOM-A",
			email="hospital-a@example.com",
			phone="111111111",
			address="Addr A",
			city="Juba",
			state="Central",
			country="South Sudan",
		)
		self.hospital_b = Hospital.objects.create(
			name="Hospital B",
			slug="hospital-b",
			hospital_type="general",
			registration_number="REG-ROOM-B",
			email="hospital-b@example.com",
			phone="222222222",
			address="Addr B",
			city="Juba",
			state="Central",
			country="South Sudan",
		)

		self.user_a = User.objects.create_user(
			username="admin-a@example.com",
			email="admin-a@example.com",
			password="Admin@1234",
		)
		self.user_b = User.objects.create_user(
			username="admin-b@example.com",
			email="admin-b@example.com",
			password="Admin@1234",
		)
		self.super_admin = User.objects.create_superuser(
			username="super-admin-room@example.com",
			email="super-admin-room@example.com",
			password="Admin@1234",
		)

		StaffProfile.objects.create(
			user=self.user_a,
			hospital=self.hospital_a,
			role="admin",
			phone="700001",
		)
		StaffProfile.objects.create(
			user=self.user_b,
			hospital=self.hospital_b,
			role="admin",
			phone="700002",
		)

		self.ward_a = Ward.objects.create(
			hospital=self.hospital_a,
			name="Ward A",
			ward_type="general",
			floor=1,
		)
		self.ward_b = Ward.objects.create(
			hospital=self.hospital_b,
			name="Ward B",
			ward_type="general",
			floor=1,
		)

		self.room_a = Room.objects.create(
			hospital=self.hospital_a,
			ward=self.ward_a,
			room_number="A-101",
			room_type="general",
			floor=1,
			capacity=2,
			price_per_day=10,
		)
		self.room_b = Room.objects.create(
			hospital=self.hospital_b,
			ward=self.ward_b,
			room_number="B-101",
			room_type="general",
			floor=1,
			capacity=2,
			price_per_day=10,
		)

		self.bed_a = Bed.objects.create(
			hospital=self.hospital_a,
			room=self.room_a,
			bed_number="A-BED-1",
			status="available",
		)
		self.bed_b = Bed.objects.create(
			hospital=self.hospital_b,
			room=self.room_b,
			bed_number="B-BED-1",
			status="available",
		)

		self.patient_a = Patient.objects.create(
			hospital=self.hospital_a,
			first_name="John",
			last_name="Doe",
			date_of_birth="1990-01-01",
			gender="M",
			phone="900001",
			status="registered",
		)

	def test_staff_list_is_scoped_to_hospital(self):
		self.client.force_authenticate(user=self.user_a)

		wards_response = self.client.get("/api/v1/wards/")
		rooms_response = self.client.get("/api/v1/rooms/")
		beds_response = self.client.get("/api/v1/beds/")

		self.assertEqual(wards_response.status_code, 200)
		self.assertEqual(rooms_response.status_code, 200)
		self.assertEqual(beds_response.status_code, 200)

		wards_ids = {item["id"] for item in (wards_response.data.get("results") or wards_response.data)}
		rooms_ids = {item["id"] for item in (rooms_response.data.get("results") or rooms_response.data)}
		beds_ids = {item["id"] for item in (beds_response.data.get("results") or beds_response.data)}

		self.assertEqual(wards_ids, {self.ward_a.id})
		self.assertEqual(rooms_ids, {self.room_a.id})
		self.assertEqual(beds_ids, {self.bed_a.id})

	def test_staff_cannot_create_room_in_other_hospital_ward(self):
		self.client.force_authenticate(user=self.user_a)

		response = self.client.post(
			"/api/v1/rooms/",
			{
				"room_number": "A-EXT-01",
				"ward": self.ward_b.id,
				"room_type": "general",
				"floor": 1,
				"capacity": 2,
				"price_per_day": 5,
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("ward", response.data)

	def test_staff_cannot_create_bed_in_other_hospital_room(self):
		self.client.force_authenticate(user=self.user_a)

		response = self.client.post(
			"/api/v1/beds/",
			{
				"bed_number": "X-BED-01",
				"room": self.room_b.id,
				"status": "available",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("room", response.data)

	def test_bed_status_change_synchronizes_room_occupancy(self):
		self.client.force_authenticate(user=self.user_a)

		self.assertFalse(self.room_a.is_occupied)

		occupy_response = self.client.patch(
			f"/api/v1/beds/{self.bed_a.id}/",
			{"status": "occupied"},
			format="json",
		)
		self.assertEqual(occupy_response.status_code, 200)

		self.room_a.refresh_from_db()
		self.assertTrue(self.room_a.is_occupied)

		release_response = self.client.patch(
			f"/api/v1/beds/{self.bed_a.id}/",
			{"status": "available"},
			format="json",
		)
		self.assertEqual(release_response.status_code, 200)

		self.room_a.refresh_from_db()
		self.assertFalse(self.room_a.is_occupied)

	def test_update_status_action_synchronizes_room_occupancy(self):
		self.client.force_authenticate(user=self.user_a)

		self.assertFalse(self.room_a.is_occupied)

		occupy_response = self.client.post(
			f"/api/v1/beds/{self.bed_a.id}/update_status/",
			{"status": "occupied"},
			format="json",
		)
		self.assertEqual(occupy_response.status_code, 200)

		self.room_a.refresh_from_db()
		self.assertTrue(self.room_a.is_occupied)

		release_response = self.client.post(
			f"/api/v1/beds/{self.bed_a.id}/update_status/",
			{"status": "available"},
			format="json",
		)
		self.assertEqual(release_response.status_code, 200)

		self.room_a.refresh_from_db()
		self.assertFalse(self.room_a.is_occupied)

	def test_creating_occupied_bed_sets_room_occupied(self):
		self.client.force_authenticate(user=self.user_a)

		response = self.client.post(
			"/api/v1/beds/",
			{
				"bed_number": "A-BED-2",
				"room": self.room_a.id,
				"status": "occupied",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.room_a.refresh_from_db()
		self.assertTrue(self.room_a.is_occupied)

	def test_cannot_delete_room_with_existing_beds(self):
		self.client.force_authenticate(user=self.user_a)

		response = self.client.delete(f"/api/v1/rooms/{self.room_a.id}/")
		self.assertEqual(response.status_code, 400)
		self.assertIn("room", response.data)

	def test_super_admin_list_without_hospital_filter_sees_all(self):
		self.client.force_authenticate(user=self.super_admin)

		response = self.client.get("/api/v1/rooms/")
		self.assertEqual(response.status_code, 200)

		rows = response.data.get("results") or response.data
		room_ids = {row["id"] for row in rows}
		self.assertEqual(room_ids, {self.room_a.id, self.room_b.id})

	def test_super_admin_create_requires_hospital_context(self):
		self.client.force_authenticate(user=self.super_admin)

		missing_context = self.client.post(
			"/api/v1/wards/",
			{"name": "No Context Ward", "ward_type": "general", "floor": 1},
			format="json",
		)
		self.assertEqual(missing_context.status_code, 400)

		with_context = self.client.post(
			"/api/v1/wards/",
			{
				"name": "Super Admin Ward",
				"ward_type": "general",
				"floor": 1,
				"hospital_id": self.hospital_a.id,
			},
			format="json",
		)
		self.assertEqual(with_context.status_code, 201)

	def test_assign_bed_updates_bed_and_patient_status(self):
		self.client.force_authenticate(user=self.user_a)

		response = self.client.post(
			f"/api/v1/beds/{self.bed_a.id}/assign/",
			{"patient_id": self.patient_a.id, "notes": "Admitted for observation"},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.data["patient"], self.patient_a.id)

		self.bed_a.refresh_from_db()
		self.patient_a.refresh_from_db()
		self.room_a.refresh_from_db()
		self.assertEqual(self.bed_a.status, "occupied")
		self.assertEqual(self.patient_a.status, "admitted")
		self.assertTrue(self.room_a.is_occupied)

	def test_release_bed_updates_bed_and_patient_status(self):
		self.client.force_authenticate(user=self.user_a)

		assign_response = self.client.post(
			f"/api/v1/beds/{self.bed_a.id}/assign/",
			{"patient_id": self.patient_a.id},
			format="json",
		)
		self.assertEqual(assign_response.status_code, 201)

		release_response = self.client.post(
			f"/api/v1/beds/{self.bed_a.id}/release/",
			{"release_reason": "Stable", "next_status": "cleaning"},
			format="json",
		)
		self.assertEqual(release_response.status_code, 200)
		self.assertEqual(release_response.data["status"], "released")

		self.bed_a.refresh_from_db()
		self.patient_a.refresh_from_db()
		self.assertEqual(self.bed_a.status, "cleaning")
		self.assertEqual(self.patient_a.status, "discharged")

	def test_transfer_moves_active_assignment_to_target_bed(self):
		self.client.force_authenticate(user=self.user_a)

		assign_response = self.client.post(
			f"/api/v1/beds/{self.bed_a.id}/assign/",
			{"patient_id": self.patient_a.id},
			format="json",
		)
		self.assertEqual(assign_response.status_code, 201)

		new_bed = Bed.objects.create(
			hospital=self.hospital_a,
			room=self.room_a,
			bed_number="A-BED-3",
			status="available",
		)

		transfer_response = self.client.post(
			f"/api/v1/beds/{self.bed_a.id}/transfer/",
			{"target_bed_id": new_bed.id, "notes": "Need window bed"},
			format="json",
		)
		self.assertEqual(transfer_response.status_code, 201)
		self.assertEqual(transfer_response.data["bed"], new_bed.id)

		self.bed_a.refresh_from_db()
		new_bed.refresh_from_db()
		self.assertEqual(self.bed_a.status, "cleaning")
		self.assertEqual(new_bed.status, "occupied")

	def test_occupancy_analytics_reports_summary(self):
		self.client.force_authenticate(user=self.user_a)

		self.client.post(
			f"/api/v1/beds/{self.bed_a.id}/assign/",
			{"patient_id": self.patient_a.id},
			format="json",
		)

		response = self.client.get("/api/v1/beds/occupancy_analytics/")
		self.assertEqual(response.status_code, 200)
		self.assertIn("summary", response.data)
		self.assertIn("ward_breakdown", response.data)
		self.assertEqual(response.data["summary"]["occupied"], 1)
