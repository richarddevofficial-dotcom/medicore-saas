from rest_framework import serializers
from .models import LabTest

class LabTestSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    class Meta:
        model = LabTest
        fields = '__all__'
        read_only_fields = [
            'hospital',
            'performed_by',
            'created_at',
            'completed_at',
        ]
    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}" if obj.patient else "N/A"