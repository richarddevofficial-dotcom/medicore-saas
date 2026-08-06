from datetime import datetime, time

from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


def backfill_bill_payments(apps, schema_editor):
    Bill = apps.get_model('billing', 'Bill')
    BillPayment = apps.get_model('billing', 'BillPayment')

    payments = []
    for bill in Bill.objects.filter(amount_paid__gt=0).iterator():
        payment_day = bill.payment_date or bill.created_at.date()
        received_at = timezone.make_aware(datetime.combine(payment_day, time.min))
        payments.append(
            BillPayment(
                bill_id=bill.id,
                hospital_id=bill.hospital_id,
                amount=bill.amount_paid,
                payment_method=bill.payment_method or 'cash',
                received_at=received_at,
            )
        )
    BillPayment.objects.bulk_create(payments, batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('billing', '0008_bill_imaging_fee_alter_servicecatalog_service_type'),
    ]

    operations = [
        migrations.CreateModel(
            name='BillPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('payment_method', models.CharField(default='cash', max_length=20)),
                ('received_at', models.DateTimeField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('bill', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='payments', to='billing.bill')),
                ('hospital', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='bill_payments', to='hospitals.hospital')),
                ('received_by', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='recorded_bill_payments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-received_at', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='billpayment',
            index=models.Index(fields=['hospital', 'received_at'], name='billing_bil_hospita_231457_idx'),
        ),
        migrations.AddIndex(
            model_name='billpayment',
            index=models.Index(fields=['bill', 'received_at'], name='billing_bil_bill_id_535e01_idx'),
        ),
        migrations.RunPython(backfill_bill_payments, migrations.RunPython.noop),
    ]