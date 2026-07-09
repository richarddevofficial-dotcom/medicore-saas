from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hospitals', '0004_trusteddevice'),
    ]

    operations = [
        migrations.CreateModel(
            name='PlatformSuperAdminProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('admin_type', models.CharField(choices=[('primary', 'Primary'), ('secondary', 'Secondary')], default='secondary', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='platform_super_admin_profile', to='auth.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
