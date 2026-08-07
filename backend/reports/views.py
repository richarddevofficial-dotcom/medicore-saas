from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from config.plan_permissions import RequiresProPlan
from patients.models import Patient
from billing.models import Bill, BillPayment
from billing.models import SubscriptionPayment
from billing.models import POSReceipt
from staff.models import StaffProfile
from pharmacy.models import Medicine
from pharmacy.models import Prescription
from config.role_permissions import IsHospitalAdmin
from appointments.models import Appointment
from laboratory.models import LabTest
from imaging.models import ImagingTest
from human_resources.models import (
    Attendance,
    Employee,
    LeaveRequest,
    ShiftAssignment,
)
from ipd.models import MedicationAdministration, NursingObservation
from ipd.models import Admission
from expenses.models import Expense
from django.utils import timezone
from django.db.models import Count, F, Sum, Q
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
    raise PermissionDenied('Your account is not assigned to a hospital.')


def _date_range_for_period(period, end_date):
    period = (period or 'daily').lower()
    if period == 'daily':
        return end_date, end_date
    if period == 'weekly':
        return end_date - timedelta(days=end_date.weekday()), end_date
    if period == 'monthly':
        return end_date.replace(day=1), end_date
    if period == 'quarterly':
        quarter_start_month = ((end_date.month - 1) // 3) * 3 + 1
        return end_date.replace(month=quarter_start_month, day=1), end_date
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


def _shift_hours(shift, attendance):
    if not shift:
        return 0.0, 0.0

    scheduled_start = datetime.combine(
        timezone.localdate(),
        shift.start_time,
    )
    scheduled_end = datetime.combine(
        timezone.localdate(),
        shift.end_time,
    )
    if scheduled_end <= scheduled_start:
        scheduled_end += timedelta(days=1)

    scheduled_hours = max(
        (scheduled_end - scheduled_start).total_seconds() / 3600
        - shift.break_minutes / 60,
        0,
    )

    if not attendance or not attendance.clock_in or not attendance.clock_out:
        return round(scheduled_hours, 2), 0.0

    worked_hours = max(
        (attendance.clock_out - attendance.clock_in).total_seconds() / 3600
        - shift.break_minutes / 60,
        0,
    )
    return round(scheduled_hours, 2), round(worked_hours, 2)


def _personal_role_metrics(profile, user, report_date):
    start_of_day = timezone.make_aware(
        datetime.combine(report_date, datetime.min.time()),
    )
    end_of_day = start_of_day + timedelta(days=1)

    if profile.role == 'doctor':
        appointments = Appointment.objects.filter(
            doctor=profile,
            appointment_date=report_date,
        )
        return {
            'appointments_completed': appointments.filter(status='completed').count(),
            'appointments_pending': appointments.exclude(
                status__in=['completed', 'cancelled', 'no_show'],
            ).count(),
            'prescriptions_issued': Prescription.objects.filter(
                doctor=profile,
                created_at__gte=start_of_day,
                created_at__lt=end_of_day,
            ).count(),
        }

    if profile.role == 'cashier':
        receipts = POSReceipt.objects.filter(
            created_by=user,
            created_at__gte=start_of_day,
            created_at__lt=end_of_day,
        )
        total = receipts.aggregate(total=Sum('total_amount'))['total'] or 0
        count = receipts.count()
        return {
            'transactions_processed': count,
            'amount_collected': float(total),
            'average_transaction_value': round(float(total) / count, 2) if count else 0,
        }

    if profile.role in {
        'accountant',
        'finance',
        'finance_manager',
    }:
        payments = BillPayment.objects.filter(
            hospital=profile.hospital,
            received_by=user,
            received_at__gte=start_of_day,
            received_at__lt=end_of_day,
        )
        total = payments.aggregate(total=Sum('amount'))['total'] or 0
        count = payments.count()
        return {
            'payments_recorded': count,
            'amount_collected': float(total),
            'average_payment_value': round(float(total) / count, 2) if count else 0,
        }

    if profile.role == 'receptionist':
        return {
            'patients_registered': Patient.objects.filter(
                registered_by=profile,
                created_at__gte=start_of_day,
                created_at__lt=end_of_day,
            ).count(),
            'appointments_booked': Appointment.objects.filter(
                booked_by=profile,
                created_at__gte=start_of_day,
                created_at__lt=end_of_day,
            ).count(),
        }

    if profile.role == 'lab_technician':
        tests = LabTest.objects.filter(
            performed_by=profile,
            completed_at__gte=start_of_day,
            completed_at__lt=end_of_day,
        )
        return {
            'tests_completed': tests.count(),
            'lab_revenue_processed': float(
                tests.aggregate(total=Sum('price'))['total'] or 0,
            ),
        }

    if profile.role == 'radiographer':
        tests = ImagingTest.objects.filter(
            hospital=profile.hospital,
            completed_by=profile,
            completed_at__gte=start_of_day,
            completed_at__lt=end_of_day,
        )
        return {
            'imaging_tests_completed': tests.count(),
            'imaging_revenue_processed': float(
                tests.aggregate(total=Sum('price'))['total'] or 0,
            ),
        }

    if profile.role == 'pharmacist':
        prescriptions = Prescription.objects.filter(
            hospital=profile.hospital,
            dispensed_by=profile,
            dispensed_at__gte=start_of_day,
            dispensed_at__lt=end_of_day,
        )
        return {
            'prescriptions_dispensed': prescriptions.count(),
            'fully_dispensed': prescriptions.filter(status='dispensed').count(),
            'partially_dispensed': prescriptions.filter(status='partial').count(),
        }

    if profile.role == 'nurse':
        observations = NursingObservation.objects.filter(
            recorded_by=profile,
            observed_at__gte=start_of_day,
            observed_at__lt=end_of_day,
        )
        administrations = MedicationAdministration.objects.filter(
            administered_by=profile,
            administered_at__gte=start_of_day,
            administered_at__lt=end_of_day,
        )
        return {
            'observations_recorded': observations.count(),
            'medications_administered': administrations.filter(
                was_refused=False,
            ).count(),
            'medications_refused': administrations.filter(
                was_refused=True,
            ).count(),
        }

    if profile.role in {'hr', 'hr_officer', 'hr_manager'}:
        leave_reviews = LeaveRequest.objects.filter(
            employee__hospital=profile.hospital,
            reviewed_by=user,
            reviewed_at__gte=start_of_day,
            reviewed_at__lt=end_of_day,
        )
        return {
            'leave_requests_reviewed': leave_reviews.count(),
            'leave_requests_approved': leave_reviews.filter(
                status='APPROVED',
            ).count(),
            'leave_requests_rejected': leave_reviews.filter(
                status='REJECTED',
            ).count(),
        }

    return {'actions_recorded': 0}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def personal_shift_report(request):
    profile = StaffProfile.objects.filter(
        user=request.user,
        is_active=True,
    ).select_related('hospital', 'user').first()

    if not profile:
        raise PermissionDenied('Your account is not assigned to active staff.')

    report_date = timezone.localdate()
    employee = Employee.objects.filter(
        user=request.user,
        hospital=profile.hospital,
    ).first()
    assignment = None
    attendance = None

    if employee:
        assignment = ShiftAssignment.objects.filter(
            employee=employee,
            is_active=True,
            start_date__lte=report_date,
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=report_date),
        ).select_related('shift').order_by('-start_date').first()
        attendance = Attendance.objects.filter(
            employee=employee,
            attendance_date=report_date,
        ).select_related('shift').first()

    shift = attendance.shift if attendance and attendance.shift else (
        assignment.shift if assignment else None
    )
    scheduled_hours, worked_hours = _shift_hours(shift, attendance)

    return Response({
        'staff_name': profile.user.get_full_name() or profile.user.username,
        'role': profile.role,
        'report_date': report_date.isoformat(),
        'shift': shift.name if shift else 'No active shift assignment',
        'attendance_status': attendance.status if attendance else 'NOT_RECORDED',
        'clock_in': attendance.clock_in.isoformat() if attendance and attendance.clock_in else None,
        'clock_out': attendance.clock_out.isoformat() if attendance and attendance.clock_out else None,
        'scheduled_hours': scheduled_hours,
        'hours_worked': worked_hours,
        **_personal_role_metrics(profile, request.user, report_date),
        'generated_at': timezone.now().isoformat(),
    })

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
@permission_classes([IsAuthenticated, RequiresProPlan, IsHospitalAdmin])
def detailed_report(request):
    """Generate detailed reports by period"""
    start_date, end_date, filter_mode, date_error = _build_date_filters(request)
    if date_error:
        return Response({'error': date_error}, status=400)

    hospital = _resolve_report_hospital(request)
    patients_qs = Patient.objects.filter(hospital=hospital) if hospital else Patient.objects.none()
    bills_qs = Bill.objects.filter(hospital=hospital) if hospital else Bill.objects.none()
    appointments_qs = Appointment.objects.filter(hospital=hospital) if hospital else Appointment.objects.none()
    lab_tests_qs = LabTest.objects.filter(hospital=hospital) if hospital else LabTest.objects.none()
    imaging_tests_qs = ImagingTest.objects.filter(hospital=hospital) if hospital else ImagingTest.objects.none()
    medicines_qs = Medicine.objects.filter(hospital=hospital) if hospital else Medicine.objects.none()
    admissions_qs = Admission.objects.filter(hospital=hospital) if hospital else Admission.objects.none()
    expenses_qs = Expense.objects.filter(hospital=hospital) if hospital else Expense.objects.none()

    # Patients
    total_patients = patients_qs.count()
    new_patients = patients_qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date).count()
    treated_patients = patients_qs.filter(status='treated', updated_at__date__gte=start_date, updated_at__date__lte=end_date).count()
    
    # Revenue
    bills = bills_qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
    payments = BillPayment.objects.filter(
        hospital=hospital,
        received_at__date__gte=start_date,
        received_at__date__lte=end_date,
    ) if hospital else BillPayment.objects.none()
    total_bills = bills.count()
    paid_bills = payments.values('bill_id').distinct().count()
    revenue = float(payments.aggregate(total=Sum('amount')).get('total') or 0)
    pending_amount = float(
        bills.exclude(status__in=['paid', 'cancelled'])
        .aggregate(total=Sum('balance'))
        .get('total')
        or 0
    )
    
    # Appointments
    total_appointments = appointments_qs.filter(appointment_date__gte=start_date, appointment_date__lte=end_date).count()
    completed_appointments = appointments_qs.filter(appointment_date__gte=start_date, appointment_date__lte=end_date, status='completed').count()

    # Clinical services and operational controls
    completed_lab_tests = lab_tests_qs.filter(
        status='completed',
        completed_at__date__gte=start_date,
        completed_at__date__lte=end_date,
    )
    completed_imaging_tests = imaging_tests_qs.filter(
        status='completed',
        completed_at__date__gte=start_date,
        completed_at__date__lte=end_date,
    )
    period_expenses = expenses_qs.filter(
        expense_date__gte=start_date,
        expense_date__lte=end_date,
        status__in=['approved', 'paid'],
    )
    
    # Gender distribution
    gender_patients = patients_qs.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    male = gender_patients.filter(gender='M').count()
    female = gender_patients.filter(gender='F').count()
    
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
        'ipd': {
            'active_admissions': admissions_qs.filter(
                status__in=[
                    Admission.STATUS_ADMITTED,
                    Admission.STATUS_TRANSFERRED,
                ],
            ).count(),
            'admissions': admissions_qs.filter(
                admitted_at__date__gte=start_date,
                admitted_at__date__lte=end_date,
            ).count(),
            'discharges': admissions_qs.filter(
                discharged_at__date__gte=start_date,
                discharged_at__date__lte=end_date,
            ).count(),
        },
        'laboratory': {
            'completed': completed_lab_tests.count(),
            'pending': lab_tests_qs.filter(
                status__in=['requested', 'in_progress'],
            ).count(),
            'revenue': float(
                completed_lab_tests.aggregate(total=Sum('price')).get('total') or 0,
            ),
        },
        'imaging': {
            'completed': completed_imaging_tests.count(),
            'pending': imaging_tests_qs.filter(
                status__in=['requested', 'scheduled', 'in_progress'],
            ).count(),
            'revenue': float(
                completed_imaging_tests.aggregate(total=Sum('price')).get('total') or 0,
            ),
        },
        'pharmacy': {
            'medicines': medicines_qs.filter(is_active=True).count(),
            'low_stock': medicines_qs.filter(
                is_active=True,
                quantity__lte=F('reorder_level'),
            ).count(),
            'stock_value': float(
                medicines_qs.aggregate(
                    total=Sum(F('quantity') * F('cost_price')),
                ).get('total') or 0,
            ),
        },
        'expenses': {
            'approved_or_paid': float(
                period_expenses.aggregate(total=Sum('amount')).get('total') or 0,
            ),
            'pending_approval': expenses_qs.filter(status='submitted').count(),
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresProPlan, IsHospitalAdmin])
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
    appointments_qs = Appointment.objects.filter(hospital=hospital) if hospital else Appointment.objects.none()
    lab_tests_qs = LabTest.objects.filter(hospital=hospital) if hospital else LabTest.objects.none()
    prescriptions_qs = Prescription.objects.filter(hospital=hospital) if hospital else Prescription.objects.none()
    
    # Monthly data (last 7 months)
    monthly_data = []
    current_month_start = today.replace(day=1)
    for offset in range(6, -1, -1):
        year = current_month_start.year
        month = current_month_start.month - offset
        while month <= 0:
            month += 12
            year -= 1
        month_start = current_month_start.replace(year=year, month=month)
        if month == 12:
            month_end = month_start.replace(year=year + 1, month=1)
        else:
            month_end = month_start.replace(month=month + 1)
        month_name = month_start.strftime('%b')
        
        patients = patients_qs.filter(created_at__gte=month_start, created_at__lt=month_end).count()
        revenue = float(bills_qs.filter(
            payment_date__gte=month_start, payment_date__lt=month_end, status='paid'
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
        
        consultations = appointments_qs.filter(
            appointment_date=day,
            status='completed',
        ).count()
        lab_tests = lab_tests_qs.filter(created_at__date=day).count()
        pharmacy = prescriptions_qs.filter(dispensed_at__date=day).count()
        
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
