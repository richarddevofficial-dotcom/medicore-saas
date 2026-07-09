from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Appointment
from .serializers import AppointmentSerializer


def _resolve_request_hospital(request):
    user = request.user
    if user.is_superuser:
        hospital_id = request.query_params.get('hospital_id')
        if not hospital_id:
            return None
        from hospitals.models import Hospital
        return Hospital.objects.filter(id=hospital_id).first()

    if hasattr(user, 'staff_profile'):
        return user.staff_profile.hospital
    return None

class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['appointment_date', 'appointment_time', 'status']
    ordering = ['-appointment_date', '-appointment_time']

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return Appointment.objects.all()
        if not hospital:
            return Appointment.objects.none()
        return Appointment.objects.filter(hospital=hospital)
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm appointment and send patient to doctor queue"""
        appointment = self.get_object()
        appointment.status = 'confirmed'
        appointment.save()
        
        # Assign patient to doctor and update status to waiting
        if appointment.patient and appointment.doctor:
            patient = appointment.patient
            patient.assigned_doctor = appointment.doctor
            patient.status = 'waiting'
            patient.save()
            
            return Response({
                'message': 'Appointment confirmed. Patient sent to doctor queue.',
                'appointment': AppointmentSerializer(appointment).data,
                'patient_status': patient.status,
                'doctor': f"Dr. {appointment.doctor.user.get_full_name()}"
            })
        
        return Response({
            'message': 'Appointment confirmed.',
            'appointment': AppointmentSerializer(appointment).data,
        })
