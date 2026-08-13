from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("human_resources", "0008_backfill_leave_balances"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="leavebalance",
            constraint=models.CheckConstraint(
                condition=models.Q(pending_days__gte=0),
                name="leavebalance_pending_days_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="leavebalance",
            constraint=models.CheckConstraint(
                condition=models.Q(used_days__gte=0),
                name="leavebalance_used_days_non_negative",
            ),
        ),
    ]
