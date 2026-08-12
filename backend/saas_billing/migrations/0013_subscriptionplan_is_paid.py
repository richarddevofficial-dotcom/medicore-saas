from django.db import migrations, models


def flag_trial_plans_as_free(apps, schema_editor):
    SubscriptionPlan = apps.get_model("saas_billing", "SubscriptionPlan")
    SubscriptionPlan.objects.filter(code="starter").update(is_paid=False)


def revert_trial_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("saas_billing", "SubscriptionPlan")
    SubscriptionPlan.objects.filter(code="starter").update(is_paid=True)


class Migration(migrations.Migration):

    dependencies = [
        ("saas_billing", "0012_enable_starter_trial_features"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionplan",
            name="is_paid",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "Paid plans can be selected for initial invoices and "
                    "plan changes. Free/trial plans (e.g. starter) are excluded."
                ),
            ),
        ),
        migrations.RunPython(flag_trial_plans_as_free, revert_trial_plans),
    ]
