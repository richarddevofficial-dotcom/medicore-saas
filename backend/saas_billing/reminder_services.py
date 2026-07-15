from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.utils import timezone

from staff.models import StaffProfile

from .models import BillingReminderLog


def get_hospital_admin_email(hospital):
    profile = (
        StaffProfile.objects
        .filter(
            hospital=hospital,
            role="admin",
            is_active=True,
            user__is_active=True,
        )
        .select_related("user")
        .order_by("created_at")
        .first()
    )

    if profile and profile.user.email:
        return profile.user.email.strip().lower()

    return (hospital.email or "").strip().lower()


def reminder_already_sent(
    *,
    hospital,
    reminder_type,
    billing_date,
    subscription=None,
    invoice=None,
):
    filters = {
        "hospital": hospital,
        "reminder_type": reminder_type,
        "billing_date": billing_date,
    }

    if invoice:
        filters["invoice"] = invoice
    else:
        filters["subscription"] = subscription

    return BillingReminderLog.objects.filter(
        **filters
    ).exists()


@transaction.atomic
def send_billing_reminder(
    *,
    hospital,
    reminder_type,
    subject,
    message,
    billing_date,
    subscription=None,
    invoice=None,
    dry_run=False,
    metadata=None,
):
    recipient = get_hospital_admin_email(hospital)

    if not recipient:
        return {
            "sent": False,
            "skipped": True,
            "reason": "No administrator email found.",
        }

    if reminder_already_sent(
        hospital=hospital,
        reminder_type=reminder_type,
        billing_date=billing_date,
        subscription=subscription,
        invoice=invoice,
    ):
        return {
            "sent": False,
            "skipped": True,
            "reason": "Reminder already sent.",
        }

    if dry_run:
        return {
            "sent": False,
            "skipped": False,
            "dry_run": True,
            "recipient": recipient,
        }

    from_email = getattr(
        settings,
        "DEFAULT_FROM_EMAIL",
        "noreply@medicorecloud.com",
    )

    sent_count = send_mail(
        subject=subject,
        message=message,
        from_email=from_email,
        recipient_list=[recipient],
        fail_silently=False,
    )

    if sent_count != 1:
        return {
            "sent": False,
            "skipped": False,
            "reason": "Email backend returned no delivery.",
        }

    try:
        BillingReminderLog.objects.create(
            hospital=hospital,
            subscription=subscription,
            invoice=invoice,
            reminder_type=reminder_type,
            recipient_email=recipient,
            subject=subject,
            billing_date=billing_date,
            metadata=metadata or {},
        )
    except IntegrityError:
        return {
            "sent": False,
            "skipped": True,
            "reason": "Reminder was recorded concurrently.",
        }

    return {
        "sent": True,
        "skipped": False,
        "recipient": recipient,
    }


def build_trial_message(subscription, days_remaining):
    hospital = subscription.hospital
    plan = subscription.plan

    if days_remaining == 0:
        timing = "Your free trial ends today."
    else:
        timing = (
            f"Your free trial ends in "
            f"{days_remaining} day(s)."
        )

    subject = (
        f"MediCore trial reminder — {hospital.name}"
    )

    message = (
        f"Hello {hospital.name} Administrator,\n\n"
        f"{timing}\n\n"
        f"Current plan: {plan.name}\n"
        f"Monthly subscription: "
        f"{subscription.currency} "
        f"{subscription.current_monthly_price}\n"
        f"One-time platform service fee: "
        f"{subscription.currency} "
        f"{subscription.current_service_fee}\n\n"
        "Please open your MediCore Billing page to "
        "review your subscription and generate an invoice.\n\n"
        f"Billing page: "
        f"https://{hospital.slug}.medicorecloud.com/"
        "settings/billing\n\n"
        "Support: support@medicorecloud.com\n\n"
        "Regards,\n"
        "MediCore HMS Team"
    )

    return subject, message


def build_invoice_message(invoice, days_value, overdue=False):
    hospital = invoice.hospital

    if overdue:
        timing = (
            f"Invoice {invoice.invoice_number} is "
            f"{days_value} day(s) overdue."
        )
        subject = (
            f"Overdue MediCore invoice — "
            f"{invoice.invoice_number}"
        )
    elif days_value == 0:
        timing = (
            f"Invoice {invoice.invoice_number} is due today."
        )
        subject = (
            f"MediCore invoice due today — "
            f"{invoice.invoice_number}"
        )
    else:
        timing = (
            f"Invoice {invoice.invoice_number} is due "
            f"in {days_value} day(s)."
        )
        subject = (
            f"MediCore invoice reminder — "
            f"{invoice.invoice_number}"
        )

    message = (
        f"Hello {hospital.name} Administrator,\n\n"
        f"{timing}\n\n"
        f"Invoice number: {invoice.invoice_number}\n"
        f"Total amount: {invoice.currency} "
        f"{invoice.total_amount}\n"
        f"Amount paid: {invoice.currency} "
        f"{invoice.amount_paid}\n"
        f"Balance due: {invoice.currency} "
        f"{invoice.balance_due}\n"
        f"Due date: {invoice.due_date}\n\n"
        "Please open your MediCore Billing page to "
        "review the invoice and submit payment details.\n\n"
        f"Billing page: "
        f"https://{hospital.slug}.medicorecloud.com/"
        "settings/billing\n\n"
        "Support: support@medicorecloud.com\n\n"
        "Regards,\n"
        "MediCore HMS Team"
    )

    return subject, message
