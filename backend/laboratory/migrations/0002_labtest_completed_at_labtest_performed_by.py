from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0002_alter_staffprofile_role'),
        ('laboratory', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='labtest',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='labtest',
            name='performed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='performed_lab_tests',
                to='staff.staffprofile',
            ),
        ),
    ]