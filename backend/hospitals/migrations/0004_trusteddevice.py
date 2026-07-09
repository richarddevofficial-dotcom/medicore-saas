from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hospitals', '0003_loginotp'),
    ]

    operations = [
        migrations.CreateModel(
            name='TrustedDevice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token_hash', models.CharField(max_length=64, unique=True)),
                ('device_fingerprint', models.CharField(max_length=64)),
                ('issued_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='trusted_devices', to='auth.user')),
            ],
            options={
                'ordering': ['-issued_at'],
            },
        ),
    ]
