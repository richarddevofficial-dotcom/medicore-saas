from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import secrets
import socket
from .models import Hospital
from staff.models import StaffProfile


def normalize_domain(value):
    domain = (value or "").strip().lower()
    if not domain:
        return ""
    if domain.startswith("http://") or domain.startswith("https://"):
        raise serializers.ValidationError("Use hostname only, without protocol.")
    if "/" in domain:
        raise serializers.ValidationError("Use hostname only, without path.")
    if domain.count(".") < 1:
        raise serializers.ValidationError("Enter a valid domain like app.example.com")
    return domain

class HospitalSerializer(serializers.ModelSerializer):
    days_left = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Hospital
        fields = '__all__'
        read_only_fields = ['slug', 'created_at', 'updated_at']

class HospitalRegistrationSerializer(serializers.ModelSerializer):
    admin_email = serializers.EmailField(write_only=True)
    admin_password = serializers.CharField(write_only=True, min_length=6)
    admin_first_name = serializers.CharField(write_only=True)
    admin_last_name = serializers.CharField(write_only=True)
    
    class Meta:
        model = Hospital
        fields = [
            'name', 'hospital_type', 'registration_number',
            'email', 'phone', 'address', 'city', 'state', 'country',
            'admin_email', 'admin_password', 'admin_first_name', 'admin_last_name',
        ]
    
    def create(self, validated_data):
        admin_email = validated_data.pop('admin_email')
        admin_password = validated_data.pop('admin_password')
        admin_first_name = validated_data.pop('admin_first_name')
        admin_last_name = validated_data.pop('admin_last_name')
        
        from django.utils.text import slugify
        validated_data['slug'] = slugify(validated_data['name'])
        validated_data['trial_start'] = timezone.now()
        validated_data['trial_end'] = timezone.now() + timedelta(days=14)
        
        hospital = Hospital.objects.create(**validated_data)
        
        # Create admin user
        user = User.objects.create_user(
            username=admin_email,
            email=admin_email,
            password=admin_password,
            first_name=admin_first_name,
            last_name=admin_last_name,
        )
        
        StaffProfile.objects.create(
            user=user,
            hospital=hospital,
            role='admin',
            phone=validated_data.get('phone', ''),
        )
        
        return hospital


class DomainSetupSerializer(serializers.Serializer):
    custom_domain = serializers.CharField(max_length=200)

    def validate_custom_domain(self, value):
        return normalize_domain(value)


class DomainVerifySerializer(serializers.Serializer):
    custom_domain = serializers.CharField(max_length=200)

    def validate_custom_domain(self, value):
        return normalize_domain(value)


def generate_domain_verification_token():
    return secrets.token_hex(16)


def resolve_domain_to_ip(hostname):
    try:
        return socket.gethostbyname(hostname)
    except Exception:
        return ""
