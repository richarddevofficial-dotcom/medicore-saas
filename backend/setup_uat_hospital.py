#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from hospitals.models import Hospital
from staff.models import StaffProfile
from saas_billing.models import HospitalSubscription, SubscriptionPlan
import datetime

print("=" * 70)
print("🏥 UAT TESTING SETUP - Hospital & User Creation")
print("=" * 70)

# Option: Delete all existing hospitals
DELETE_EXISTING = False  # Change to True if you want fresh start

if DELETE_EXISTING:
    print("\n🗑️  Deleting existing hospitals...")
    count = Hospital.objects.count()
    Hospital.objects.all().delete()
    print(f"✅ Deleted {count} hospitals and related data")

# Create UAT Hospital
print("\n📝 Creating UAT Test Hospital...")
import uuid
from django.utils.text import slugify

uat_slug = f"uat-test-hospital-{uuid.uuid4().hex[:8]}"
registration_num = f"UAT-REG-{uuid.uuid4().hex[:12].upper()}"

hospital, created = Hospital.objects.get_or_create(
    slug=uat_slug,
    defaults={
        'name': 'UAT Test Hospital',
        'hospital_type': 'clinic',
        'registration_number': registration_num,
        'email': f'uat.test.{uuid.uuid4().hex[:6]}@medicore.local',
        'phone': '+1-555-UAT-TEST',
        'address': '123 Testing Street, UAT City',
        'city': 'UAT City',
        'state': 'UAT State',
        'country': 'Test Country',
        'subscription_plan': 'pro',
    }
)

if created:
    print(f"✅ Created new hospital: {hospital.name} (ID: {hospital.id})")
else:
    print(f"ℹ️  Hospital already exists: {hospital.name} (ID: {hospital.id})")

# Create test admin user
print("\n👤 Creating UAT Admin User...")
admin_user, created = User.objects.get_or_create(
    username='uat_admin',
    defaults={
        'email': 'uat.admin@medicore.local',
        'first_name': 'UAT',
        'last_name': 'Admin',
        'is_staff': True,
    }
)

if created:
    admin_user.set_password('UATTest@123')
    admin_user.save()
    print(f"✅ Created new admin user: {admin_user.username}")
else:
    print(f"ℹ️  Admin user already exists: {admin_user.username}")

# Create staff profile for admin
print("\n🔧 Creating Staff Profile...")
try:
    staff_profile = StaffProfile.objects.get(user=admin_user)
    staff_profile.hospital = hospital
    staff_profile.role = 'admin'
    staff_profile.save()
    print(f"✅ Updated staff profile: {admin_user.username} → admin (Hospital: {hospital.name})")
except StaffProfile.DoesNotExist:
    staff_profile = StaffProfile.objects.create(
        user=admin_user,
        hospital=hospital,
        role='admin'
    )
    print(f"✅ Created staff profile: {admin_user.username} → admin")

# Create test finance user
print("\n💰 Creating UAT Finance User...")
finance_user, created = User.objects.get_or_create(
    username='uat_finance',
    defaults={
        'email': 'uat.finance@medicore.local',
        'first_name': 'UAT',
        'last_name': 'Finance',
        'is_staff': True,
    }
)

if created:
    finance_user.set_password('UATTest@123')
    finance_user.save()
    print(f"✅ Created finance user: {finance_user.username}")
else:
    print(f"ℹ️  Finance user already exists: {finance_user.username}")

# Create staff profile for finance
try:
    finance_staff = StaffProfile.objects.get(user=finance_user)
    finance_staff.hospital = hospital
    finance_staff.role = 'finance_manager'
    finance_staff.save()
    print(f"✅ Updated staff profile: {finance_user.username} → finance_manager (Hospital: {hospital.name})")
except StaffProfile.DoesNotExist:
    finance_staff = StaffProfile.objects.create(
        user=finance_user,
        hospital=hospital,
        role='finance_manager'
    )
    print(f"✅ Created staff profile: {finance_user.username} → finance_manager")

# Create test HR user
print("\n👥 Creating UAT HR User...")
hr_user, created = User.objects.get_or_create(
    username='uat_hr',
    defaults={
        'email': 'uat.hr@medicore.local',
        'first_name': 'UAT',
        'last_name': 'HR',
        'is_staff': True,
    }
)

if created:
    hr_user.set_password('UATTest@123')
    hr_user.save()
    print(f"✅ Created HR user: {hr_user.username}")
else:
    print(f"ℹ️  HR user already exists: {hr_user.username}")

# Create staff profile for HR
try:
    hr_staff = StaffProfile.objects.get(user=hr_user)
    hr_staff.hospital = hospital
    hr_staff.role = 'hr_manager'
    hr_staff.save()
    print(f"✅ Updated staff profile: {hr_user.username} → hr_manager (Hospital: {hospital.name})")
except StaffProfile.DoesNotExist:
    hr_staff = StaffProfile.objects.create(
        user=hr_user,
        hospital=hospital,
        role='hr_manager'
    )
    print(f"✅ Created staff profile: {hr_user.username} → hr_manager")

# Optional: Create hospital subscription for testing
print("\n📊 Setting up Test Subscription...")

# Get or create Pro plan
pro_plan, _ = SubscriptionPlan.objects.get_or_create(
    code='pro',
    defaults={
        'name': 'Professional',
        'description': 'Professional Hospital Plan',
        'monthly_price': 99.99,
        'service_fee': 500.00,
        'max_staff': 100,
        'max_patients': 5000,
        'storage_gb': 500,
        'is_active': True,
    }
)

# Create subscription
try:
    subscription = HospitalSubscription.objects.get(hospital=hospital)
    print(f"ℹ️  Subscription already exists: {subscription.plan.name}")
except HospitalSubscription.DoesNotExist:
    subscription = HospitalSubscription.objects.create(
        hospital=hospital,
        plan=pro_plan,
        status='active',
        current_monthly_price=99.99,
        current_service_fee=500.00,
        currency='USD',
        auto_renew=True,
    )
    print(f"✅ Created subscription: Pro plan")

print("\n" + "=" * 70)
print("✅ UAT SETUP COMPLETE")
print("=" * 70)

print(f"""
🏥 Hospital Details:
   Name: {hospital.name}
   ID: {hospital.id}
   Email: {hospital.email}

👤 Test Users Created:

   1️⃣  Admin Account
       Username: uat_admin
       Password: UATTest@123
       Role: admin
       Access: Full system access

   2️⃣  Finance Account
       Username: uat_finance
       Password: UATTest@123
       Role: finance_manager
       Access: Finance dashboard, budgets, expenses, payroll

   3️⃣  HR Account
       Username: uat_hr
       Password: UATTest@123
       Role: hr_manager
       Access: HR dashboard, employees, attendance, leave

📊 Subscription:
   Plan: {subscription.plan.name}
   Status: {subscription.status}
   Monthly Price: ${subscription.current_monthly_price}
   Service Fee: ${subscription.current_service_fee}

🚀 Ready for Testing!

Login URL: http://localhost:3000/login
Try these accounts for different modules:
  • uat_admin → Full admin access
  • uat_finance → Finance/billing testing
  • uat_hr → Human resources testing
""")

print("=" * 70)
