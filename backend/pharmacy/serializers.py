from rest_framework import serializers
from .models import Medicine, Prescription

class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = '__all__'
        read_only_fields = ['hospital', 'created_at']

class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    patient_name_input = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = Prescription
        fields = '__all__'
        read_only_fields = ['hospital', 'created_at', 'dispensed_at']
    
    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}" if obj.patient else "N/A"
    
    def get_doctor_name(self, obj):
        return f"Dr. {obj.doctor.user.get_full_name()}" if obj.doctor else "N/A"
    
    def create(self, validated_data):
        validated_data.pop('patient_name_input', None)
        if 'hospital' not in validated_data or validated_data['hospital'] is None:
            raise serializers.ValidationError({'hospital': 'Hospital context is required'})
        return super().create(validated_data)