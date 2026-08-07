from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from billing.models import SubscriptionPayment
from saas_billing.models import HospitalSubscription, SubscriptionPlan


PLAN_CODE_ALIASES = {}


class Command(BaseCommand):
    help = (
        "Create SaaS subscriptions for hospitals with paid legacy "
        "subscription payments but no HospitalSubscription record."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show eligible hospitals without creating subscriptions.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        active_plans = {
            plan.code: plan
            for plan in SubscriptionPlan.objects.filter(is_active=True)
        }
        created = 0
        skipped_existing = 0
        skipped_unknown_plan = 0
        processed_hospital_ids = set()

        payments = (
            SubscriptionPayment.objects.filter(status="paid")
            .select_related("hospital")
            .order_by("hospital_id", "-payment_date", "-created_at")
        )

        for payment in payments:
            hospital = payment.hospital
            if hospital.id in processed_hospital_ids:
                continue
            processed_hospital_ids.add(hospital.id)

            if HospitalSubscription.objects.filter(hospital=hospital).exists():
                skipped_existing += 1
                continue

            plan_code = PLAN_CODE_ALIASES.get(
                str(payment.plan or "").strip().lower(),
                str(payment.plan or "").strip().lower(),
            )
            plan = active_plans.get(plan_code)
            if not plan:
                skipped_unknown_plan += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped {hospital.name}: unknown plan '{payment.plan}'."
                    )
                )
                continue

            if dry_run:
                self.stdout.write(
                    f"Would create {hospital.name}: {plan.name} "
                    f"from payment #{payment.id}."
                )
                created += 1
                continue

            with transaction.atomic():
                HospitalSubscription.objects.create(
                    hospital=hospital,
                    plan=plan,
                    status=HospitalSubscription.STATUS_ACTIVE,
                    started_at=payment.payment_date or timezone.now(),
                    activated_at=payment.payment_date or timezone.now(),
                    next_billing_date=payment.subscription_end,
                    current_monthly_price=plan.monthly_price,
                    current_service_fee=plan.service_fee,
                    currency=plan.currency,
                )
            created += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created {hospital.name}: {plan.name} "
                    f"from payment #{payment.id}."
                )
            )

        mode = "dry run" if dry_run else "completed"
        self.stdout.write(
            self.style.SUCCESS(
                f"Backfill {mode}: created={created}, "
                f"skipped_existing={skipped_existing}, "
                f"skipped_unknown_plan={skipped_unknown_plan}."
            )
        )