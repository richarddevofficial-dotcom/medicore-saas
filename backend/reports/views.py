from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from config.plan_permissions import RequiresProPlan
from patients.models import Patient
from billing.models import Bill
from billing.models import SubscriptionPayment
from staff.models import StaffProfile
from pharmacy.models import Medicine
from appointments.models import Appointment
from django.utils import timezone
from django.db.models import Count, Sum, Q
from datetime import timedelta, datetime


def _resolve_report_hospital(request):
    if hasattr(request.user, 'staff_profile'):
        return request.user.staff_profile.hospital
    if request.user.is_superuser:
        hospital_id = request.headers.get('X-Impersonating-Hospital-Id') or request.query_params.get('hospital_id')
        if hospital_id:
            from hospitals.models import Hospital
            return Hospital.objects.filter(id=hospital_id).first()
        return None
    return None


def _date_range_for_period(period, end_date):
    period = (period or 'daily').lower()
    if period == 'daily':
        return end_date, end_date
    if period == 'weekly':
        return end_date - timedelta(days=6), end_date
    if period == 'monthly':
        return end_date - timedelta(days=29), end_date
    if period == 'quarterly':
        return end_date - timedelta(days=89), end_date
    return end_date, end_date


def _parse_date(raw_value, field_name):
    if not raw_value:
        return None, None
    try:
        return datetime.strptime(str(raw_value), '%Y-%m-%d').date(), None
    except ValueError:
        return None, f'{field_name} must be in YYYY-MM-DD format'


