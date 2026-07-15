from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from saas_billing.models import (
    HospitalSubscription,
    Invoice,
    Payment,
)


class Command(BaseCommand):
    help = (
        "Inspect MediCore subscriptions, trials, renewals, "
        "invoices and payments requiring daily billing action."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help=(
                "Inspect and report billing actions without "
                "changing database records."
            ),
        )

        parser.add_argument(
            "--verbose-items",
            action="store_true",
            help="Print individual hospitals and invoices.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        verbose_items = options["verbose_items"]

        now = timezone.now()
        today = timezone.localdate()

        self.stdout.write("")
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                "MediCore Daily Billing Processor"
            )
        )
        self.stdout.write(
            f"Run time: {now.isoformat()}"
        )
        self.stdout.write(
            f"Mode: {'DRY RUN' if dry_run else 'LIVE'}"
        )
        self.stdout.write("")

        summary = {
            "trial_active": 0,
            "trial_ending_7_days": 0,
            "trial_ending_3_days": 0,
            "trial_ending_today": 0,
            "trial_expired": 0,
            "renewals_due": 0,
            "renewals_due_7_days": 0,
            "grace_period": 0,
            "expired_subscriptions": 0,
            "suspended_subscriptions": 0,
            "pending_invoices": 0,
            "overdue_invoices": 0,
            "pending_payments": 0,
        }

        with transaction.atomic():
            subscriptions = (
                HospitalSubscription.objects
                .select_related(
                    "hospital",
                    "plan",
                )
                .order_by("hospital__name")
            )

            for subscription in subscriptions:
                hospital_name = subscription.hospital.name
                trial_end = subscription.trial_ends_at
                next_billing = subscription.next_billing_date

                if (
                    subscription.status
                    == HospitalSubscription.STATUS_TRIAL
                ):
                    summary["trial_active"] += 1

                    if trial_end:
                        trial_end_date = timezone.localtime(
                            trial_end
                        ).date()

                        days_until_trial_end = (
                            trial_end_date - today
                        ).days

                        if days_until_trial_end == 7:
                            summary[
                                "trial_ending_7_days"
                            ] += 1

                            self.print_item(
                                verbose_items,
                                (
                                    f"Trial ends in 7 days: "
                                    f"{hospital_name}"
                                ),
                            )

                        elif days_until_trial_end == 3:
                            summary[
                                "trial_ending_3_days"
                            ] += 1

                            self.print_item(
                                verbose_items,
                                (
                                    f"Trial ends in 3 days: "
                                    f"{hospital_name}"
                                ),
                            )

                        elif days_until_trial_end == 0:
                            summary[
                                "trial_ending_today"
                            ] += 1

                            self.print_item(
                                verbose_items,
                                (
                                    f"Trial ends today: "
                                    f"{hospital_name}"
                                ),
                            )

                        elif days_until_trial_end < 0:
                            summary["trial_expired"] += 1

                            self.print_item(
                                verbose_items,
                                (
                                    f"Expired trial: "
                                    f"{hospital_name} "
                                    f"({abs(days_until_trial_end)} "
                                    f"day(s) ago)"
                                ),
                            )

                elif (
                    subscription.status
                    == HospitalSubscription.STATUS_ACTIVE
                ):
                    if next_billing:
                        days_until_billing = (
                            next_billing - today
                        ).days

                        if days_until_billing == 7:
                            summary[
                                "renewals_due_7_days"
                            ] += 1

                            self.print_item(
                                verbose_items,
                                (
                                    f"Renewal due in 7 days: "
                                    f"{hospital_name}"
                                ),
                            )

                        if days_until_billing <= 0:
                            summary["renewals_due"] += 1

                            self.print_item(
                                verbose_items,
                                (
                                    f"Renewal due: "
                                    f"{hospital_name} "
                                    f"({next_billing})"
                                ),
                            )

                elif (
                    subscription.status
                    == HospitalSubscription.STATUS_GRACE
                ):
                    summary["grace_period"] += 1

                    self.print_item(
                        verbose_items,
                        (
                            f"Grace period: "
                            f"{hospital_name}"
                        ),
                    )

                elif (
                    subscription.status
                    == HospitalSubscription.STATUS_EXPIRED
                ):
                    summary[
                        "expired_subscriptions"
                    ] += 1

                    self.print_item(
                        verbose_items,
                        (
                            f"Expired subscription: "
                            f"{hospital_name}"
                        ),
                    )

                elif (
                    subscription.status
                    == HospitalSubscription.STATUS_SUSPENDED
                ):
                    summary[
                        "suspended_subscriptions"
                    ] += 1

                    self.print_item(
                        verbose_items,
                        (
                            f"Suspended subscription: "
                            f"{hospital_name}"
                        ),
                    )

            pending_invoices = Invoice.objects.filter(
                status=Invoice.STATUS_PENDING
            )

            summary["pending_invoices"] = (
                pending_invoices.count()
            )

            for invoice in pending_invoices.select_related(
                "hospital"
            ):
                if invoice.due_date < today:
                    summary["overdue_invoices"] += 1

                    self.print_item(
                        verbose_items,
                        (
                            f"Past-due invoice: "
                            f"{invoice.invoice_number} — "
                            f"{invoice.hospital.name} — "
                            f"due {invoice.due_date}"
                        ),
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
                    "Dry run completed. No database "
                    "records were changed."
                )
            )
        else:
            self.stdout.write("")
            self.stdout.write(
                self.style.SUCCESS(
                    "Daily billing inspection completed."
                )
            )

        self.stdout.write(
            "Automatic invoice creation, reminders and "
            "suspension will be added in the next "
            "Phase 9.4 milestones."
        )

    def print_item(self, enabled, message):
        if enabled:
            self.stdout.write(f"  - {message}")

    def print_summary(self, summary):
        self.stdout.write("")
        self.stdout.write(
            self.style.MIGRATE_LABEL(
                "Billing summary"
            )
        )

        rows = [
            (
                "Active trials",
                summary["trial_active"],
            ),
            (
                "Trials ending in 7 days",
                summary["trial_ending_7_days"],
            ),
            (
                "Trials ending in 3 days",
                summary["trial_ending_3_days"],
            ),
            (
                "Trials ending today",
                summary["trial_ending_today"],
            ),
            (
                "Expired trials requiring action",
                summary["trial_expired"],
            ),
            (
                "Renewals due in 7 days",
                summary["renewals_due_7_days"],
            ),
            (
                "Renewals due now",
                summary["renewals_due"],
            ),
            (
                "Subscriptions in grace",
                summary["grace_period"],
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
                "Pending invoices",
                summary["pending_invoices"],
            ),
            (
                "Past-due pending invoices",
                summary["overdue_invoices"],
            ),
            (
                "Payments awaiting approval",
                summary["pending_payments"],
            ),
        ]

        width = max(
            len(label)
            for label, _value in rows
        )

        for label, value in rows:
            self.stdout.write(
                f"  {label:<{width}} : {value}"
            )
