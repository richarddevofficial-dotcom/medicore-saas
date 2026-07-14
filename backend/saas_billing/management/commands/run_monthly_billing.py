from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from hospitals.models import Hospital
from saas_billing.invoice_services import generate_unique_invoice_number
from saas_billing.models import HospitalSubscription, Invoice
from saas_billing.services import refresh_subscription_status


class Command(BaseCommand):
    help = (
        "Run SaaS billing automation: generate monthly invoices, send reminders, "
        "mark overdue invoices, and enforce grace/expired/suspended transitions."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show actions without persisting changes.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        today = timezone.localdate()

        generated = self._generate_monthly_invoices(today, dry_run)
        overdue = self._mark_overdue_invoices(today, dry_run)
        reminders = self._send_due_reminders(today)
        suspended = self._enforce_subscription_lifecycle(dry_run)

        self.stdout.write(
            self.style.SUCCESS(
                (
                    f"Billing cycle completed. generated_invoices={generated}, "
                    f"marked_overdue={overdue}, reminders_sent={reminders}, "
                    f"suspended_subscriptions={suspended}, dry_run={dry_run}"
                )
            )
        )

    def _generate_monthly_invoices(self, today, dry_run=False):
        count = 0
        subscriptions = HospitalSubscription.objects.select_related("hospital", "plan").filter(
            status__in=[
                HospitalSubscription.STATUS_ACTIVE,
                HospitalSubscription.STATUS_GRACE,
            ],
            next_billing_date__isnull=False,
            next_billing_date__lte=today,
        )

        for subscription in subscriptions:
            has_open_invoice = Invoice.objects.filter(
                subscription=subscription,
                invoice_type=Invoice.TYPE_SUBSCRIPTION,
                status__in=[
                    Invoice.STATUS_DRAFT,
                    Invoice.STATUS_PENDING,
                    Invoice.STATUS_OVERDUE,
                ],
            ).exists()
            if has_open_invoice:
                continue

            monthly_amount = Decimal(str(subscription.current_monthly_price or 0))
            due_date = today + timedelta(days=7)

            if not dry_run:
                Invoice.objects.create(
                    invoice_number=generate_unique_invoice_number(),
                    hospital=subscription.hospital,
                    subscription=subscription,
                    invoice_type=Invoice.TYPE_SUBSCRIPTION,
                    status=Invoice.STATUS_PENDING,
                    service_fee_amount=Decimal("0.00"),
                    subscription_amount=monthly_amount,
                    adjustment_amount=Decimal("0.00"),
                    subtotal=monthly_amount,
                    tax_amount=Decimal("0.00"),
                    total_amount=monthly_amount,
                    amount_paid=Decimal("0.00"),
                    currency=subscription.currency,
                    issued_at=timezone.now(),
                    due_date=due_date,
                    description=f"Monthly subscription invoice for {subscription.plan.name}.",
                    metadata={
                        "billing_period": "monthly",
                        "generated_by": "run_monthly_billing",
                    },
                )

                subscription.next_billing_date = today + timedelta(days=30)
                subscription.save(update_fields=["next_billing_date", "updated_at"])

            count += 1

        return count

    def _mark_overdue_invoices(self, today, dry_run=False):
        queryset = Invoice.objects.filter(
            status=Invoice.STATUS_PENDING,
            due_date__lt=today,
        )
        if dry_run:
            return queryset.count()
        return queryset.update(status=Invoice.STATUS_OVERDUE, updated_at=timezone.now())

    def _send_due_reminders(self, today):
        reminder_days = {7, 3, 1}
        sent = 0

        invoices = Invoice.objects.select_related("hospital").filter(
            status__in=[Invoice.STATUS_PENDING, Invoice.STATUS_OVERDUE],
        )
        for invoice in invoices:
            days_left = (invoice.due_date - today).days
            if days_left not in reminder_days:
                continue
            if not invoice.hospital.email:
                continue

            send_mail(
                subject=f"Invoice Reminder: {invoice.invoice_number}",
                message=(
                    f"Hello {invoice.hospital.name},\n\n"
                    f"Invoice {invoice.invoice_number} is due in {days_left} day(s).\n"
                    f"Outstanding balance: {invoice.currency} {invoice.balance_due}.\n\n"
                    "Please complete payment before the due date to avoid service interruption."
                ),
                from_email=None,
                recipient_list=[invoice.hospital.email],
                fail_silently=True,
            )
            sent += 1

        return sent

    def _enforce_subscription_lifecycle(self, dry_run=False):
        suspended_count = 0
        subscriptions = HospitalSubscription.objects.select_related("hospital", "plan").all()

        for subscription in subscriptions:
            previous_status = subscription.status
            subscription = refresh_subscription_status(subscription)

            should_suspend = subscription.status == HospitalSubscription.STATUS_EXPIRED
            if should_suspend:
                if not dry_run:
                    with transaction.atomic():
                        subscription.status = HospitalSubscription.STATUS_SUSPENDED
                        subscription.save(update_fields=["status", "updated_at"])

                        Hospital.objects.filter(id=subscription.hospital_id).update(
                            is_active=False,
                            subscription_status="suspended",
                            updated_at=timezone.now(),
                        )
                suspended_count += 1

            elif previous_status != subscription.status and not dry_run:
                # Keep hospital status in sync for trial/active/grace updates.
                Hospital.objects.filter(id=subscription.hospital_id).update(
                    subscription_status=subscription.status,
                    updated_at=timezone.now(),
                )

        return suspended_count
