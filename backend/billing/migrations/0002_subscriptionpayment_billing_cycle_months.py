from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionpayment',
            name='billing_cycle_months',
            field=models.PositiveSmallIntegerField(
                choices=[
                    (1, '1 Month'),
                    (3, '3 Months (Quarterly)'),
                    (4, '4 Months'),
                    (6, '6 Months'),
                    (12, '12 Months (Yearly)'),
                ],
                default=1,
            ),
        ),
    ]
