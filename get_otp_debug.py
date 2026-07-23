#!/usr/bin/env python
import os
import sys
import json

# Add backend to path
sys.path.insert(0, r'C:\Users\iTECH SOLUTIONS\downloads\medicore-saas\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from billing.models import LoginOTP
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.utils import timezone

# Get the admin user and their latest OTP
user = User.objects.get(username='admin')
otp = LoginOTP.objects.filter(user=user, is_used=False).order_by('-created_at').first()

if otp:
    print(f"✓ OTP Session ID: {otp.session_id}")
    print(f"✓ Expires: {otp.expires_at}")
    print(f"✓ Status: Active and ready for verification")
else:
    print("✗ No active OTP found - need to trigger login again")
    
    # If no OTP, let's check if we can test the login endpoint
    import requests
    print("\n⏳ Requesting new OTP...")
    response = requests.post(
        'http://127.0.0.1:8000/api/v1/auth/login/initiate/',
        json={'email': 'admin@test.com', 'password': 'admin123'}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ OTP Generated")
        print(f"  Session ID: {data.get('otp_session_id')}")
        print(f"  Debug OTP: {data.get('debug_otp')}")
        print(f"  Sent to: {data.get('destination')}")
    else:
        print(f"✗ Error: {response.status_code}")
        print(response.json())
