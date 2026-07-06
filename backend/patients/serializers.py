from rest_framework import serializers
from .models import Patient

class PatientListSerializer(serializers.ModelSerializer):
    age = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Patient
        fields = [
            'id', 'mrn', 'first_name', 'last_name',
            'phone', 'gender', 'blood_group',
            'date_of_birth', 'age', 'status', 'status_display',
            'assigned_doctor', 'doctor_name', 'symptoms',
            'lab_test_requested', 'lab_test_results',
            'is_active', 'created_at',
            'lab_test_requested', 'lab_test_results',
            'imaging_requested', 'imaging_results',
            'lab_test_requested', 'lab_test_results',
            'imaging_requested', 'imaging_results',
        ]
    
    def get_age(self, obj):
        from datetime import date
        today = date.today()
        return today.year - obj.date_of_birth.year - (
            (today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day)
        )
    
    def get_doctor_name(self, obj):
        if obj.assigned_doctor:
            return f"Dr. {obj.assigned_doctor.user.get_full_name()}"
        return None

class PatientDetailSerializer(serializers.ModelSerializer):
    age = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    doctor_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    registered_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Patient
        fields = '__all__'
        read_only_fields = ['mrn', 'hospital', 'registered_by', 'created_at', 'updated_at']
    
    def get_age(self, obj):
        from datetime import date
        today = date.today()
        return today.year - obj.date_of_birth.year - (
            (today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day)
        )
    
    def get_doctor_name(self, obj):
        if obj.assigned_doctor:
            return f"Dr. {obj.assigned_doctor.user.get_full_name()}"
        return None
    
    def get_registered_by_name(self, obj):
        if obj.registered_by:
            return obj.registered_by.user.get_full_name()
        return None