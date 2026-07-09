from django.db import migrations, models
import django.db.models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0004_receiptemailjob'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionpayment',
            name='idempotency_key',
            field=models.CharField(blank=True, db_index=True, max_length=128),
        ),
        migrations.AddConstraint(
            model_name='subscriptionpayment',
            constraint=models.UniqueConstraint(
                condition=~django.db.models.Q(('idempotency_key', '')),
                fields=('hospital', 'idempotency_key'),
                name='uniq_subscription_payment_hospital_idempotency_key',
            ),
        ),
    ]
