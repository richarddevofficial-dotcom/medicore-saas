from django.db import migrations, models
import django.db.models.deletion


def link_prescriptions_to_medicines(apps, schema_editor):
    Prescription = apps.get_model('pharmacy', 'Prescription')
    Medicine = apps.get_model('pharmacy', 'Medicine')

    for prescription in Prescription.objects.filter(medicine__isnull=True).iterator():
        medicine = (
            Medicine.objects.filter(
                hospital_id=prescription.hospital_id,
                name__iexact=prescription.medicine_name,
            )
            .order_by('id')
            .first()
        )
        if medicine:
            prescription.medicine_id = medicine.id
            prescription.save(update_fields=['medicine'])


class Migration(migrations.Migration):

    dependencies = [
        ('pharmacy', '0002_prescription_medicine_amount'),
    ]

    operations = [
        migrations.AddField(
            model_name='prescription',
            name='medicine',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='prescriptions',
                to='pharmacy.medicine',
            ),
        ),
        migrations.RunPython(link_prescriptions_to_medicines, migrations.RunPython.noop),
    ]