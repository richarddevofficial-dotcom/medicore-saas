#!/usr/bin/env python
import os
import sys

sys.path.insert(0, r'C:\Users\iTECH SOLUTIONS\downloads\medicore-saas\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from billing.models import LoginOTP
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from datetime import timedelta

# Get admin user
user = User.objects.get(username='admin')

# Create a known OTP for testing
test_otp_code = "123456"
otp = LoginOTP.objects.create(
    user=user,
    channel='email',
    destination=user.email,
    code_hash=make_password(test_otp_code),
    expires_at=timezone.now() + timedelta(minutes=5),
)

print(f"✅ Test OTP Created!")
print(f"   Email: {user.email}")
print(f"   OTP Code: {test_otp_code}")
print(f"   Session ID: {otp.session_id}")
print(f"   Use this OTP in the login form")
