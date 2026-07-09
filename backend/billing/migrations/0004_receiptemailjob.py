from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0003_subscriptionpayment_receipt_delivery_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReceiptEmailJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('sent', 'Sent'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('max_attempts', models.PositiveSmallIntegerField(default=5)),
                ('next_attempt_at', models.DateTimeField(auto_now_add=True)),
                ('locked_at', models.DateTimeField(blank=True, null=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('last_error', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('payment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='receipt_jobs', to='billing.subscriptionpayment')),
            ],
            options={
                'ordering': ['next_attempt_at', 'id'],
            },
        ),
    ]
