from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0002_subscriptionpayment_billing_cycle_months'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionpayment',
            name='receipt_delivery_status',
            field=models.CharField(
                choices=[
                    ('not_sent', 'Not Sent'),
                    ('queued', 'Queued'),
                    ('sent', 'Sent'),
                    ('failed', 'Failed'),
                ],
                default='not_sent',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='subscriptionpayment',
            name='receipt_last_attempt_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='subscriptionpayment',
            name='receipt_last_error',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='subscriptionpayment',
            name='receipt_sent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
