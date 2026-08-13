"""
Lifecycle notification emails for SaaS subscription billing.

These complement reminder_services.py (pre-due reminders) and
receipt_services.py (payment receipts) by covering the transactional
events in the payment workflow:

- invoice created
- payment submitted (pending review)
- payment approved (delegates to receipt email)
- payment rejected
- subscription expiring soon
- grace period started
- subscription suspended

All senders are fail-silent at the call site responsibility; helpers here
return True/False and never raise so a notification failure can never
break a billing transaction.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail

from .reminder_services import get_hospital_admin_email


logger = logging.getLogger(__name__)


def _from_email():
    return getattr(
        settings,
        "DEFAULT_FROM_EMAIL",
        "noreply@medicore.local",
    )


def _recipients_for_hospital(hospital):
    recipients = []

    admin_email = get_hospital_admin_email(hospital)
    if admin_email:
        recipients.append(admin_email)

    hospital_email = (hospital.email or "").strip().lower()
    if hospital_email and hospital_email not in recipients:
        recipients.append(hospital_email)

    return recipients


def _notify(hospital, subject, message, extra_recipients=None):
    recipients = _recipients_for_hospital(hospital)

    for email in extra_recipients or []:
        email = (email or "").strip().lower()
        if email and email not in recipients:
            recipients.append(email)

    if not recipients:
        logger.info(
            "Billing notification %r skipped for hospital %s: no recipients.",
            subject,
            getattr(hospital, "id", None),
        )
        return False

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=_from_email(),
            recipient_list=recipients,
            fail_silently=True,
        )
        return True
    except Exception:
        logger.exception(
            "Billing notification %r failed for hospital %s.",
            subject,
            getattr(hospital, "id", None),
        )
        return False


def notify_invoice_created(invoice):
    hospital = invoice.hospital
    return _notify(
        hospital,
        subject=f"MediCore Invoice {invoice.invoice_number} Created",
        message=(
            f"Hello {hospital.name},\n\n"
            f"A new invoice has been generated for your subscription.\n\n"
            f"Invoice Number: {invoice.invoice_number}\n"
            f"Amount Due: {invoice.currency} {invoice.total_amount:.2f}\n"
            f"Due Date: {invoice.due_date}\n\n"
            "Please submit your payment from the billing page.\n\n"
            "Thank you for using MediCore SaaS.\n"
        ),
    )


def notify_payment_submitted(payment):
    hospital = payment.hospital
    submitted_by = getattr(payment, "submitted_by", None)
    return _notify(
        hospital,
        subject=(
            f"MediCore Payment {payment.payment_reference} "
            "Submitted for Review"
        ),
        message=(
            f"Hello {hospital.name},\n\n"
            "Your payment has been submitted and is awaiting "
            "review by the MediCore billing team.\n\n"
            f"Payment Reference: {payment.payment_reference}\n"
            f"Invoice Number: {payment.invoice.invoice_number}\n"
            f"Amount: {payment.currency} {payment.amount:.2f}\n"
            f"Payment Method: {payment.payment_method or '-'}\n\n"
            "You will receive another notification once the payment "
            "has been approved.\n\n"
            "Thank you for using MediCore SaaS.\n"
        ),
        extra_recipients=[
            getattr(submitted_by, "email", ""),
        ],
    )


def notify_payment_rejected(payment):
    hospital = payment.hospital
    submitted_by = getattr(payment, "submitted_by", None)
    reason = payment.rejection_reason or "No reason provided."
    return _notify(
        hospital,
        subject=(
            f"MediCore Payment {payment.payment_reference} Rejected"
        ),
        message=(
            f"Hello {hospital.name},\n\n"
            "Unfortunately your payment could not be approved.\n\n"
            f"Payment Reference: {payment.payment_reference}\n"
            f"Invoice Number: {payment.invoice.invoice_number}\n"
            f"Amount: {payment.currency} {payment.amount:.2f}\n"
            f"Reason: {reason}\n\n"
            "Please review the reason above and submit a new payment "
            "from the billing page.\n\n"
            "Thank you for using MediCore SaaS.\n"
        ),
        extra_recipients=[
            getattr(submitted_by, "email", ""),
        ],
    )


def notify_subscription_expiring_soon(subscription, days_remaining):
    hospital = subscription.hospital
    return _notify(
        hospital,
        subject=(
            f"MediCore Subscription Expires in "
            f"{days_remaining} Day(s)"
        ),
        message=(
            f"Hello {hospital.name},\n\n"
            f"Your {subscription.plan.name} subscription expires in "
            f"{days_remaining} day(s) on {subscription.end_date}.\n\n"
            "Please renew your subscription from the billing page to "
            "avoid interruption of service.\n\n"
            "Thank you for using MediCore SaaS.\n"
        ),
    )


def notify_grace_period_started(subscription):
    hospital = subscription.hospital
    grace_end = subscription.grace_period_ends_at
    return _notify(
        hospital,
        subject="MediCore Subscription Entered Grace Period",
        message=(
            f"Hello {hospital.name},\n\n"
            "Your subscription has expired and is now in the grace "
            "period.\n\n"
            f"Grace Period Ends: "
            f"{grace_end.date() if grace_end else '-'}\n\n"
            "You can still access the system during the grace period. "
            "Please renew your subscription immediately to avoid "
            "suspension.\n\n"
            "Thank you for using MediCore SaaS.\n"
        ),
    )


def notify_subscription_suspended(subscription):
    hospital = subscription.hospital
    return _notify(
        hospital,
        subject="MediCore Subscription Suspended",
        message=(
            f"Hello {hospital.name},\n\n"
            "Your subscription grace period has ended and your "
            "subscription has been suspended.\n\n"
            "Access to hospital operations is now restricted, but you "
            "can still sign in and visit the billing page to renew "
            "your subscription.\n\n"
            "Thank you for using MediCore SaaS.\n"
        ),
    )
