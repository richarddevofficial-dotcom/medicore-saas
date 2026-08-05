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

    def validate(self, attrs):
        request = self.context.get('request')
        hospital = attrs.get('hospital') or getattr(self.instance, 'hospital', None)
        if not hospital and request is not None:
            hospital = _resolve_request_hospital(request)

        patient = attrs.get('patient') or getattr(self.instance, 'patient', None)
        doctor = attrs.get('doctor', getattr(self.instance, 'doctor', None))
        errors = {}
        if patient and patient.hospital_id != hospital.id:
            errors['patient'] = 'Patient does not belong to this hospital.'
        if doctor and (
            doctor.hospital_id != hospital.id
            or doctor.role != 'doctor'
            or not doctor.is_active
        ):
            errors['doctor'] = 'Doctor must be an active doctor in this hospital.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs
    
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
