from django.db import migrations


STARTER_FEATURES = {
    "imaging": "Imaging",
    "advanced_reports": "Advanced Reports",
    "api_access": "API Access",
}


def enable_starter_trial_features(apps, schema_editor):
    SubscriptionPlan = apps.get_model("saas_billing", "SubscriptionPlan")
    PlanFeature = apps.get_model("saas_billing", "PlanFeature")

    starter = SubscriptionPlan.objects.filter(code="starter").first()
    if not starter:
        return

    for feature_code, feature_name in STARTER_FEATURES.items():
        PlanFeature.objects.update_or_create(
            plan=starter,
            feature_code=feature_code,
            defaults={
                "feature_name": feature_name,
                "is_enabled": True,
                "limit_value": None,
            },
        )


def restore_starter_trial_features(apps, schema_editor):
    SubscriptionPlan = apps.get_model("saas_billing", "SubscriptionPlan")
    PlanFeature = apps.get_model("saas_billing", "PlanFeature")

    starter = SubscriptionPlan.objects.filter(code="starter").first()
    if not starter:
        return

    PlanFeature.objects.filter(
        plan=starter,
        feature_code__in=STARTER_FEATURES,
    ).update(is_enabled=False)


class Migration(migrations.Migration):
    dependencies = [
        ("saas_billing", "0011_payment_rejected_at_payment_rejected_by_and_more"),
    ]

    operations = [
        migrations.RunPython(
            enable_starter_trial_features,
            restore_starter_trial_features,
        ),
    ]
