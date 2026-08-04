from decimal import Decimal

from django.db import migrations


def update_legacy_professional_plan_price(apps, schema_editor):
    SubscriptionPlan = apps.get_model("saas_billing", "SubscriptionPlan")

    SubscriptionPlan.objects.filter(code__in=["pro", "professional"]).update(
        monthly_price=Decimal("89.90"),
    )


class Migration(migrations.Migration):
    dependencies = [
        ("saas_billing", "0006_update_subscription_plan_prices"),
    ]

    operations = [
        migrations.RunPython(
            update_legacy_professional_plan_price,
            migrations.RunPython.noop,
        ),
    ]