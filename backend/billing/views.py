from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum
from django.contrib.auth.models import User
from django.core.mail import EmailMessage
from django.conf import settings
from django.db import transaction
from decimal import Decimal
from calendar import monthrange
from .receipt_queue import enqueue_receipt_email_job
from auditlog.models import AuditLog, NotificationEvent
from .models import Bill
from .serializers import BillSerializer
from .models import Bill, SubscriptionPayment, ServiceCatalog, POSReceipt
from .serializers import (
    BillSerializer,
    SubscriptionPaymentSerializer,
    ServiceCatalogSerializer,
    POSReceiptSerializer,
)
from pharmacy.models import Medicine, StockMovement


def _sync_patient_prescription_payment_status(bill):
    if not bill.patient_mrn:
        return

    from patients.models import Patient
    from pharmacy.models import Prescription

    patient = Patient.objects.filter(
        hospital=bill.hospital,
        mrn=bill.patient_mrn,
    ).first()
    if not patient:
        return

    paid = Decimal(str(bill.amount_paid or 0))
    consultation_fee = Decimal(str(bill.consultation_fee or 0))
    lab_fee = Decimal(str(bill.lab_fee or 0))
    medicine_fee = Decimal(str(bill.medicine_fee or 0))

    if medicine_fee <= 0:
        return

    required_for_medicine = consultation_fee + lab_fee + medicine_fee
    if paid >= required_for_medicine:
        Prescription.objects.filter(
            hospital=bill.hospital,
            patient=patient,
            status='pending',
        ).update(status='ready')


