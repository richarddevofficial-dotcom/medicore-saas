from rest_framework.decorators import api_view
from rest_framework.response import Response
from patients.models import Patient
from billing.models import Bill
from staff.models import StaffProfile
from pharmacy.models import Medicine
from django.utils import timezone

@api_view(['GET'])
def dashboard_report(request):
    today = timezone.now().date()
    return Response({
        'patients': {
            'total': Patient.objects.count(),
            'new_today': Patient.objects.filter(created_at__date=today).count(),
        },
        'billing': {
            'total_bills': Bill.objects.count(),
            'paid': Bill.objects.filter(status='paid').count(),
            'total_revenue': sum(float(b.total_amount) for b in Bill.objects.filter(status='paid')),
        },
        'staff': {
            'total': StaffProfile.objects.count(),
            'doctors': StaffProfile.objects.filter(role='doctor').count(),
        },
        'pharmacy': {
            'total_medicines': Medicine.objects.count(),
            'low_stock': Medicine.objects.filter(quantity__lte=10).count(),
        },
    })
@api_view(['GET'])
def staff_report(request):
    """Report for doctors - patients treated"""
    from patients.models import Patient
    from django.utils import timezone
    today = timezone.now().date()
    
    return Response({
        'patients_treated_today': Patient.objects.filter(status='treated', updated_at__date=today).count(),
        'patients_waiting': Patient.objects.filter(status='waiting').count(),
        'total_patients': Patient.objects.count(),
        'generated_at': timezone.now().isoformat(),
        'role': 'doctor'
    })

@api_view(['GET'])
def reception_report(request):
    """Report for receptionists - patients registered"""
    from patients.models import Patient
    from django.utils import timezone
    today = timezone.now().date()
    
    return Response({
        'patients_registered_today': Patient.objects.filter(created_at__date=today).count(),
        'total_registered': Patient.objects.count(),
        'patients_waiting': Patient.objects.filter(status='waiting').count(),
        'generated_at': timezone.now().isoformat(),
        'role': 'receptionist'
    })

@api_view(['GET'])
def cashier_report(request):
    """Report for cashiers - bills and payments"""
    from billing.models import Bill
    from django.utils import timezone
    today = timezone.now().date()
    
    bills_today = Bill.objects.filter(created_at__date=today)
    
    return Response({
        'bills_created_today': bills_today.count(),
        'payments_today': bills_today.filter(status='paid').count(),
        'revenue_today': sum(float(b.total_amount or 0) for b in bills_today.filter(status='paid')),
        'pending_bills': Bill.objects.filter(status='pending').count(),
        'total_revenue': sum(float(b.total_amount or 0) for b in Bill.objects.filter(status='paid')),
        'generated_at': timezone.now().isoformat(),
        'role': 'cashier'
    })

@api_view(['GET'])
def pharmacy_report(request):
    """Report for pharmacists - medicines dispensed"""
    from pharmacy.models import Prescription
    from django.utils import timezone
    today = timezone.now().date()
    
    return Response({
        'dispensed_today': Prescription.objects.filter(status='dispensed', dispensed_at__date=today).count(),
        'pending': Prescription.objects.filter(status__in=['pending', 'ready']).count(),
        'total_dispensed': Prescription.objects.filter(status='dispensed').count(),
        'generated_at': timezone.now().isoformat(),
        'role': 'pharmacist'
    })

@api_view(['GET'])
def lab_report(request):
    """Report for lab technicians - tests performed"""
    from patients.models import Patient
    from django.utils import timezone
    today = timezone.now().date()
    
    return Response({
        'tests_completed_today': Patient.objects.filter(status='lab_completed', updated_at__date=today).count(),
        'tests_pending': Patient.objects.filter(status__in=['lab_requested', 'lab_in_progress']).count(),
        'total_tests': Patient.objects.filter(status='lab_completed').count(),
        'generated_at': timezone.now().isoformat(),
        'role': 'lab_technician'
    })
