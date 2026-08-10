from django.core.management.base import BaseCommand

from saas_billing.models import HospitalSubscription
from saas_billing.services import refresh_subscription_status


class Command(BaseCommand):
    help = "Update subscription statuses from their current billing dates."

    def handle(self, *args, **options):
        counts = {}
        subscriptions = (
            HospitalSubscription.objects
            .select_related("hospital", "plan")
            .order_by("id")
        )

        for subscription in subscriptions.iterator():
            refresh_subscription_status(subscription)
            counts[subscription.status] = counts.get(subscription.status, 0) + 1

        summary = ", ".join(
            f"{status}={count}"
            for status, count in sorted(counts.items())
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Updated {sum(counts.values())} subscriptions"
                + (f": {summary}" if summary else ".")
            )
        )