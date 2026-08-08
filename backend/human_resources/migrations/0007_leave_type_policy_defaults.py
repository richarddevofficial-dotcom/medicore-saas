from django.db import migrations, models


DEFAULT_LEAVE_TYPES = (
    ("Annual Leave", "ANNUAL", 21, "21 days per year", 0, True, "Paid"),
    (
        "Sick Leave",
        "SICK",
        12,
        "12 days per year after 3 months of service",
        3,
        True,
        "Paid",
    ),
    ("Maternity Leave", "MATERNITY", 90, "90 days", 0, True, "Paid"),
    ("Paternity Leave", "PATERNITY", 14, "2 weeks", 0, True, "Paid"),
    (
        "Bereavement / Compassionate Leave",
        "BEREAVEMENT",
        0,
        "Determined by employer policy or agreement",
        0,
        False,
        "Depends on employer policy",
    ),
    (
        "Public Holidays",
        "PUBLIC-HOLIDAY",
        0,
        "According to officially declared public holidays",
        0,
        True,
        "Paid, subject to employment arrangements",
    ),
    (
        "Study Leave",
        "STUDY",
        0,
        "Determined by employer policy or agreement",
        0,
        False,
        "Depends on policy",
    ),
    ("Unpaid Leave", "UNPAID", 0, "As approved by employer", 0, False, "Unpaid"),
    (
        "Marriage / Special Leave",
        "MARRIAGE-SPECIAL",
        0,
        "Determined by employer policy",
        0,
        False,
        "Depends on policy",
    ),
)


def seed_leave_types(apps, schema_editor):
    Hospital = apps.get_model("hospitals", "Hospital")
    LeaveType = apps.get_model("human_resources", "LeaveType")

    for hospital in Hospital.objects.all():
        for (
            name,
            code,
            days,
            description,
            service_months,
            paid,
            payment,
        ) in DEFAULT_LEAVE_TYPES:
            leave_type = LeaveType.objects.filter(
                hospital=hospital,
                code=code,
            ).first()
            if leave_type is None:
                leave_type = LeaveType.objects.filter(
                    hospital=hospital,
                    name__iexact=name,
                ).first()

            if leave_type is None:
                LeaveType.objects.create(
                    hospital=hospital,
                    name=name,
                    code=code,
                    days_allowed=days,
                    entitlement_description=description,
                    minimum_service_months=service_months,
                    is_paid=paid,
                    payment_description=payment,
                    is_active=True,
                )
                continue

            leave_type.entitlement_description = description
            leave_type.days_allowed = days
            leave_type.minimum_service_months = service_months
            leave_type.is_paid = paid
            leave_type.payment_description = payment
            leave_type.save(
                update_fields=(
                    "entitlement_description",
                    "days_allowed",
                    "minimum_service_months",
                    "is_paid",
                    "payment_description",
                )
            )


class Migration(migrations.Migration):
    dependencies = [
        ("human_resources", "0006_shift_clock_in_window"),
    ]

    operations = [
        migrations.AddField(
            model_name="leavetype",
            name="entitlement_description",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="leavetype",
            name="minimum_service_months",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="leavetype",
            name="payment_description",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.RunPython(seed_leave_types, migrations.RunPython.noop),
    ]
