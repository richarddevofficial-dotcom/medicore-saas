from django.db import migrations


def backfill_staff_employees(apps, schema_editor):
    Employee = apps.get_model("human_resources", "Employee")
    StaffProfile = apps.get_model("staff", "StaffProfile")

    for staff in StaffProfile.objects.select_related("user").iterator():
        if Employee.objects.filter(user_id=staff.user_id).exists():
            continue

        base_number = f"EMP-{staff.hospital_id}-{staff.user_id:06d}"
        employee_number = base_number
        suffix = 1

        while Employee.objects.filter(
            hospital_id=staff.hospital_id,
            employee_number=employee_number,
        ).exists():
            suffix += 1
            employee_number = f"{base_number}-{suffix}"

        Employee.objects.create(
            hospital_id=staff.hospital_id,
            user_id=staff.user_id,
            employee_number=employee_number,
            first_name=staff.user.first_name,
            last_name=staff.user.last_name,
            email=staff.user.email,
            phone=staff.phone,
            department_id=staff.department_id,
            is_active=staff.is_active,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("human_resources", "0004_alter_employee_bank_account_number_and_more"),
        ("staff", "0002_alter_staffprofile_role"),
    ]

    operations = [
        migrations.RunPython(backfill_staff_employees, migrations.RunPython.noop),
    ]