from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from hospitals.models import Hospital
from staff.models import StaffProfile
from insurance.models import InsuranceCompany, InsuranceClaim


class InsurancePlanAccessTests(TestCase):
	def setUp(self):
		self.client = APIClient()

		self.hospital_basic = Hospital.objects.create(
			name="Basic Hospital",
			slug="basic-hospital",
			hospital_type="general",
			registration_number="REG-BASIC-INS",
			email="basic-ins@example.com",
			phone="111111111",
			address="Addr 1",
			city="Juba",
			state="Central",
			country="South Sudan",
			subscription_plan="basic",
		)
		self.hospital_pro = Hospital.objects.create(
			name="Pro Hospital",
			slug="pro-hospital",
			hospital_type="general",
			registration_number="REG-PRO-INS",
			email="pro-ins@example.com",
			phone="222222222",
			address="Addr 2",
			city="Juba",
			state="Central",
			country="South Sudan",
			subscription_plan="pro",
		)

		self.basic_user = User.objects.create_user(
			username="basic-ins-admin",
			email="basic-ins-admin@example.com",
			password="Admin@1234",
		)
		self.pro_user = User.objects.create_user(
			username="pro-ins-admin",
			email="pro-ins-admin@example.com",
			password="Admin@1234",
		)

		StaffProfile.objects.create(
			user=self.basic_user,
			hospital=self.hospital_basic,
			role="admin",
			phone="555000111",
		)
		StaffProfile.objects.create(
			user=self.pro_user,
			hospital=self.hospital_pro,
			role="admin",
			phone="555000222",
		)

	def test_basic_plan_cannot_access_insurance_companies(self):
		self.client.force_authenticate(user=self.basic_user)

		response = self.client.get("/api/v1/insurance-companies/")

		self.assertEqual(response.status_code, 403)

	def test_pro_plan_can_access_insurance_companies(self):
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.get("/api/v1/insurance-companies/")

		self.assertEqual(response.status_code, 200)

	def test_insurance_companies_are_scoped_to_hospital(self):
		InsuranceCompany.objects.create(
			hospital=self.hospital_basic,
			name="Basic Co",
			code="BASIC-CO",
		)
		InsuranceCompany.objects.create(
			hospital=self.hospital_pro,
			name="Pro Co",
			code="PRO-CO",
		)

		self.client.force_authenticate(user=self.pro_user)
		response = self.client.get("/api/v1/insurance-companies/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["name"], "Pro Co")

	def test_create_company_uses_authenticated_hospital(self):
		self.client.force_authenticate(user=self.pro_user)
		response = self.client.post(
			"/api/v1/insurance-companies/",
			{
				"name": "Scoped Co",
				"code": "SCOPED-CO",
				"coverage_percentage": "90.00",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		created = InsuranceCompany.objects.get(id=response.data["id"])
		self.assertEqual(created.hospital_id, self.hospital_pro.id)

	def test_cannot_create_claim_with_company_from_another_hospital(self):
		foreign_company = InsuranceCompany.objects.create(
			hospital=self.hospital_basic,
			name="Foreign Co",
			code="FOREIGN-CO",
		)
		self.client.force_authenticate(user=self.pro_user)

		response = self.client.post(
			"/api/v1/insurance-claims/",
			{
				"patient_name": "John Claim",
				"policy_number": "POL-123",
				"company": foreign_company.id,
				"claim_amount": "1200.00",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("company", response.data)
		self.assertEqual(InsuranceClaim.objects.count(), 0)

	def test_same_company_code_allowed_across_different_hospitals(self):
		InsuranceCompany.objects.create(
			hospital=self.hospital_basic,
			name="Basic Shared Code",
			code="SHARED-CODE",
		)

		self.client.force_authenticate(user=self.pro_user)
		response = self.client.post(
			"/api/v1/insurance-companies/",
			{
				"name": "Pro Shared Code",
				"code": "SHARED-CODE",
				"coverage_percentage": "85.00",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		created = InsuranceCompany.objects.get(id=response.data["id"])
		self.assertEqual(created.hospital_id, self.hospital_pro.id)

	def test_duplicate_company_code_in_same_hospital_is_rejected(self):
		InsuranceCompany.objects.create(
			hospital=self.hospital_pro,
			name="Pro Existing",
			code="DUP-CODE",
		)

		self.client.force_authenticate(user=self.pro_user)
		response = self.client.post(
			"/api/v1/insurance-companies/",
			{
				"name": "Pro Duplicate",
				"code": "DUP-CODE",
				"coverage_percentage": "90.00",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("code", response.data)
