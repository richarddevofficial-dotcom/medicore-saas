from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0005_alter_salarypayment_salary_slip'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payrollyear',
            name='year',
            field=models.IntegerField(),
        ),
    ]
