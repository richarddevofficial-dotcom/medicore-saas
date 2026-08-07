from decimal import Decimal

from django.db import migrations


def separate_starter_trial_from_basic_plan(apps, schema_editor):
    SubscriptionPlan = apps.get_model("saas_billing", "SubscriptionPlan")
    HospitalSubscription = apps.get_model(
        "saas_billing",
        "HospitalSubscription",
    )
    Hospital = apps.get_model("hospitals", "Hospital")

    starter = SubscriptionPlan.objects.filter(code="starter").first()
    if not starter:
        return

    basic, _ = SubscriptionPlan.objects.update_or_create(
        code="basic",
        defaults={
            "name": "Basic",
            "description": "For clinics and small healthcare facilities.",
            "currency": "USD",
            "monthly_price": Decimal("49.90"),
            "service_fee": Decimal("300.00"),
            "max_staff": 20,
            "max_patients": 2000,
            "storage_gb": 10,
            "features": [
                "Patient Management",
                "Appointments",
                "Pharmacy",
                "Laboratory",
            ],
            "display_order": 2,
            "is_active": True,
        },
    )

    HospitalSubscription.objects.filter(
        plan=starter,
        status="active",
    ).update(plan=basic)
    Hospital.objects.filter(
        saas_subscription__plan=basic,
    ).update(
        subscription_plan="basic",
        max_staff=basic.max_staff,
        max_patients=basic.max_patients,
    )

    HospitalSubscription.objects.filter(
        plan=starter,
        status="trial",
    ).update(
        current_monthly_price=Decimal("0.00"),
        current_service_fee=Decimal("0.00"),
    )
    Hospital.objects.filter(
        saas_subscription__plan=starter,
        saas_subscription__status="trial",
    ).update(subscription_plan="trial")

    SubscriptionPlan.objects.filter(pk=starter.pk).update(
        name="Starter",
        description="14-day free trial with full MediCore access.",
        monthly_price=Decimal("0.00"),
        service_fee=Decimal("0.00"),
        display_order=1,
    )
    SubscriptionPlan.objects.filter(code="pro").update(display_order=3)
    SubscriptionPlan.objects.filter(code="enterprise").update(display_order=4)


class Migration(migrations.Migration):
    dependencies = [
        (
            "saas_billing",
            "0008_correct_legacy_professional_subscription_price",
        ),
    ]

    operations = [
        migrations.RunPython(
            separate_starter_trial_from_basic_plan,
            migrations.RunPython.noop,
        ),
    ]
