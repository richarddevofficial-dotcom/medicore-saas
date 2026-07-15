from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from saas_billing.models import (
    BillingReminderLog,
    HospitalSubscription,
    Invoice,
    Payment,
)
from saas_billing.renewal_services import (
    create_monthly_renewal_invoice,
    process_expired_trial,
)
from saas_billing.reminder_services import (
    build_invoice_message,
    build_trial_message,
    send_billing_reminder,
)


class Command(BaseCommand):
    help = (
        "Process MediCore trial expiry, renewal invoices, "
        "overdue invoices and daily billing checks."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help=(
                "Show billing actions without committing "
                "database changes."
            ),
        )

        parser.add_argument(
            "--verbose-items",
            action="store_true",
            help="Print individual subscription and invoice actions.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        verbose_items = options["verbose_items"]

        now = timezone.now()
        today = timezone.localdate()

        summary = {
            "active_trials": 0,
            "expired_trials_found": 0,
            "trials_moved_to_grace": 0,
            "initial_invoices_created": 0,
            "initial_invoices_skipped": 0,
            "active_subscriptions": 0,
            "renewals_due": 0,
            "renewal_invoices_created": 0,
            "renewal_invoices_skipped": 0,
            "pending_invoices": 0,
            "invoices_marked_overdue": 0,
            "already_overdue": 0,
            "grace_subscriptions": 0,
            "expired_subscriptions": 0,
            "suspended_subscriptions": 0,
            "pending_payments": 0,
            "trial_reminders_sent": 0,
            "invoice_reminders_sent": 0,
            "reminders_skipped": 0,
            "reminder_errors": 0,
        }

        self.stdout.write("")
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                "MediCore Daily Billing Processor"
            )
        )
        self.stdout.write(f"Run time: {now.isoformat()}")
        self.stdout.write(
            f"Mode: {'DRY RUN' if dry_run else 'LIVE'}"
        )
        self.stdout.write("")

        with transaction.atomic():
            subscriptions = (
                HospitalSubscription.objects
                .select_related("hospital", "plan")
                .order_by("hospital__name")
            )

            for subscription in subscriptions:
                hospital_name = subscription.hospital.name

                if (
                    subscription.status
                    == HospitalSubscription.STATUS_TRIAL
                ):
                    summary["active_trials"] += 1

                    if subscription.trial_ends_at:
                        trial_end_date = timezone.localtime(
                            subscription.trial_ends_at
                        ).date()

                        days_remaining = (
                            trial_end_date - today
                        ).days

                        trial_reminder_types = {
                            7: BillingReminderLog.REMINDER_TRIAL_7_DAYS,
                            3: BillingReminderLog.REMINDER_TRIAL_3_DAYS,
                            0: BillingReminderLog.REMINDER_TRIAL_TODAY,
                        }

                        reminder_type = (
                            trial_reminder_types.get(
                                days_remaining
                            )
                        )

                        if reminder_type:
                            subject, message = (
                                build_trial_message(
                                    subscription,
                                    days_remaining,
                                )
                            )

                            try:
                                result = (
                                    send_billing_reminder(
                                        hospital=(
                                            subscription.hospital
                                        ),
                                        subscription=subscription,
                                        reminder_type=reminder_type,
                                        subject=subject,
                                        message=message,
                                        billing_date=(
                                            trial_end_date
                                        ),
                                        dry_run=dry_run,
                                        metadata={
                                            "days_remaining": (
                                                days_remaining
                                            ),
                                            "trial_ends_at": (
                                                subscription
                                                .trial_ends_at
                                                .isoformat()
                                            ),
                                        },
                                    )
                                )

                                if result.get("sent"):
                                    summary[
                                        "trial_reminders_sent"
                                    ] += 1
                                elif result.get("skipped"):
                                    summary[
                                        "reminders_skipped"
                                    ] += 1

                                self.print_item(
                                    verbose_items,
                                    (
                                        f"Trial reminder "
                                        f"{reminder_type}: "
                                        f"{subscription.hospital.name} "
                                        f"— {result}"
                                    ),
                                )

                            except Exception as error:
                                summary[
                                    "reminder_errors"
                                ] += 1

                                self.stderr.write(
                                    self.style.ERROR(
                                        f"Trial reminder failed "
                                        f"for "
                                        f"{subscription.hospital.name}: "
                                        f"{error}"
                                    )
                                )

                    if (
                        subscription.trial_ends_at
                        and subscription.trial_ends_at <= now
                    ):
                        summary["expired_trials_found"] += 1

                        updated_subscription, invoice, created = (
                            process_expired_trial(subscription)
                        )

                        if (
                            updated_subscription.status
                            == HospitalSubscription.STATUS_GRACE
                        ):
                            summary["trials_moved_to_grace"] += 1

                        if created:
                            summary["initial_invoices_created"] += 1

                            self.print_item(
                                verbose_items,
                                (
                                    f"Created initial invoice "
                                    f"{invoice.invoice_number} for "
                                    f"{hospital_name} — "
                                    f"{invoice.currency} "
                                    f"{invoice.total_amount}"
                                ),
                            )
                        else:
                            summary["initial_invoices_skipped"] += 1

                            if invoice:
                                self.print_item(
                                    verbose_items,
                                    (
                                        f"Initial invoice already exists "
                                        f"for {hospital_name}: "
                                        f"{invoice.invoice_number}"
                                    ),
                                )

                elif (
                    subscription.status
                    == HospitalSubscription.STATUS_ACTIVE
                ):
                    summary["active_subscriptions"] += 1

                    if (
                        subscription.next_billing_date
                        and subscription.next_billing_date <= today
                    ):
                        summary["renewals_due"] += 1

                        invoice, created = (
                            create_monthly_renewal_invoice(
                                subscription
                            )
                        )

                        if created:
                            summary["renewal_invoices_created"] += 1

                            self.print_item(
                                verbose_items,
                                (
                                    f"Created renewal invoice "
                                    f"{invoice.invoice_number} for "
                                    f"{hospital_name} — "
                                    f"{invoice.currency} "
                                    f"{invoice.total_amount}"
                                ),
                            )
                        else:
                            summary["renewal_invoices_skipped"] += 1

                            if invoice:
                                self.print_item(
                                    verbose_items,
                                    (
                                        f"Renewal invoice already exists "
                                        f"for {hospital_name}: "
                                        f"{invoice.invoice_number}"
                                    ),
                                )

                elif (
                    subscription.status
                    == HospitalSubscription.STATUS_GRACE
                ):
                    summary["grace_subscriptions"] += 1

                elif (
                    subscription.status
                    == HospitalSubscription.STATUS_EXPIRED
                ):
                    summary["expired_subscriptions"] += 1

                elif (
                    subscription.status
                    == HospitalSubscription.STATUS_SUSPENDED
                ):
                    summary["suspended_subscriptions"] += 1

            pending_invoices = Invoice.objects.filter(
                status=Invoice.STATUS_PENDING
            ).select_related("hospital")

            summary["pending_invoices"] = (
                pending_invoices.count()
            )

            for invoice in pending_invoices:
                days_until_due = (
                    invoice.due_date - today
                ).days

                invoice_reminder_types = {
                    7: BillingReminderLog.REMINDER_INVOICE_7_DAYS,
                    3: BillingReminderLog.REMINDER_INVOICE_3_DAYS,
                    0: BillingReminderLog.REMINDER_INVOICE_TODAY,
                    -3: BillingReminderLog.REMINDER_OVERDUE_3_DAYS,
                    -7: BillingReminderLog.REMINDER_OVERDUE_7_DAYS,
                }

                reminder_type = (
                    invoice_reminder_types.get(
                        days_until_due
                    )
                )

                if reminder_type:
                    overdue = days_until_due < 0
                    reminder_days = abs(
                        days_until_due
                    )

                    subject, message = (
                        build_invoice_message(
                            invoice,
                            reminder_days,
                            overdue=overdue,
                        )
                    )

                    try:
                        result = send_billing_reminder(
                            hospital=invoice.hospital,
                            subscription=(
                                invoice.subscription
                            ),
                            invoice=invoice,
                            reminder_type=reminder_type,
                            subject=subject,
                            message=message,
                            billing_date=invoice.due_date,
                            dry_run=dry_run,
                            metadata={
                                "days_until_due": (
                                    days_until_due
                                ),
                                "invoice_number": (
                                    invoice.invoice_number
                                ),
                                "balance_due": str(
                                    invoice.balance_due
                                ),
                            },
                        )

                        if result.get("sent"):
                            summary[
                                "invoice_reminders_sent"
                            ] += 1
                        elif result.get("skipped"):
                            summary[
                                "reminders_skipped"
                            ] += 1

                        self.print_item(
                            verbose_items,
                            (
                                f"Invoice reminder "
                                f"{reminder_type}: "
                                f"{invoice.invoice_number} "
                                f"— {result}"
                            ),
                        )

                    except Exception as error:
                        summary[
                            "reminder_errors"
                        ] += 1

                        self.stderr.write(
                            self.style.ERROR(
                                f"Invoice reminder failed "
                                f"for "
                                f"{invoice.invoice_number}: "
                                f"{error}"
                            )
                        )

                if invoice.due_date < today:
                    invoice.status = Invoice.STATUS_OVERDUE
                    invoice.save(
                        update_fields=[
                            "status",
                            "updated_at",
                        ]
                    )

                    summary["invoices_marked_overdue"] += 1

                    self.print_item(
                        verbose_items,
                        (
                            f"Marked invoice overdue: "
                            f"{invoice.invoice_number} — "
                            f"{invoice.hospital.name}"
                        ),
                    )

            summary["already_overdue"] = (
                Invoice.objects.filter(
                    status=Invoice.STATUS_OVERDUE
                ).count()
            )

            summary["pending_payments"] = (
                Payment.objects.filter(
                    status=Payment.STATUS_PENDING
                ).count()
            )

            if dry_run:
                transaction.set_rollback(True)

        self.print_summary(summary)

        if dry_run:
            self.stdout.write("")
            self.stdout.write(
                self.style.WARNING(
                    "Dry run completed. All database "
                    "changes were rolled back."
                )
            )
        else:
            self.stdout.write("")
            self.stdout.write(
                self.style.SUCCESS(
                    "Daily billing processing completed."
                )
            )

    def print_item(self, enabled, message):
        if enabled:
            self.stdout.write(f"  - {message}")

    def print_summary(self, summary):
        rows = [
            ("Active trials", summary["active_trials"]),
            (
                "Expired trials found",
                summary["expired_trials_found"],
            ),
            (
                "Trials moved to grace",
                summary["trials_moved_to_grace"],
            ),
            (
                "Initial invoices created",
                summary["initial_invoices_created"],
            ),
            (
                "Initial invoices skipped",
                summary["initial_invoices_skipped"],
            ),
            (
                "Active subscriptions",
                summary["active_subscriptions"],
            ),
            ("Renewals due", summary["renewals_due"]),
            (
                "Renewal invoices created",
                summary["renewal_invoices_created"],
            ),
            (
                "Renewal invoices skipped",
                summary["renewal_invoices_skipped"],
            ),
            (
                "Pending invoices inspected",
                summary["pending_invoices"],
            ),
            (
                "Invoices marked overdue",
                summary["invoices_marked_overdue"],
            ),
            (
                "Total overdue invoices",
                summary["already_overdue"],
            ),
            (
                "Subscriptions in grace",
                summary["grace_subscriptions"],
            ),
            (
                "Expired subscriptions",
                summary["expired_subscriptions"],
            ),
            (
                "Suspended subscriptions",
                summary["suspended_subscriptions"],
            ),
            (
                "Payments awaiting approval",
                summary["pending_payments"],
            ),
            (
                "Trial reminders sent",
                summary["trial_reminders_sent"],
            ),
            (
                "Invoice reminders sent",
                summary["invoice_reminders_sent"],
            ),
            (
                "Reminders skipped",
                summary["reminders_skipped"],
            ),
            (
                "Reminder errors",
                summary["reminder_errors"],
            ),
        ]

        width = max(len(label) for label, _value in rows)

        self.stdout.write("")
        self.stdout.write(
            self.style.MIGRATE_LABEL(
                "Billing summary"
            )
        )

        for label, value in rows:
            self.stdout.write(
                f"  {label:<{width}} : {value}"
            )
