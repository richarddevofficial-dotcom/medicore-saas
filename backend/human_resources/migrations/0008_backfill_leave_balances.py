from django.db import migrations
from django.utils import timezone


def backfill_leave_balances(apps, schema_editor):
    Employee = apps.get_model("human_resources", "Employee")
    LeaveBalance = apps.get_model("human_resources", "LeaveBalance")
    LeaveType = apps.get_model("human_resources", "LeaveType")
    year = timezone.localdate().year

    leave_types_by_hospital = {}
    for leave_type in LeaveType.objects.filter(
        is_active=True,
        days_allowed__gt=0,
    ):
        leave_types_by_hospital.setdefault(leave_type.hospital_id, []).append(
            leave_type
        )

    balances = []
    for employee in Employee.objects.filter(is_active=True).iterator():
        for leave_type in leave_types_by_hospital.get(employee.hospital_id, []):
            balances.append(
                LeaveBalance(
                    employee_id=employee.id,
                    leave_type_id=leave_type.id,
                    year=year,
                    allocated_days=leave_type.days_allowed,
                )
            )

    LeaveBalance.objects.bulk_create(balances, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [
        ("human_resources", "0007_leave_type_policy_defaults"),
    ]

    operations = [
        migrations.RunPython(backfill_leave_balances, migrations.RunPython.noop),
    ]
