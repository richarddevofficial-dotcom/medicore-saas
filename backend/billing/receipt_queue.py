from datetime import timedelta

from django.utils import timezone

from .models import ReceiptEmailJob


def enqueue_receipt_email_job(payment):
    existing = (
        ReceiptEmailJob.objects.filter(
            payment=payment,
            status__in=['pending', 'processing'],
        )
        .order_by('-id')
        .first()
    )
    if existing:
        return existing, False

    job = ReceiptEmailJob.objects.create(payment=payment)
    return job, True


def schedule_retry(job):
    # Exponential backoff capped at 30 minutes.
    delay_minutes = min(30, 2 ** max(job.attempts - 1, 0))
    job.status = 'pending'
    job.next_attempt_at = timezone.now() + timedelta(minutes=delay_minutes)
    job.locked_at = None
