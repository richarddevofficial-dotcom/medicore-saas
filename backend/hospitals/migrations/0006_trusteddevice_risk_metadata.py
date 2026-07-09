from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospitals', '0005_platformsuperadminprofile'),
    ]

    operations = [
        migrations.AddField(
            model_name='trusteddevice',
            name='first_ip',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='trusteddevice',
            name='last_ip',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='trusteddevice',
            name='last_user_agent',
            field=models.CharField(blank=True, max_length=500),
        ),
    ]