def _build_date_filters(request):
    today = timezone.now().date()
    period = request.query_params.get('period', 'daily')
    start_date_param = request.query_params.get('start_date')
    end_date_param = request.query_params.get('end_date')

    if start_date_param or end_date_param:
        start_date, start_error = _parse_date(start_date_param, 'start_date')
        if start_error:
            return None, None, None, start_error

        end_date, end_error = _parse_date(end_date_param, 'end_date')
        if end_error:
            return None, None, None, end_error

        if not start_date or not end_date:
            return None, None, None, 'Both start_date and end_date are required when using custom date range.'
        if start_date > end_date:
            return None, None, None, 'start_date cannot be after end_date.'
        if (end_date - start_date).days > 366:
            return None, None, None, 'Date range cannot exceed 366 days.'
        return start_date, end_date, 'custom', None

    start_date, end_date = _date_range_for_period(period, today)
    return start_date, end_date, period, None

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_report(request):
    today = timezone.now().date()
    hospital = _resolve_report_hospital(request)

    patients_qs = Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()
    bills_qs = Bill.objects.filter(hospital=hospital) if hospital else Bill.objects.none()
    staff_qs = StaffProfile.objects.filter(hospital=hospital) if hospital else StaffProfile.objects.none()
    meds_qs = Medicine.objects.filter(hospital=hospital) if hospital else Medicine.objects.none()

    return Response({
        'patients': {
            'total': patients_qs.count(),
            'new_today': patients_qs.filter(created_at__date=today).count(),
        },
        'billing': {
            'total_bills': bills_qs.count(),
            'paid': bills_qs.filter(status='paid').count(),
            'total_revenue': float(bills_qs.filter(status='paid').aggregate(total=Sum('total_amount')).get('total') or 0),
        },
        'staff': {
            'total': staff_qs.count(),
            'doctors': staff_qs.filter(role='doctor').count(),
        },
        'pharmacy': {
            'total_medicines': meds_qs.count(),
            'low_stock': meds_qs.filter(quantity__lte=10).count(),
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def staff_report(request):
    """Report for doctors - patients treated"""
    today = timezone.now().date()
    hospital = _resolve_report_hospital(request)
    patients_qs = Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()
    
    return Response({
        'patients_treated_today': patients_qs.filter(status='treated', updated_at__date=today).count(),
        'patients_waiting': patients_qs.filter(status='waiting').count(),
        'total_patients': patients_qs.count(),
        'generated_at': timezone.now().isoformat(),
        'role': 'doctor'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reception_report(request):
    """Report for receptionists - patients registered"""
    today = timezone.now().date()
    hospital = _resolve_report_hospital(request)
    patients_qs = Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()
    
    return Response({
        'patients_registered_today': patients_qs.filter(created_at__date=today).count(),
        'total_registered': patients_qs.count(),
        'patients_waiting': patients_qs.filter(status='waiting').count(),
        'generated_at': timezone.now().isoformat(),
        'role': 'receptionist'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cashier_report(request):
    """Report for cashiers - bills and payments"""
    today = timezone.now().date()
    hospital = _resolve_report_hospital(request)
    bills_qs = Bill.objects.filter(hospital=hospital) if hospital else Bill.objects.none()
    
    bills_today = bills_qs.filter(created_at__date=today)
    paid_today_qs = bills_today.filter(status='paid')
    paid_all_qs = bills_qs.filter(status='paid')
    
    return Response({
        'bills_created_today': bills_today.count(),
        'payments_today': paid_today_qs.count(),
        'revenue_today': float(paid_today_qs.aggregate(total=Sum('total_amount')).get('total') or 0),
        'pending_bills': bills_qs.filter(status='pending').count(),
        'total_revenue': float(paid_all_qs.aggregate(total=Sum('total_amount')).get('total') or 0),
        'generated_at': timezone.now().isoformat(),
        'role': 'cashier'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pharmacy_report(request):
    """Report for pharmacists - medicines dispensed"""
    from pharmacy.models import Prescription
    today = timezone.now().date()
    hospital = _resolve_report_hospital(request)
    prescriptions_qs = Prescription.objects.filter(hospital=hospital) if hospital else Prescription.objects.none()
    
    return Response({
        'dispensed_today': prescriptions_qs.filter(status='dispensed', dispensed_at__date=today).count(),
        'pending': prescriptions_qs.filter(status__in=['pending', 'ready']).count(),
        'total_dispensed': prescriptions_qs.filter(status='dispensed').count(),
        'generated_at': timezone.now().isoformat(),
        'role': 'pharmacist'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lab_report(request):
    """Report for lab technicians - tests performed"""
    today = timezone.now().date()
    hospital = _resolve_report_hospital(request)
    patients_qs = Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()
    
    return Response({
        'tests_completed_today': patients_qs.filter(status='lab_completed', updated_at__date=today).count(),
        'tests_pending': patients_qs.filter(status__in=['lab_requested', 'lab_in_progress']).count(),
        'total_tests': patients_qs.filter(status='lab_completed').count(),
        'generated_at': timezone.now().isoformat(),
        'role': 'lab_technician'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresProPlan])
def detailed_report(request):
    """Generate detailed reports by period"""
    start_date, end_date, filter_mode, date_error = _build_date_filters(request)
    if date_error:
        return Response({'error': date_error}, status=400)

    hospital = _resolve_report_hospital(request)
    patients_qs = Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()
    bills_qs = Bill.objects.filter(hospital=hospital) if hospital else Bill.objects.none()
    appointments_qs = Appointment.objects.filter(hospital=hospital) if hospital else Appointment.objects.none()

    # Patients
    total_patients = patients_qs.count()
    new_patients = patients_qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date).count()
    treated_patients = patients_qs.filter(status='treated', updated_at__date__gte=start_date, updated_at__date__lte=end_date).count()
    
    # Revenue
    bills = bills_qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
    total_bills = bills.count()
    paid_bills = bills.filter(status='paid').count()
    revenue = float(bills.filter(status='paid').aggregate(total=Sum('total_amount')).get('total') or 0)
    pending_amount = float(
        bills.exclude(status__in=['paid', 'cancelled'])
        .aggregate(total=Sum('balance'))
        .get('total')
        or 0
    )
    
    # Appointments
    total_appointments = appointments_qs.filter(appointment_date__gte=start_date, appointment_date__lte=end_date).count()
    completed_appointments = appointments_qs.filter(appointment_date__gte=start_date, appointment_date__lte=end_date, status='completed').count()
    
    # Gender distribution
    male = patients_qs.filter(gender='M').count()
    female = patients_qs.filter(gender='F').count()
    
    return Response({
        'period': filter_mode,
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'generated_at': timezone.now().isoformat(),
        'timezone': timezone.get_current_timezone_name(),
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
@permission_classes([IsAuthenticated, RequiresProPlan])
def reconciliation_report(request):
    """Reconciliation report for subscription payment and receipt delivery lifecycle."""
    hospital = _resolve_report_hospital(request)
    payments_qs = SubscriptionPayment.objects.select_related('hospital').filter(hospital=hospital) if hospital else SubscriptionPayment.objects.none()

    start_date, end_date, filter_mode, date_error = _build_date_filters(request)
    if date_error:
        return Response({'error': date_error}, status=400)

    payments_qs = payments_qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)

    status_counts = {
        row['status']: row['count']
        for row in payments_qs.values('status').annotate(count=Count('id'))
    }
    receipt_counts = {
        row['receipt_delivery_status']: row['count']
        for row in payments_qs.values('receipt_delivery_status').annotate(count=Count('id'))
    }

    paid_without_sent_receipt = payments_qs.filter(status='paid').exclude(receipt_delivery_status='sent').count()
    failed_receipts = payments_qs.filter(receipt_delivery_status='failed').count()
    stale_queued = payments_qs.filter(
        receipt_delivery_status='queued',
        receipt_last_attempt_at__lte=timezone.now() - timedelta(minutes=15),
    ).count()

    row_limit = int(request.query_params.get('limit', 500) or 500)
    row_limit = max(1, min(row_limit, 2000))
    rows_qs = payments_qs.order_by('-created_at')[:row_limit]
    rows = [
        {
            'payment_id': payment.id,
            'hospital_name': payment.hospital.name,
            'plan': payment.plan,
            'amount': float(payment.amount or 0),
            'status': payment.status,
            'receipt_delivery_status': payment.receipt_delivery_status,
            'transaction_id': payment.transaction_id,
            'created_at': payment.created_at,
            'payment_date': payment.payment_date,
            'receipt_last_attempt_at': payment.receipt_last_attempt_at,
            'receipt_sent_at': payment.receipt_sent_at,
            'receipt_last_error': payment.receipt_last_error,
        }
        for payment in rows_qs
    ]

    return Response(
        {
            'period': filter_mode,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'timezone': timezone.get_current_timezone_name(),
            'summary': {
                'total_payments': payments_qs.count(),
                'pending_count': status_counts.get('pending', 0),
                'paid_count': status_counts.get('paid', 0),
                'failed_count': status_counts.get('failed', 0),
                'refunded_count': status_counts.get('refunded', 0),
                'receipt_sent_count': receipt_counts.get('sent', 0),
                'receipt_failed_count': receipt_counts.get('failed', 0),
                'receipt_queued_count': receipt_counts.get('queued', 0),
                'paid_without_sent_receipt_count': paid_without_sent_receipt,
                'stale_queued_receipt_count': stale_queued,
                'failed_receipt_count': failed_receipts,
            },
            'rows': rows,
            'row_limit': row_limit,
            'row_count': len(rows),
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_charts(request):
    """Real data for dashboard charts"""
    today = timezone.now().date()
    hospital = _resolve_report_hospital(request)
    patients_qs = Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()
    bills_qs = Bill.objects.filter(hospital=hospital) if hospital else Bill.objects.none()
    
    # Monthly data (last 7 months)
    monthly_data = []
    for i in range(6, -1, -1):
        month_start = today.replace(day=1) - timedelta(days=i*30)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        month_name = month_start.strftime('%b')
        
        patients = patients_qs.filter(created_at__gte=month_start, created_at__lt=month_end).count()
        revenue = float(bills_qs.filter(
            created_at__gte=month_start, created_at__lt=month_end, status='paid'
        ).aggregate(total=Sum('total_amount')).get('total') or 0)
        
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
        
        consultations = patients_qs.filter(created_at__date=day).count()
        lab_tests = patients_qs.filter(
            status__in=['lab_requested', 'lab_in_progress', 'lab_completed'],
            updated_at__date=day
        ).count()
        pharmacy = bills_qs.filter(created_at__date=day).count()
        
        weekly_data.append({
            'day': day_name,
            'consultations': consultations,
            'lab': lab_tests,
            'pharmacy': pharmacy,
        })
    
    # Revenue distribution
    paid_bills_qs = bills_qs.filter(status='paid')
    consultation_rev = float(paid_bills_qs.aggregate(total=Sum('consultation_fee')).get('total') or 0)
    lab_rev = float(paid_bills_qs.aggregate(total=Sum('lab_fee')).get('total') or 0)
    medicine_rev = float(paid_bills_qs.aggregate(total=Sum('medicine_fee')).get('total') or 0)
    room_rev = float(paid_bills_qs.aggregate(total=Sum('room_fee')).get('total') or 0)
    
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
