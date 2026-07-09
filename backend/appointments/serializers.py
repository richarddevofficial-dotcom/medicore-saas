from rest_framework import serializers
from .models import Appointment


def _resolve_request_hospital(request):
    user = request.user
    if user.is_superuser:
        hospital_id = request.data.get('hospital_id') or request.query_params.get('hospital_id')
        if not hospital_id:
            return None
        from hospitals.models import Hospital
        return Hospital.objects.filter(id=hospital_id).first()

    if hasattr(user, 'staff_profile'):
        return user.staff_profile.hospital
    return None

class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['hospital', 'created_at', 'updated_at']
    
    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"
    
    def create(self, validated_data):
        hospital = validated_data.get('hospital')
        if not hospital:
            request = self.context.get('request') if hasattr(self, 'context') else None
            if request is not None:
                hospital = _resolve_request_hospital(request)
        if not hospital:
            raise serializers.ValidationError({'hospital': 'Hospital context is required'})
        validated_data['hospital'] = hospital
        return super().create(validated_data)
