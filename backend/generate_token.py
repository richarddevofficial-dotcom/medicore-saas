import os
import sys
sys.path.insert(0, r'C:\Users\iTECH SOLUTIONS\downloads\medicore-saas\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

# Get admin user
user = User.objects.get(username='admin')

# Generate token
refresh = RefreshToken.for_user(user)
access_token = str(refresh.access_token)

print(f"✓ Token generated successfully!")
print(f"\nAccess Token: {access_token}")
print(f"\nRefresh Token: {str(refresh)}")

# Also build the login response
from config.urls import _build_login_response_data
response = _build_login_response_data(user)
response['token'] = access_token
response['refresh'] = str(refresh)

print(f"\nFull Login Response:")
print(f"  token: {response['token'][:50]}...")
print(f"  user: {response['user']}")
