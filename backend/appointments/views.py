from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Appointment
from .serializers import AppointmentSerializer

class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['appointment_date', 'appointment_time', 'status']
    ordering = ['-appointment_date', '-appointment_time']
    
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
