from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from auditlog.models import AuditLog
from hospitals.models import Hospital
from staff.models import StaffProfile


class StaffPermissionMatrixTests(TestCase):
	def setUp(self):
		self.client = APIClient()

		self.hospital = Hospital.objects.create(
			name="Staff Matrix Hospital",
			slug="staff-matrix-hospital",
			hospital_type="general",
			registration_number="REG-STAFF-MATRIX",
			email="staff-matrix@example.com",
			phone="111222333",
			address="Staff Address",
			city="Juba",
			state="Central",
			country="South Sudan",
		)

		self.admin_user = User.objects.create_user(
			username="admin-matrix@example.com",
			email="admin-matrix@example.com",
			password="Admin@1234",
			first_name="Admin",
			last_name="Matrix",
		)
		self.reception_user = User.objects.create_user(
			username="reception-matrix@example.com",
			email="reception-matrix@example.com",
			password="Admin@1234",
			first_name="Reception",
			last_name="Matrix",
		)
		self.target_user = User.objects.create_user(
			username="target-matrix@example.com",
			email="target-matrix@example.com",
			password="Admin@1234",
			first_name="Target",
			last_name="Matrix",
		)

		self.admin_staff = StaffProfile.objects.create(
			user=self.admin_user,
			hospital=self.hospital,
			role="admin",
			phone="700001",
		)
		self.reception_staff = StaffProfile.objects.create(
			user=self.reception_user,
			hospital=self.hospital,
			role="receptionist",
			phone="700002",
		)
		self.target_staff = StaffProfile.objects.create(
			user=self.target_user,
			hospital=self.hospital,
			role="nurse",
			phone="700003",
		)

	def test_non_admin_cannot_toggle_staff_status(self):
		self.client.force_authenticate(user=self.reception_user)
		response = self.client.post(
			f"/api/v1/staff/{self.target_staff.id}/toggle_status/",
			{},
			format="json",
		)
		self.assertEqual(response.status_code, 403)

	def test_non_admin_cannot_update_staff_role(self):
		self.client.force_authenticate(user=self.reception_user)
		response = self.client.post(
			f"/api/v1/staff/{self.target_staff.id}/update_role/",
			{"role": "doctor"},
			format="json",
		)
		self.assertEqual(response.status_code, 403)

	def test_non_admin_cannot_create_staff_account(self):
		self.client.force_authenticate(user=self.reception_user)
		response = self.client.post(
			"/api/v1/staff/",
			{
				"first_name": "New",
				"last_name": "Staff",
				"email": "new-staff@example.com",
				"password": "Admin@1234",
				"role": "nurse",
				"phone": "700099",
			},
			format="json",
		)
		self.assertEqual(response.status_code, 403)

	def test_admin_can_toggle_staff_status_and_audit_logged(self):
		self.client.force_authenticate(user=self.admin_user)
		response = self.client.post(
			f"/api/v1/staff/{self.target_staff.id}/toggle_status/",
			{},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.target_staff.refresh_from_db()
		self.target_user.refresh_from_db()
		self.assertFalse(self.target_staff.is_active)
		self.assertFalse(self.target_user.is_active)
		self.assertTrue(
			AuditLog.objects.filter(
				hospital=self.hospital,
				action="staff_toggle_status",
				target__contains=f"staff_id:{self.target_staff.id}",
			).exists()
		)

	def test_admin_bulk_deactivate_requires_reason_and_confirm_count(self):
		self.client.force_authenticate(user=self.admin_user)
		response = self.client.post(
			"/api/v1/staff/bulk_deactivate/",
			{
				"staff_ids": [self.target_staff.id],
				"reason": "no",
				"confirm_count": 1,
			},
			format="json",
		)
		self.assertEqual(response.status_code, 400)

		response = self.client.post(
			"/api/v1/staff/bulk_deactivate/",
			{
				"staff_ids": [self.target_staff.id],
				"reason": "Policy update",
				"confirm_count": 2,
			},
			format="json",
		)
		self.assertEqual(response.status_code, 400)

	def test_admin_bulk_deactivate_deactivates_users_and_logs(self):
		second_user = User.objects.create_user(
			username="bulk-target-2@example.com",
			email="bulk-target-2@example.com",
			password="Admin@1234",
			first_name="Bulk",
			last_name="Two",
		)
		second_staff = StaffProfile.objects.create(
			user=second_user,
			hospital=self.hospital,
			role="nurse",
			phone="700004",
		)

		self.client.force_authenticate(user=self.admin_user)
		response = self.client.post(
			"/api/v1/staff/bulk_deactivate/",
			{
				"staff_ids": [self.target_staff.id, second_staff.id],
				"reason": "Shift restructuring",
				"confirm_count": 2,
			},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.target_staff.refresh_from_db()
		second_staff.refresh_from_db()
		self.target_user.refresh_from_db()
		second_user.refresh_from_db()
		self.assertFalse(self.target_staff.is_active)
		self.assertFalse(second_staff.is_active)
		self.assertFalse(self.target_user.is_active)
		self.assertFalse(second_user.is_active)
		self.assertEqual(response.data.get("deactivated_count"), 2)
		self.assertTrue(
			AuditLog.objects.filter(
				hospital=self.hospital,
				action="staff_bulk_deactivate",
				target__contains="count=2",
			).exists()
		)