def _add_months(start_date, months):
    target_month_index = (start_date.month - 1) + months
    year = start_date.year + (target_month_index // 12)
    month = (target_month_index % 12) + 1
    day = min(start_date.day, monthrange(year, month)[1])
    return start_date.replace(year=year, month=month, day=day)


def _pdf_escape(value):
    return str(value).replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _build_pdf_with_stream(stream_bytes):
    objects = []
    objects.append(b'1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
    objects.append(b'2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
    objects.append(
        b'3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
        b'/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n'
    )
    objects.append(b'4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')
    objects.append(b'5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n')
    objects.append(
        (
            f'6 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n'.encode('ascii')
            + stream_bytes
            + b'\nendstream\nendobj\n'
        )
    )

    pdf = bytearray()
    pdf.extend(b'%PDF-1.4\n')

    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_offset = len(pdf)
    pdf.extend(f'xref\n0 {len(objects) + 1}\n'.encode('ascii'))
    pdf.extend(b'0000000000 65535 f \n')
    for offset in offsets[1:]:
        pdf.extend(f'{offset:010d} 00000 n \n'.encode('ascii'))

    trailer = (
        f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n'
        f'startxref\n{xref_offset}\n%%EOF\n'
    )
    pdf.extend(trailer.encode('ascii'))
    return bytes(pdf)


def _build_subscription_receipt_pdf(payment):
    hospital = payment.hospital
    amount = Decimal(payment.amount or 0)
    paid_on = payment.payment_date or timezone.now()
    receipt_id = f'SUB-{payment.id:06d}'
    paid_on_text = f'{paid_on:%Y-%m-%d %H:%M:%S}'
    subscription_start_text = str(payment.subscription_start or '-')
    subscription_end_text = str(payment.subscription_end or '-')
    billing_cycle_text = f'{payment.billing_cycle_months} month(s)'
    amount_text = f'{payment.currency} {amount:.2f}'

    def text_cmd(x, y, text, font='F1', size=11, rgb=(0.17, 0.18, 0.20)):
        r, g, b = rgb
        return (
            f'{r:.2f} {g:.2f} {b:.2f} rg '
            f'BT /{font} {size} Tf 1 0 0 1 {x} {y} Tm ({_pdf_escape(text)}) Tj ET'
        )

    commands = [
        # Background
        '0.97 0.97 0.97 rg 0 0 595 842 re f',
        # Top brand bar
        '0.07 0.16 0.30 rg 0 760 595 82 re f',
        # Receipt card
        '1 1 1 rg 32 108 531 632 re f',
        '0.22 0.24 0.27 RG 1 w 32 108 531 632 re S',
        # Amount highlight panel
        '1.00 0.95 0.90 rg 380 662 160 56 re f',
        '0.95 0.55 0.15 RG 1.2 w 380 662 160 56 re S',
        # Details section panel
        '0.99 0.99 0.99 rg 50 256 495 332 re f',
        '0.84 0.85 0.87 RG 1 w 50 256 495 332 re S',
        # Signature/footer accent line
        '0.95 0.55 0.15 RG 1.4 w 50 188 m 545 188 l S',
        # Header text
        text_cmd(50, 804, 'MediCore', 'F2', 22, (1.0, 1.0, 1.0)),
        text_cmd(50, 783, 'Subscription Payment Receipt', 'F1', 12, (1.0, 1.0, 1.0)),
        text_cmd(50, 764, 'Professional billing confirmation', 'F1', 10, (0.96, 0.96, 0.96)),
        # Receipt meta
        text_cmd(50, 712, 'Receipt ID', 'F1', 10, (0.17, 0.18, 0.20)),
        text_cmd(50, 694, receipt_id, 'F2', 13, (0.07, 0.16, 0.30)),
        text_cmd(50, 668, 'Issued On', 'F1', 10, (0.17, 0.18, 0.20)),
        text_cmd(50, 650, paid_on_text, 'F2', 11, (0.07, 0.16, 0.30)),
        # Amount block
        text_cmd(395, 702, 'Total Paid', 'F1', 10, (0.30, 0.30, 0.30)),
        text_cmd(395, 680, amount_text, 'F2', 16, (0.86, 0.40, 0.08)),
        # Details labels and values
        text_cmd(64, 566, 'Hospital', 'F1', 10, (0.30, 0.30, 0.30)),
        text_cmd(200, 566, hospital.name, 'F2', 11, (0.17, 0.18, 0.20)),
        text_cmd(64, 536, 'Hospital Email', 'F1', 10, (0.30, 0.30, 0.30)),
        text_cmd(200, 536, hospital.email or '-', 'F2', 11, (0.17, 0.18, 0.20)),
        text_cmd(64, 506, 'Subscription Plan', 'F1', 10, (0.30, 0.30, 0.30)),
        text_cmd(200, 506, payment.plan.upper(), 'F2', 11, (0.17, 0.18, 0.20)),
        text_cmd(64, 476, 'Billing Cycle', 'F1', 10, (0.30, 0.30, 0.30)),
        text_cmd(200, 476, billing_cycle_text, 'F2', 11, (0.17, 0.18, 0.20)),
        text_cmd(64, 446, 'Payment Method', 'F1', 10, (0.30, 0.30, 0.30)),
        text_cmd(200, 446, payment.payment_method or '-', 'F2', 11, (0.17, 0.18, 0.20)),
        text_cmd(64, 416, 'Transaction ID', 'F1', 10, (0.30, 0.30, 0.30)),
        text_cmd(200, 416, payment.transaction_id or '-', 'F2', 11, (0.17, 0.18, 0.20)),
        text_cmd(64, 386, 'Subscription Start', 'F1', 10, (0.30, 0.30, 0.30)),
        text_cmd(200, 386, subscription_start_text, 'F2', 11, (0.17, 0.18, 0.20)),
        text_cmd(64, 356, 'Subscription End', 'F1', 10, (0.30, 0.30, 0.30)),
        text_cmd(200, 356, subscription_end_text, 'F2', 11, (0.17, 0.18, 0.20)),
        # Footer notes
        text_cmd(50, 228, 'Thank you for choosing MediCore.', 'F2', 11, (0.07, 0.16, 0.30)),
        text_cmd(50, 210, 'This receipt confirms successful payment approval and subscription activation.', 'F1', 9, (0.30, 0.30, 0.30)),
        text_cmd(50, 168, 'Generated electronically by MediCore Billing System', 'F1', 9, (0.30, 0.30, 0.30)),
    ]

    stream_text = '\n'.join(commands)
    stream_bytes = stream_text.encode('latin-1', errors='replace')
    return _build_pdf_with_stream(stream_bytes)


def _record_notification_event(
    notification_type,
    recipient,
    subject,
    status,
    attempts=1,
    error_message='',
    reference='',
):
    try:
        NotificationEvent.objects.create(
            notification_type=notification_type,
            channel='email',
            recipient=recipient,
            subject=subject,
            status=status,
            attempts=attempts,
            error_message=error_message,
            reference=reference,
        )
    except Exception:
        return


def _send_subscription_receipt(payment):
    hospital = payment.hospital
    if not hospital.email:
        return False

    amount = Decimal(payment.amount or 0)
    paid_on = payment.payment_date or timezone.now()
    receipt_id = f"SUB-{payment.id:06d}"
    subject = f"Subscription Payment Receipt - {hospital.name}"
    message = (
        f"Hello {hospital.name},\n\n"
        f"Your subscription payment has been approved successfully.\n\n"
        f"Receipt ID: {receipt_id}\n"
        f"Plan: {payment.plan.upper()}\n"
        f"Billing Cycle: {payment.billing_cycle_months} month(s)\n"
        f"Amount: {payment.currency} {amount:.2f}\n"
        f"Payment Method: {payment.payment_method or '-'}\n"
        f"Transaction ID: {payment.transaction_id or '-'}\n"
        f"Paid On: {paid_on:%Y-%m-%d %H:%M:%S}\n"
        f"Subscription Start: {payment.subscription_start or '-'}\n"
        f"Subscription End: {payment.subscription_end or '-'}\n\n"
        "Thank you for choosing MediCore.\n"
    )

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@medicore.local')
    email = EmailMessage(
        subject=subject,
        body=message,
        from_email=from_email,
        to=[hospital.email],
    )

    receipt_filename = f'subscription-receipt-{receipt_id}.pdf'
    receipt_pdf = _build_subscription_receipt_pdf(payment)
    email.attach(receipt_filename, receipt_pdf, 'application/pdf')
    max_attempts = 3
    attempts = 0
    last_error = ''
    for _idx in range(max_attempts):
        attempts += 1
        try:
            email.send(fail_silently=False)
            _record_notification_event(
                notification_type='receipt',
                recipient=hospital.email,
                subject=subject,
                status='sent',
                attempts=attempts,
                reference=f'payment:{payment.id}',
            )
            return True
        except Exception as exc:
            last_error = str(exc)

    _record_notification_event(
        notification_type='receipt',
        recipient=hospital.email,
        subject=subject,
        status='failed',
        attempts=attempts,
        error_message=last_error,
        reference=f'payment:{payment.id}',
    )
    raise RuntimeError(last_error or 'Failed to send receipt email')


def _queue_subscription_receipt(payment):
    job, _created = enqueue_receipt_email_job(payment)
    return job


class ServiceCatalogViewSet(viewsets.ModelViewSet):
    queryset = ServiceCatalog.objects.all()
    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'service_type']
    ordering = ['service_type', 'name']

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            hospital_id = self.request.query_params.get('hospital_id')
            queryset = ServiceCatalog.objects.all()
            if hospital_id:
                queryset = queryset.filter(hospital_id=hospital_id)
            return queryset

        if hasattr(user, 'staff_profile'):
            return ServiceCatalog.objects.filter(hospital=user.staff_profile.hospital)

        return ServiceCatalog.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_superuser:
            hospital_id = self.request.data.get('hospital_id')
            if not hospital_id:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'hospital_id': 'hospital_id is required for superuser'})
            from hospitals.models import Hospital
            try:
                hospital = Hospital.objects.get(id=hospital_id)
            except Hospital.DoesNotExist:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'hospital_id': 'Hospital not found'})
        elif hasattr(user, 'staff_profile'):
            hospital = user.staff_profile.hospital
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'error': 'User has no staff profile'})

        serializer.save(hospital=hospital)

    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        rows = request.data.get('services')
        if not isinstance(rows, list):
            return Response({'error': 'services must be a list of row objects'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if user.is_superuser:
            hospital_id = request.data.get('hospital_id')
            if not hospital_id:
                return Response({'error': 'hospital_id is required for superuser'}, status=status.HTTP_400_BAD_REQUEST)
            from hospitals.models import Hospital
            hospital = Hospital.objects.filter(id=hospital_id).first()
            if not hospital:
                return Response({'error': 'Hospital not found'}, status=status.HTTP_404_NOT_FOUND)
        elif hasattr(user, 'staff_profile'):
            hospital = user.staff_profile.hospital
        else:
            return Response({'error': 'User has no staff profile'}, status=status.HTTP_403_FORBIDDEN)

        valid_types = {choice[0] for choice in ServiceCatalog.SERVICE_TYPES}
        created = 0
        updated = 0
        skipped = 0
        errors = []

        for idx, row in enumerate(rows, start=1):
            if not isinstance(row, dict):
                skipped += 1
                errors.append({'row': idx, 'error': 'Each row must be an object'})
                continue

            name = str(row.get('name', '')).strip()
            if not name:
                skipped += 1
                errors.append({'row': idx, 'error': 'name is required'})
                continue

            service_type = str(row.get('service_type', 'other')).strip().lower() or 'other'
            if service_type not in valid_types:
                service_type = 'other'

            code = str(row.get('code', '')).strip()
            notes = str(row.get('notes', '')).strip()
            is_active = bool(row.get('is_active', True))

            try:
                price = Decimal(str(row.get('price', 0) or 0))
            except Exception:
                price = Decimal('0')

            service = ServiceCatalog.objects.filter(hospital=hospital, name__iexact=name).first()
            if service:
                service.service_type = service_type
                service.code = code
                service.price = price
                service.is_active = is_active
                service.notes = notes
                service.save()
                updated += 1
            else:
                ServiceCatalog.objects.create(
                    hospital=hospital,
                    name=name,
                    service_type=service_type,
                    code=code,
                    price=price,
                    is_active=is_active,
                    notes=notes,
                )
                created += 1

        response_status = status.HTTP_200_OK if not errors else status.HTTP_207_MULTI_STATUS
        return Response(
            {
                'created': created,
                'updated': updated,
                'skipped': skipped,
                'errors': errors,
            },
            status=response_status,
        )

class BillViewSet(viewsets.ModelViewSet):
    queryset = Bill.objects.all()
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['bill_number', 'patient_name', 'status']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            hospital_id = self.request.query_params.get('hospital_id')
            queryset = Bill.objects.all()
            if hospital_id:
                queryset = queryset.filter(hospital_id=hospital_id)
            return queryset

        if hasattr(user, 'staff_profile'):
            hospital = user.staff_profile.hospital
            return Bill.objects.filter(hospital=hospital)

        return Bill.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        if user.is_superuser:
            hospital_id = self.request.data.get('hospital_id')
            if not hospital_id:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'hospital_id': 'hospital_id is required for superuser'})
            from hospitals.models import Hospital
            try:
                hospital = Hospital.objects.get(id=hospital_id)
            except Hospital.DoesNotExist:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'hospital_id': 'Hospital not found'})
        elif hasattr(user, 'staff_profile'):
            hospital = user.staff_profile.hospital
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'error': 'User has no staff profile'})
        serializer.save(hospital=hospital)
    
    @action(detail=True, methods=['post'])
    def make_payment(self, request, pk=None):
        bill = self.get_object()
        amount = Decimal(str(request.data.get('amount', 0)))
        if amount <= 0:
            return Response({'error': 'Invalid amount'}, status=400)

        total_amount = Decimal(str(bill.total_amount or 0))
        current_paid = Decimal(str(bill.amount_paid or 0))

        # Keep legacy overpaid bills safe and prevent any further payments.
        if current_paid >= total_amount:
            bill.amount_paid = total_amount
            bill.status = 'paid'
            bill.save(update_fields=['amount_paid', 'status', 'updated_at'])
            return Response(
                {
                    'error': 'Bill is already fully paid.',
                    'remaining_balance': '0.00',
                },
                status=400,
            )

        remaining_balance = total_amount - current_paid
        if amount > remaining_balance:
            return Response(
                {
                    'error': 'Payment exceeds remaining balance.',
                    'remaining_balance': str(remaining_balance),
                },
                status=400,
            )

        bill.amount_paid = current_paid + amount
        bill.payment_date = timezone.now().date()
        if bill.amount_paid >= total_amount:
            bill.status = 'paid'
        elif bill.amount_paid > 0:
            bill.status = 'partial'
        bill.save()
        _sync_patient_prescription_payment_status(bill)
        return Response(BillSerializer(bill).data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        try:
            hospital = request.user.staff_profile.hospital
        except Exception:
            hospital = None

        bills = Bill.objects.filter(hospital=hospital) if hospital else Bill.objects.none()
        today = timezone.now().date()
        total = bills.count()
        paid = bills.filter(status='paid').count()
        revenue = sum(float(b.total_amount or 0) for b in bills.filter(status='paid'))
        paid_today = bills.filter(status='paid', payment_date=today)
        revenue_today = sum(float(b.total_amount or 0) for b in paid_today)
        collected_today = float(
            bills.filter(payment_date=today).aggregate(total=Sum('amount_paid')).get('total')
            or 0
        )

        return Response(
            {
                'total_bills': total,
                'paid': paid,
                'revenue': revenue,
                'revenue_today': revenue_today,
                'collected_today': collected_today,
                'paid_today': paid_today.count(),
            }
        )


class POSReceiptViewSet(viewsets.ModelViewSet):
    queryset = POSReceipt.objects.select_related('hospital', 'medicine', 'created_by').all()
    serializer_class = POSReceiptSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['receipt_number', 'customer_name', 'medicine_name_snapshot']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            hospital_id = self.request.query_params.get('hospital_id')
            queryset = self.queryset
            if hospital_id:
                queryset = queryset.filter(hospital_id=hospital_id)
            return queryset

        if hasattr(user, 'staff_profile'):
            return self.queryset.filter(hospital=user.staff_profile.hospital)

        return POSReceipt.objects.none()

    def create(self, request, *args, **kwargs):
        user = request.user
        if user.is_superuser:
            hospital_id = request.data.get('hospital_id')
            if not hospital_id:
                return Response({'error': 'hospital_id is required for superuser'}, status=400)
            from hospitals.models import Hospital
            hospital = Hospital.objects.filter(id=hospital_id).first()
            if not hospital:
                return Response({'error': 'Hospital not found'}, status=404)
        elif hasattr(user, 'staff_profile'):
            hospital = user.staff_profile.hospital
        else:
            return Response({'error': 'User has no staff profile'}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        medicine_id = serializer.validated_data.get('medicine_id')
        quantity = serializer.validated_data.get('quantity')
        unit_price = serializer.validated_data.get('unit_price')
        customer_name = serializer.validated_data.get('customer_name')
        payment_method = serializer.validated_data.get('payment_method')
        notes = serializer.validated_data.get('notes', '')

        medicine = Medicine.objects.filter(id=medicine_id, hospital=hospital).first()
        if not medicine:
            return Response({'error': 'Medicine not found for this hospital'}, status=404)

        if quantity > (medicine.quantity or 0):
            return Response({'error': 'Not enough stock for this sale'}, status=400)

        staff_name = ''
        if hasattr(user, 'staff_profile'):
            staff_name = f"{user.first_name} {user.last_name}".strip() or user.email or user.username

        with transaction.atomic():
            medicine.quantity = (medicine.quantity or 0) - quantity
            medicine.save(update_fields=['quantity', 'updated_at'])

            StockMovement.objects.create(
                hospital=hospital,
                medicine=medicine,
                movement_type='out',
                quantity=quantity,
                reference='POS Sale',
                notes=f'POS receipt sale to {customer_name or "Walk-in Customer"}',
                created_by=staff_name or 'System',
            )

            receipt = POSReceipt.objects.create(
                hospital=hospital,
                customer_name=customer_name,
                medicine=medicine,
                quantity=quantity,
                unit_price=unit_price,
                payment_method=payment_method,
                cashier_name=staff_name or 'Pharmacy POS',
                created_by=user,
                notes=notes,
            )

        response_data = POSReceiptSerializer(receipt).data
        response_data['remaining_stock'] = medicine.quantity
        return Response(response_data, status=status.HTTP_201_CREATED)
    
    

class SubscriptionPaymentViewSet(viewsets.ModelViewSet):
    queryset = SubscriptionPayment.objects.all()
    serializer_class = SubscriptionPaymentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = SubscriptionPayment.objects.select_related('hospital').all()

        if user.is_superuser:
            hospital_id = self.request.query_params.get('hospital_id')
            payment_status = self.request.query_params.get('status')
            if hospital_id:
                queryset = queryset.filter(hospital_id=hospital_id)
            if payment_status:
                queryset = queryset.filter(status=payment_status)
            return queryset

        if hasattr(user, 'staff_profile'):
            hospital = user.staff_profile.hospital
            return queryset.filter(hospital=hospital)

        return SubscriptionPayment.objects.none()
    
    def _resolve_hospital_for_create(self, request):
        user = request.user
        if user.is_superuser:
            hospital_id = request.data.get('hospital_id')
            if not hospital_id:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'hospital_id': 'hospital_id is required for superuser'})
            from hospitals.models import Hospital
            try:
                return Hospital.objects.get(id=hospital_id)
            except Hospital.DoesNotExist:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'hospital_id': 'Hospital not found'})

        if hasattr(user, 'staff_profile'):
            return user.staff_profile.hospital

        from rest_framework.exceptions import ValidationError
        raise ValidationError({'error': 'User has no staff profile'})

    def create(self, request, *args, **kwargs):
        hospital = self._resolve_hospital_for_create(request)

        raw_idempotency_key = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key')
        idempotency_key = (raw_idempotency_key or '').strip()

        if idempotency_key:
            existing_by_idempotency = SubscriptionPayment.objects.filter(
                hospital=hospital,
                idempotency_key=idempotency_key,
            ).first()
            if existing_by_idempotency:
                response_payload = self.get_serializer(existing_by_idempotency).data
                response_payload['idempotent_replay'] = True
                return Response(response_payload, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transaction_id = (serializer.validated_data.get('transaction_id') or '').strip()
        if transaction_id:
            duplicate_tx_exists = SubscriptionPayment.objects.filter(
                hospital=hospital,
                transaction_id=transaction_id,
                status__in=['pending', 'paid'],
            ).exists()
            if duplicate_tx_exists:
                return Response(
                    {'error': 'A payment with this transaction_id already exists for this hospital.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        payment = serializer.save(
            hospital=hospital,
            idempotency_key=idempotency_key,
        )
        response_payload = self.get_serializer(payment).data
        headers = self.get_success_headers(response_payload)
        return Response(response_payload, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get'])
    def comprehensive_report(self, request):
        if not request.user.is_superuser:
            return Response({'error': 'Only super admin can access this report'}, status=403)

        queryset = SubscriptionPayment.objects.select_related('hospital').all()
        rows = [
            {
                'receipt_id': f"SUB-{payment.id:06d}",
                'hospital_name': payment.hospital.name,
                'hospital_email': payment.hospital.email,
                'plan': payment.plan,
                'amount': float(payment.amount or 0),
                'currency': payment.currency,
                'status': payment.status,
                'payment_method': payment.payment_method,
                'transaction_id': payment.transaction_id,
                'billing_cycle_months': payment.billing_cycle_months,
                'payment_date': payment.payment_date,
                'subscription_start': payment.subscription_start,
                'subscription_end': payment.subscription_end,
                'receipt_delivery_status': payment.receipt_delivery_status,
                'receipt_last_attempt_at': payment.receipt_last_attempt_at,
                'receipt_sent_at': payment.receipt_sent_at,
                'receipt_last_error': payment.receipt_last_error,
                'created_at': payment.created_at,
            }
            for payment in queryset
        ]

        summary = {
            'total_payments': queryset.count(),
            'total_collected_usd': float(
                queryset.filter(status='paid').aggregate(total=Sum('amount')).get('total') or 0
            ),
            'pending_count': queryset.filter(status='pending').count(),
            'failed_count': queryset.filter(status='failed').count(),
            'refunded_count': queryset.filter(status='refunded').count(),
        }

        return Response({
            'generated_at': timezone.now(),
            'summary': summary,
            'rows': rows,
        })

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        if not request.user.is_superuser:
            return Response({'error': 'Only super admin can review payments'}, status=403)

        payment = self.get_object()
        next_status = request.data.get('status')
        review_note = str(request.data.get('review_note', '')).strip()
        if next_status not in ['pending', 'paid', 'failed', 'refunded']:
            return Response({'error': 'Invalid status'}, status=400)

        if next_status in ['paid', 'failed', 'refunded'] and len(review_note) < 5:
            return Response(
                {'error': 'review_note is required and must be at least 5 characters for this status change.'},
                status=400,
            )

        payment.status = next_status
        receipt_email_sent = False
        receipt_email_error = ''
        if next_status == 'paid':
            hospital = payment.hospital
            if not hospital.email:
                return Response(
                    {'error': 'Hospital email is not configured. Cannot approve payment without sending receipt.'},
                    status=400,
                )

            try:
                with transaction.atomic():
                    cycle_months = payment.billing_cycle_months or 1
                    subscription_start = timezone.now().date()
                    payment.payment_date = timezone.now()
                    payment.subscription_start = subscription_start
                    payment.subscription_end = _add_months(subscription_start, cycle_months)
                    payment.receipt_last_attempt_at = timezone.now()
                    payment.receipt_last_error = ''
                    payment.receipt_sent_at = None
                    payment.receipt_delivery_status = 'not_sent'

                    hospital.subscription_plan = payment.plan
                    hospital.subscription_status = 'active'
                    hospital.is_active = True
                    hospital.save(update_fields=['subscription_plan', 'subscription_status', 'is_active'])

                    staff_user_ids = hospital.staff.exclude(user__is_superuser=True).values_list('user_id', flat=True)
                    User.objects.filter(id__in=staff_user_ids).update(is_active=True)

                    payment.save()

                    receipt_email_sent = _send_subscription_receipt(payment)
                    if not receipt_email_sent:
                        raise ValueError('Receipt email could not be sent')

                    payment.receipt_delivery_status = 'sent'
                    payment.receipt_sent_at = timezone.now()
                    payment.receipt_last_error = ''
                    payment.save(
                        update_fields=['receipt_delivery_status', 'receipt_sent_at', 'receipt_last_error']
                    )
            except Exception as exc:
                receipt_email_error = str(exc)
                SubscriptionPayment.objects.filter(id=payment.id).update(
                    receipt_delivery_status='failed',
                    receipt_last_attempt_at=timezone.now(),
                    receipt_sent_at=None,
                    receipt_last_error=receipt_email_error,
                )
                return Response(
                    {'error': f'Payment approval aborted because receipt email failed: {receipt_email_error}'},
                    status=500,
                )
        elif next_status in ['failed', 'refunded']:
            hospital = payment.hospital
            hospital.subscription_status = 'inactive'
            hospital.is_active = False
            hospital.save(update_fields=['subscription_status', 'is_active'])

            staff_user_ids = hospital.staff.exclude(user__is_superuser=True).values_list('user_id', flat=True)
            User.objects.filter(id__in=staff_user_ids).update(is_active=False)

        if next_status != 'paid':
            payment.save()

        if review_note:
            note_line = (
                f"[{timezone.now():%Y-%m-%d %H:%M:%S}] "
                f"{request.user.email or request.user.username} set status to {next_status}: {review_note}"
            )
            payment.notes = f"{payment.notes}\n{note_line}".strip() if payment.notes else note_line
            payment.save(update_fields=['notes'])

        try:
            AuditLog.objects.create(
                hospital=payment.hospital,
                user=request.user.email or request.user.username,
                role='super_admin' if request.user.is_superuser else '',
                action='subscription_payment_review',
                target=f'payment:{payment.id}:status={next_status}:note={review_note or "-"}',
                action_type='billing',
            )
        except Exception:
            pass

        response_payload = SubscriptionPaymentSerializer(payment).data
        if next_status == 'paid':
            response_payload['receipt_email_sent'] = receipt_email_sent
            if receipt_email_error:
                response_payload['receipt_email_error'] = receipt_email_error
        if review_note:
            response_payload['review_note'] = review_note
        return Response(response_payload)

    @action(detail=True, methods=['post'])
    def resend_receipt(self, request, pk=None):
        if not request.user.is_superuser:
            return Response({'error': 'Only super admin can resend receipts'}, status=403)

        payment = self.get_object()
        if payment.status != 'paid':
            return Response({'error': 'Receipt can only be sent for paid payments'}, status=400)

        if not payment.hospital.email:
            return Response({'error': 'Hospital email is not configured'}, status=400)

        try:
            payment.receipt_delivery_status = 'queued'
            payment.receipt_last_attempt_at = timezone.now()
            payment.receipt_sent_at = None
            payment.receipt_last_error = ''
            payment.save(
                update_fields=[
                    'receipt_delivery_status',
                    'receipt_last_attempt_at',
                    'receipt_sent_at',
                    'receipt_last_error',
                ]
            )
            _queue_subscription_receipt(payment)
            try:
                AuditLog.objects.create(
                    hospital=payment.hospital,
                    user=request.user.email or request.user.username,
                    role='super_admin' if request.user.is_superuser else '',
                    action='subscription_receipt_resend',
                    target=f'payment:{payment.id}:queued',
                    action_type='billing',
                )
            except Exception:
                pass
        except Exception as exc:
            return Response({'error': f'Failed to queue receipt: {exc}'}, status=500)

        return Response(
            {
                'success': True,
                'message': 'Receipt email queued for delivery',
                'receipt_delivery_status': 'queued',
            },
            status=status.HTTP_202_ACCEPTED,
        )
