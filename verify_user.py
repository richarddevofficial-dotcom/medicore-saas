#!/usr/bin/env python
import os
import sys

sys.path.insert(0, r'C:\Users\iTECH SOLUTIONS\downloads\medicore-saas\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.contrib.auth import authenticate

# Check if user exists
user = User.objects.get(username='admin')
print(f"✓ User exists: {user.username}")
print(f"  Email: {user.email}")
print(f"  First name: {user.first_name}")
print(f"  Is staff: {user.is_staff}")
print(f"  Is superuser: {user.is_superuser}")

# Try to authenticate
auth_user = authenticate(username='admin', password='admin123')
if auth_user:
    print(f"\n✓ Authentication successful!")
else:
    print(f"\n✗ Authentication failed")
    
    # Try alternative auth methods
    print("\nTrying alternative methods...")
    auth_email = authenticate(username='admin@test.com', password='admin123')
    if auth_email:
        print("✓ Email auth works")
    else:
        print("✗ Email auth failed")
