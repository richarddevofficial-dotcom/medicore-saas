from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from saas_billing.models import (
    HospitalSubscription,
)


class Command(BaseCommand):
    help = (
        "Apply scheduled subscription plan changes "
        "whose effective dates have arrived."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help=(
                "Show changes without updating "
                "subscriptions."
            ),
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        today = timezone.localdate()

        subscriptions = (
            HospitalSubscription.objects
            .filter(
                pending_plan__isnull=False,
                pending_plan_effective_date__lte=today,
            )
            .select_related(
                "hospital",
                "plan",
                "pending_plan",
            )
            .order_by("id")
        )

        found = subscriptions.count()
        applied = 0
        failed = 0

        self.stdout.write(
            f"Scheduled plan changes found: {found}"
        )

        for subscription in subscriptions:
            try:
                with transaction.atomic():
                    locked = (
                        HospitalSubscription.objects
                        .select_for_update()
                        .select_related(
                            "hospital",
                            "plan",
                            "pending_plan",
                        )
                        .get(pk=subscription.pk)
                    )

                    target_plan = locked.pending_plan

                    if not target_plan:
                        continue

                    self.stdout.write(
                        (
                            f"{locked.hospital.name}: "
                            f"{locked.plan.code} -> "
                            f"{target_plan.code}"
                        )
                    )

                    if dry_run:
                        continue

                    locked.plan = target_plan
                    locked.current_monthly_price = (
                        target_plan.monthly_price
                    )
                    locked.current_service_fee = (
                        target_plan.service_fee
                    )
                    locked.currency = (
                        target_plan.currency
                    )
                    locked.status = (
                        HospitalSubscription
                        .STATUS_ACTIVE
                    )

                    locked.pending_plan = None
                    locked.pending_plan_effective_date = (
                        None
                    )
                    locked.pending_plan_requested_at = (
                        None
                    )

                    locked.save(
                        update_fields=[
                            "plan",
                            "current_monthly_price",
                            "current_service_fee",
                            "currency",
                            "status",
                            "pending_plan",
                            "pending_plan_effective_date",
                            "pending_plan_requested_at",
                            "updated_at",
                        ]
                    )

                    hospital = locked.hospital
                    hospital.subscription_plan = (
                        target_plan.code
                    )
                    hospital.subscription_status = (
                        "active"
                    )
                    hospital.max_staff = (
                        target_plan.max_staff or 0
                    )
                    hospital.max_patients = (
                        target_plan.max_patients or 0
                    )
                    hospital.is_active = True

                    hospital.save(
                        update_fields=[
                            "subscription_plan",
                            "subscription_status",
                            "max_staff",
                            "max_patients",
                            "is_active",
                            "updated_at",
                        ]
                    )

                    applied += 1

            except Exception as error:
                failed += 1

                self.stderr.write(
                    self.style.ERROR(
                        (
                            f"Failed subscription "
                            f"{subscription.id}: {error}"
                        )
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                (
                    f"Complete. Found={found}, "
                    f"Applied={applied}, "
                    f"Failed={failed}, "
                    f"Dry run={dry_run}"
                )
            )
        )
