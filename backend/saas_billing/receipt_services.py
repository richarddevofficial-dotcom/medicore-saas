"""Receipt email services for SaaS billing payment approvals."""

from decimal import Decimal
from django.core.mail import EmailMessage
from django.conf import settings
from django.utils import timezone
from .pdf_services import build_payment_receipt_pdf


def send_payment_receipt_email(payment):
    """
    Send a payment receipt email to the hospital.
    
    Args:
        payment: saas_billing.Payment instance
        
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    hospital = payment.hospital
    
    if not hospital.email:
        payment.receipt_delivery_status = 'failed'
        payment.receipt_last_error = 'Hospital email not configured'
        payment.receipt_last_attempt_at = timezone.now()
        payment.save(update_fields=['receipt_delivery_status', 'receipt_last_error', 'receipt_last_attempt_at'])
        return False

    try:
        amount = Decimal(payment.amount or 0)
        paid_on = payment.paid_at or timezone.now()
        receipt_id = f'PAY-{payment.id:06d}'
        invoice = payment.invoice
        subscription = payment.subscription
        
        subject = f'Payment Receipt - {hospital.name}'
        message = (
            f"Hello {hospital.name},\n\n"
            f"Your payment has been approved successfully.\n\n"
            f"Receipt ID: {receipt_id}\n"
            f"Invoice Number: {invoice.invoice_number}\n"
            f"Plan: {subscription.plan.name}\n"
            f"Amount: {payment.currency} {amount:.2f}\n"
            f"Payment Method: {payment.payment_method or '-'}\n"
            f"Transaction ID: {payment.transaction_id or '-'}\n"
            f"Paid On: {paid_on:%Y-%m-%d %H:%M:%S}\n\n"
            f"Status: Your subscription is now active.\n\n"
            "Thank you for using MediCore SaaS.\n"
        )

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@medicore.local')
        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=from_email,
            to=[hospital.email],
        )

        # Attach receipt PDF
        try:
            receipt_filename = f'payment-receipt-{receipt_id}.pdf'
            receipt_pdf = build_payment_receipt_pdf(payment)
            email.attach(receipt_filename, receipt_pdf, 'application/pdf')
        except Exception:
            # Continue without PDF if generation fails
            pass

        email.send(fail_silently=False)
        
        payment.receipt_delivery_status = 'sent'
        payment.receipt_sent_at = timezone.now()
        payment.receipt_last_attempt_at = timezone.now()
        payment.receipt_last_error = ''
        payment.save(
            update_fields=[
                'receipt_delivery_status', 
                'receipt_sent_at', 
                'receipt_last_attempt_at', 
                'receipt_last_error'
            ]
        )
        return True

    except Exception as exc:
        error_msg = str(exc)
        payment.receipt_delivery_status = 'failed'
        payment.receipt_last_error = error_msg
        payment.receipt_last_attempt_at = timezone.now()
        payment.save(
            update_fields=[
                'receipt_delivery_status', 
                'receipt_last_error', 
                'receipt_last_attempt_at'
            ]
        )
        return False
