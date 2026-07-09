from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from billing.models import ReceiptEmailJob
from billing.views import _send_subscription_receipt


class Command(BaseCommand):
    help = 'Process queued subscription receipt email jobs.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=50, help='Maximum jobs to process per run')

    def handle(self, *args, **options):
        limit = max(1, int(options.get('limit') or 50))
        now = timezone.now()

        jobs = list(
            ReceiptEmailJob.objects.select_related('payment__hospital')
            .filter(status='pending', next_attempt_at__lte=now)
            .order_by('next_attempt_at', 'id')[:limit]
        )

        if not jobs:
            self.stdout.write(self.style.WARNING('No queued receipt email jobs found.'))
            return

        processed = 0
        succeeded = 0
        failed = 0

        for job in jobs:
            locked = ReceiptEmailJob.objects.filter(id=job.id, status='pending').update(
                status='processing',
                locked_at=timezone.now(),
            )
            if not locked:
                continue

            job.refresh_from_db()
            payment = job.payment
            processed += 1

            job.attempts += 1
            job.last_error = ''
            job.save(update_fields=['attempts', 'last_error'])

            payment.receipt_last_attempt_at = timezone.now()
            payment.receipt_last_error = ''
            payment.save(update_fields=['receipt_last_attempt_at', 'receipt_last_error'])

            try:
                sent = _send_subscription_receipt(payment)
                if not sent:
                    raise ValueError('Hospital email is not configured')

                job.status = 'sent'
                job.processed_at = timezone.now()
                job.locked_at = None
                job.save(update_fields=['status', 'processed_at', 'locked_at'])

                payment.receipt_delivery_status = 'sent'
                payment.receipt_sent_at = timezone.now()
                payment.receipt_last_error = ''
                payment.save(
                    update_fields=['receipt_delivery_status', 'receipt_sent_at', 'receipt_last_error']
                )
                succeeded += 1
            except Exception as exc:
                job.last_error = str(exc)
                job.locked_at = None
                if job.attempts >= job.max_attempts:
                    job.status = 'failed'
                    job.processed_at = timezone.now()
                else:
                    # Exponential backoff capped at 30 minutes.
                    delay_minutes = min(30, 2 ** max(job.attempts - 1, 0))
                    job.status = 'pending'
                    job.next_attempt_at = timezone.now() + timedelta(minutes=delay_minutes)
                job.save(update_fields=['status', 'processed_at', 'next_attempt_at', 'locked_at', 'last_error'])

                payment.receipt_delivery_status = 'failed'
                payment.receipt_sent_at = None
                payment.receipt_last_error = str(exc)
                payment.save(
                    update_fields=['receipt_delivery_status', 'receipt_sent_at', 'receipt_last_error']
                )
                failed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Processed {processed} receipt job(s): {succeeded} sent, {failed} failed.'
            )
        )
