from decimal import Decimal

from django.db import migrations


def correct_legacy_professional_subscription_price(apps, schema_editor):
    HospitalSubscription = apps.get_model(
        "saas_billing",
        "HospitalSubscription",
    )

    HospitalSubscription.objects.filter(
        plan__code__in=["pro", "professional"],
        current_monthly_price=Decimal("99.90"),
    ).update(current_monthly_price=Decimal("89.90"))


class Migration(migrations.Migration):
    dependencies = [
        (
            "saas_billing",
            "0007_update_legacy_professional_plan_price",
        ),
    ]

    operations = [
        migrations.RunPython(
            correct_legacy_professional_subscription_price,
            migrations.RunPython.noop,
        ),
    ]