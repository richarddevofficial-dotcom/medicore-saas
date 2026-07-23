#!/usr/bin/env python
import requests
import json

response = requests.post(
    'http://127.0.0.1:8000/api/v1/auth/login/initiate/',
    json={'email': 'admin@test.com', 'password': 'admin123'}
)

data = response.json()
print(f"Status Code: {response.status_code}")
print(f"OTP: {data.get('debug_otp', 'NOT FOUND')}")
print(f"Session ID: {data.get('otp_session_id', 'NOT FOUND')}")
print(f"Destination: {data.get('destination', 'NOT FOUND')}")
