from rest_framework import serializers
from django.contrib.auth.models import User
from .models import StaffProfile

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email']

class StaffSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    hospital_name = serializers.SerializerMethodField()

    def get_hospital_name(self, obj):
        if obj.user.is_superuser:
            return 'MediCore'
        return obj.hospital.name if obj.hospital else ''
    
    class Meta:
        model = StaffProfile
        fields = '__all__'
        read_only_fields = ['hospital', 'created_at', 'updated_at']

class StaffCreateSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, min_length=6)
    department = serializers.IntegerField(required=False, allow_null=True)
    
    class Meta:
        model = StaffProfile
        fields = [
            'first_name', 'last_name', 'email', 'password',
            'role', 'department', 'specialization', 'license_number',
            'consultation_fee', 'max_patients_per_day', 'phone'
        ]
    
    def create(self, validated_data):
        first_name = validated_data.pop('first_name')
        last_name = validated_data.pop('last_name')
        email = validated_data.pop('email')
        password = validated_data.pop('password')
        
        # Handle empty department
        department = validated_data.pop('department', None)
        if department == '' or department == 0:
            department = None
        
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        
        staff = StaffProfile.objects.create(
            user=user,
            department_id=department,
            **validated_data
        )
        
        return staff
