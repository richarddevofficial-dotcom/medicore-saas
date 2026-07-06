from rest_framework import serializers
from .models import ImagingTest

class ImagingTestSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    test_type_display = serializers.CharField(source='get_test_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ImagingTest
        fields = '__all__'
        read_only_fields = ['hospital', 'created_at', 'completed_at']
    
    def get_doctor_name(self, obj):
        return f"Dr. {obj.doctor.user.get_full_name()}" if obj.doctor else "N/A"
