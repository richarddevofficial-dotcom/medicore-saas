from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('imaging', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='imagingtest',
            name='completed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='completed_imaging_tests',
                to='staff.staffprofile',
            ),
        ),
    ]