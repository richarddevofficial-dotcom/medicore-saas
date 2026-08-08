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


def seed_default_leave_types(hospital):
    from .models import LeaveType

    for (
        name,
        code,
        days,
        description,
        service_months,
        paid,
        payment,
    ) in DEFAULT_LEAVE_TYPES:
        LeaveType.objects.get_or_create(
            hospital=hospital,
            code=code,
            defaults={
                "name": name,
                "days_allowed": days,
                "entitlement_description": description,
                "minimum_service_months": service_months,
                "is_paid": paid,
                "payment_description": payment,
            },
        )
