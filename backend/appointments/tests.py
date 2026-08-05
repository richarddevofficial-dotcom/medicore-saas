from datetime import date, time

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from appointments.models import Appointment
from hospitals.models import Hospital
from patients.models import Patient
from staff.models import StaffProfile


class AppointmentTenantTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.hospital = self._create_hospital('primary')
		self.other_hospital = self._create_hospital('other')
		self.receptionist = self._create_staff(
			'reception@example.com', self.hospital, 'receptionist'
		)
		self.doctor = self._create_staff('doctor@example.com', self.hospital, 'doctor')
		self.external_doctor = self._create_staff(
			'external@example.com', self.other_hospital, 'doctor'
		)
		self.patient = Patient.objects.create(
			hospital=self.hospital,
			first_name='Queue',
			last_name='Patient',
			date_of_birth='1990-01-01',
			gender='F',
			phone='5550000001',
		)

	def _create_hospital(self, slug):
		return Hospital.objects.create(
			name=f'{slug.title()} Hospital',
			slug=f'{slug}-hospital',
			hospital_type='general',
			registration_number=f'{slug.upper()}-001',
			email=f'{slug}@example.com',
			phone='1234567890',
			address='1 Main Street',
			city='Juba',
			state='Central',
			country='South Sudan',
		)

	def _create_staff(self, email, hospital, role):
		user = User.objects.create_user(username=email, email=email, password='Password123')
		return StaffProfile.objects.create(user=user, hospital=hospital, role=role, phone='5550000000')

	def test_cannot_create_appointment_for_external_doctor(self):
		self.client.force_authenticate(user=self.receptionist.user)

		response = self.client.post(
			'/api/v1/appointments/',
			{
				'patient': self.patient.id,
				'doctor': self.external_doctor.id,
				'appointment_date': str(date.today()),
				'appointment_time': '09:00:00',
				'reason': 'Consultation',
			},
			format='json',
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn('doctor', response.data)

	def test_cannot_create_appointment_for_inactive_doctor(self):
		self.doctor.is_active = False
		self.doctor.save(update_fields=['is_active'])
		self.client.force_authenticate(user=self.receptionist.user)

		response = self.client.post(
			'/api/v1/appointments/',
			{
				'patient': self.patient.id,
				'doctor': self.doctor.id,
				'appointment_date': str(date.today()),
				'appointment_time': '09:00:00',
				'reason': 'Consultation',
			},
			format='json',
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn('doctor', response.data)

	def test_confirmation_assigns_same_hospital_doctor_to_patient(self):
		appointment = Appointment.objects.create(
			hospital=self.hospital,
			patient=self.patient,
			doctor=self.doctor,
			appointment_date=date.today(),
			appointment_time=time(9, 0),
			reason='Consultation',
		)
		self.client.force_authenticate(user=self.receptionist.user)

		response = self.client.post(f'/api/v1/appointments/{appointment.id}/confirm/')

		self.assertEqual(response.status_code, 200)
		self.patient.refresh_from_db()
		self.assertEqual(self.patient.assigned_doctor, self.doctor)
		self.assertEqual(self.patient.status, 'waiting')
