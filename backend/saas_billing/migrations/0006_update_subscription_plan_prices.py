from decimal import Decimal

from django.db import migrations


def update_subscription_plan_prices(apps, schema_editor):
    SubscriptionPlan = apps.get_model("saas_billing", "SubscriptionPlan")

    for code, monthly_price in {
        "starter": Decimal("49.90"),
        "professional": Decimal("89.90"),
        "enterprise": Decimal("129.90"),
    }.items():
        SubscriptionPlan.objects.filter(code=code).update(monthly_price=monthly_price)


class Migration(migrations.Migration):
    dependencies = [
        ("saas_billing", "0005_payment_receipt_delivery_status_and_more"),
    ]

    operations = [
        migrations.RunPython(
            update_subscription_plan_prices,
            migrations.RunPython.noop,
        ),
    ]