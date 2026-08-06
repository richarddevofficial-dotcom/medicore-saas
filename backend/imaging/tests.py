from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from hospitals.models import Hospital
from imaging.models import ImagingTest
from staff.models import StaffProfile


class ImagingCompletionTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = Hospital.objects.create(
			name='Imaging Test Hospital',
			slug='imaging-test-hospital',
			hospital_type='general',
			registration_number='REG-IMAGING-TEST',
			email='imaging@example.com',
			phone='555000201',
			address='Imaging Road',
			city='Juba',
			state='Central',
			country='South Sudan',
			subscription_plan='pro',
		)
		self.user = User.objects.create_user(
			username='radiographer@example.com',
			password='Password123!',
		)
		self.profile = StaffProfile.objects.create(
			user=self.user,
			hospital=self.hospital,
			role='radiographer',
			phone='555000202',
		)
		self.test = ImagingTest.objects.create(
			hospital=self.hospital,
			patient_name='Imaging Patient',
			test_type='xray',
			body_part='Chest',
		)
		self.client.force_authenticate(self.user)

	def test_complete_records_the_authenticated_radiographer(self):
		response = self.client.post(
			f'/api/v1/imaging-tests/{self.test.id}/complete/',
			{'result': 'No acute abnormality.'},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.test.refresh_from_db()
		self.assertEqual(self.test.status, 'completed')
		self.assertEqual(self.test.completed_by, self.profile)
		self.assertIsNotNone(self.test.completed_at)
