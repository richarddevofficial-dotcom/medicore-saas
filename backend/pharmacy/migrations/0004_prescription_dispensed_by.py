from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pharmacy', '0003_prescription_medicine'),
    ]

    operations = [
        migrations.AddField(
            model_name='prescription',
            name='dispensed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='dispensed_prescriptions',
                to='staff.staffprofile',
            ),
        ),
    ]