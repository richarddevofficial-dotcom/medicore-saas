from django.contrib.auth.models import User
from django.test import TestCase
from unittest.mock import patch
from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile
from config.activity_monitor import ActivityMonitor
from config.audit_logger import AuditLogger
from .models import AuditLog


class AuditLogAccessTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.primary_hospital = Hospital.objects.create(
			name='Primary Audit Hospital',
			slug='primary-audit-hospital',
			hospital_type='general',
			registration_number='AUDIT-PRIMARY-001',
			email='audit-primary@example.com',
			phone='555010001',
			address='1 Audit Street',
			city='Juba',
			state='Central',
			country='South Sudan',
		)
		self.other_hospital = Hospital.objects.create(
			name='Other Audit Hospital',
			slug='other-audit-hospital',
			hospital_type='general',
			registration_number='AUDIT-OTHER-001',
			email='audit-other@example.com',
			phone='555010002',
			address='2 Audit Street',
			city='Juba',
			state='Central',
			country='South Sudan',
		)
		self.admin = self._create_staff('audit-admin@example.com', self.primary_hospital, 'admin')
		self.doctor = self._create_staff('audit-doctor@example.com', self.primary_hospital, 'doctor')
		self.super_admin = User.objects.create_superuser(
			username='audit-super-admin@example.com',
			email='audit-super-admin@example.com',
			password='Admin@1234',
		)
		self.primary_log = AuditLog.objects.create(
			hospital=self.primary_hospital,
			user='audit-admin@example.com',
			role='admin',
			action='staff_created',
			target='staff:1',
			action_type='governance',
		)
		self.other_log = AuditLog.objects.create(
			hospital=self.other_hospital,
			user='other-admin@example.com',
			role='admin',
			action='staff_created',
			target='staff:2',
			action_type='governance',
		)

	def _create_staff(self, email, hospital, role):
		user = User.objects.create_user(
			username=email,
			email=email,
			password='Password123!',
		)
		return StaffProfile.objects.create(
			user=user,
			hospital=hospital,
			role=role,
			phone='555010003',
		)

	def test_hospital_admin_can_only_list_own_hospital_logs(self):
		self.client.force_authenticate(user=self.admin.user)

		response = self.client.get('/api/v1/audit-logs/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			[log['id'] for log in response.data['results']],
			[self.primary_log.id],
		)

	def test_non_admin_staff_cannot_list_audit_logs(self):
		self.client.force_authenticate(user=self.doctor.user)

		response = self.client.get('/api/v1/audit-logs/')

		self.assertEqual(response.status_code, 403)

	def test_super_admin_can_filter_logs_by_hospital(self):
		self.client.force_authenticate(user=self.super_admin)

		response = self.client.get(
			f'/api/v1/audit-logs/?hospital_id={self.other_hospital.id}'
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			[log['id'] for log in response.data['results']],
			[self.other_log.id],
		)

	def test_super_admin_filters_action_type_and_rejects_invalid_hospital(self):
		self.client.force_authenticate(user=self.super_admin)

		filtered = self.client.get('/api/v1/audit-logs/?action_type=governance')
		invalid = self.client.get('/api/v1/audit-logs/?hospital_id=invalid')

		self.assertEqual(filtered.status_code, 200)
		self.assertEqual(filtered.data['count'], 2)
		self.assertEqual(invalid.status_code, 400)
		self.assertIn('hospital_id', invalid.data)

	def test_central_audit_logger_persists_structured_event(self):
		entry = AuditLogger.log_audit(
			user=self.admin.user,
			action='config_change',
			target='payroll',
			old_values={'enabled': False},
			new_values={'enabled': True},
			ip_address='127.0.0.1',
		)

		self.assertIsNotNone(entry)
		self.assertEqual(entry.hospital, self.primary_hospital)
		self.assertEqual(entry.user, self.admin.user.email)
		self.assertEqual(entry.role, 'admin')
		self.assertEqual(entry.action_type, 'security')
		self.assertEqual(entry.changes['new'], {'enabled': True})

	def test_central_audit_logger_redacts_sensitive_values(self):
		entry = AuditLogger.log_audit(
			user=self.admin.user,
			action='config_change',
			target='authentication',
			new_values={
				'password': 'do-not-store',
				'nested': {'access_token': 'do-not-store'},
				'enabled': True,
			},
		)

		self.assertEqual(entry.changes['new']['password'], '[REDACTED]')
		self.assertEqual(
			entry.changes['new']['nested']['access_token'],
			'[REDACTED]',
		)
		self.assertIs(entry.changes['new']['enabled'], True)

	def test_activity_monitor_persists_anonymous_failed_login(self):
		entry = ActivityMonitor.log_event(
			user=None,
			event_type='failed_login',
			details={'email': 'unknown@example.com'},
			severity='MEDIUM',
			ip_address='127.0.0.1',
		)

		self.assertIsNotNone(entry)
		self.assertEqual(entry.user, 'anonymous')
		self.assertEqual(entry.action_type, 'security')
		self.assertEqual(entry.status, 'MEDIUM')
		self.assertEqual(entry.changes, {'email': 'unknown@example.com'})

	@patch.object(ActivityMonitor, '_send_alert')
	def test_failed_login_threshold_is_scoped_by_ip(self, send_alert):
		for attempt in range(5):
			ActivityMonitor.log_event(
				user=None,
				event_type='failed_login',
				details={'attempt': attempt},
				severity='MEDIUM',
				ip_address='127.0.0.1',
			)
		ActivityMonitor.log_event(
			user=None,
			event_type='failed_login',
			details={'attempt': 1},
			severity='MEDIUM',
			ip_address='127.0.0.2',
		)

		send_alert.assert_called_once()
		self.assertEqual(send_alert.call_args.args[2], 5)
