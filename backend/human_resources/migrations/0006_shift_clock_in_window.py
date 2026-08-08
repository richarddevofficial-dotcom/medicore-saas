from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("human_resources", "0005_backfill_staff_employees"),
    ]

    operations = [
        migrations.AddField(
            model_name="shift",
            name="clock_in_early_minutes",
            field=models.PositiveIntegerField(default=60),
        ),
        migrations.AddField(
            model_name="shift",
            name="clock_in_close_minutes",
            field=models.PositiveIntegerField(default=240),
        ),
    ]
