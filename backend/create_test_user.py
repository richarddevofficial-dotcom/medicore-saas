#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from hospitals.models import Hospital
from departments.models import Department
from staff.models import StaffProfile

# Create test user
user, created = User.objects.get_or_create(
    username='admin',
    defaults={
        'email': 'admin@test.com',
        'is_staff': True,
        'is_superuser': True,
    }
)

if created:
    user.set_password('admin123')
    user.save()
    print(f"✓ User created: {user.username}")
else:
    print(f"✓ User already exists: {user.username}")

print("\n📝 Login Credentials:")
print(f"  Username: admin")
print(f"  Password: admin123")
print(f"  Email: admin@test.com")
print("\n🔗 Login URL: http://127.0.0.1:3000/login")