@api_view(['GET'])
def detailed_report(request):
    """Generate detailed reports by period"""
    from patients.models import Patient
    from billing.models import Bill
    from appointments.models import Appointment
    from django.utils import timezone
    from datetime import timedelta
    
    period = request.query_params.get('period', 'daily')
    today = timezone.now().date()
    
    if period == 'daily':
        start_date = today
    elif period == 'weekly':
        start_date = today - timedelta(days=7)
    elif period == 'monthly':
        start_date = today - timedelta(days=30)
    elif period == 'quarterly':
        start_date = today - timedelta(days=90)
    else:
        start_date = today
    
    # Patients
    total_patients = Patient.objects.count()
    new_patients = Patient.objects.filter(created_at__date__gte=start_date).count()
    treated_patients = Patient.objects.filter(status='treated', updated_at__date__gte=start_date).count()
    
    # Revenue
    bills = Bill.objects.filter(created_at__date__gte=start_date)
    total_bills = bills.count()
    paid_bills = bills.filter(status='paid').count()
    revenue = sum(float(b.total_amount or 0) for b in bills.filter(status='paid'))
    pending_amount = sum(float(b.balance or 0) for b in bills.filter(status='pending'))
    
    # Appointments
    total_appointments = Appointment.objects.filter(appointment_date__gte=start_date).count()
    completed_appointments = Appointment.objects.filter(appointment_date__gte=start_date, status='completed').count()
    
    # Gender distribution
    male = Patient.objects.filter(gender='M').count()
    female = Patient.objects.filter(gender='F').count()
    
    return Response({
        'period': period,
        'start_date': start_date.isoformat(),
        'end_date': today.isoformat(),
        'generated_at': timezone.now().isoformat(),
        'patients': {
            'total': total_patients,
            'new': new_patients,
            'treated': treated_patients,
            'male': male,
            'female': female,
        },
        'billing': {
            'total_bills': total_bills,
            'paid_bills': paid_bills,
            'revenue': revenue,
            'pending': pending_amount,
        },
        'appointments': {
            'total': total_appointments,
            'completed': completed_appointments,
        },
    })
@api_view(['GET'])
def dashboard_charts(request):
    """Real data for dashboard charts"""
    from patients.models import Patient
    from billing.models import Bill
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import Count, Sum
    from django.db.models.functions import TruncMonth, TruncDay
    
    today = timezone.now().date()
    
    # Monthly data (last 7 months)
    monthly_data = []
    for i in range(6, -1, -1):
        month_start = today.replace(day=1) - timedelta(days=i*30)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        month_name = month_start.strftime('%b')
        
        patients = Patient.objects.filter(created_at__gte=month_start, created_at__lt=month_end).count()
        revenue = sum(float(b.total_amount or 0) for b in Bill.objects.filter(
            created_at__gte=month_start, created_at__lt=month_end, status='paid'
        ))
        
        monthly_data.append({
            'month': month_name,
            'patients': patients,
            'revenue': revenue,
        })
    
    # Weekly data (last 7 days)
    weekly_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_name = day.strftime('%a')
        
        consultations = Patient.objects.filter(created_at__date=day).count()
        lab_tests = Patient.objects.filter(
            status__in=['lab_requested', 'lab_in_progress', 'lab_completed'],
            updated_at__date=day
        ).count()
        pharmacy = Bill.objects.filter(created_at__date=day).count()
        
        weekly_data.append({
            'day': day_name,
            'consultations': consultations,
            'lab': lab_tests,
            'pharmacy': pharmacy,
        })
    
    # Revenue distribution
    consultation_rev = sum(float(b.consultation_fee or 0) for b in Bill.objects.filter(status='paid'))
    lab_rev = sum(float(b.lab_fee or 0) for b in Bill.objects.filter(status='paid'))
    medicine_rev = sum(float(b.medicine_fee or 0) for b in Bill.objects.filter(status='paid'))
    room_rev = sum(float(b.room_fee or 0) for b in Bill.objects.filter(status='paid'))
    
    pie_data = [
        {'name': 'Consultation', 'value': consultation_rev},
        {'name': 'Laboratory', 'value': lab_rev},
        {'name': 'Pharmacy', 'value': medicine_rev},
        {'name': 'Room Charges', 'value': room_rev},
    ]
    
    return Response({
        'monthly': monthly_data,
        'weekly': weekly_data,
        'revenue_distribution': pie_data,
    })
