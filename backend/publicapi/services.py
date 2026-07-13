from django.conf import settings
from django.core.mail import send_mail

from departments.models import Department


DEFAULT_DEPARTMENTS = [
    {
        "name": "Administration",
        "code": "ADMIN",
        "description": "Hospital administration and management.",
    },
    {
        "name": "Reception",
        "code": "RECEPTION",
        "description": "Patient registration, appointments and front desk services.",
    },
    {
        "name": "Outpatient Department",
        "code": "OPD",
        "description": "Outpatient consultations and clinical services.",
    },
    {
        "name": "Inpatient Department",
        "code": "IPD",
        "description": "Admissions, wards and inpatient clinical services.",
    },
    {
        "name": "Emergency",
        "code": "EMERGENCY",
        "description": "Emergency and urgent medical services.",
    },
    {
        "name": "Pharmacy",
        "code": "PHARMACY",
        "description": "Medicine inventory, prescriptions and dispensing.",
    },
    {
        "name": "Laboratory",
        "code": "LAB",
        "description": "Laboratory requests, samples and test results.",
    },
    {
        "name": "Imaging and Radiology",
        "code": "IMAGING",
        "description": "Radiology, ultrasound, X-ray and imaging services.",
    },
    {
        "name": "Billing and Cashier",
        "code": "BILLING",
        "description": "Patient billing, cashier services and receipts.",
    },
    {
        "name": "Finance",
        "code": "FINANCE",
        "description": "Accounting, financial reporting and reconciliation.",
    },
    {
        "name": "Human Resources",
        "code": "HR",
        "description": "Staff records and human resource administration.",
    },
    {
        "name": "Nursing",
        "code": "NURSING",
        "description": "Nursing care and patient monitoring.",
    },
]


def seed_default_departments(hospital):
    field_names = {
        field.name
        for field in Department._meta.fields
    }

    if "hospital" not in field_names:
        raise RuntimeError(
            "Department model must contain a hospital field."
        )

    created_departments = []

    for item in DEFAULT_DEPARTMENTS:
        lookup = {
            "hospital": hospital,
        }

        if "name" in field_names:
            lookup["name"] = item["name"]
        elif "department_name" in field_names:
            lookup["department_name"] = item["name"]
        else:
            raise RuntimeError(
                "Department model must contain name or department_name."
            )

        defaults = {}

        if "code" in field_names:
            defaults["code"] = item["code"]

        if "description" in field_names:
            defaults["description"] = item["description"]

        if "is_active" in field_names:
            defaults["is_active"] = True

        if "status" in field_names:
            status_field = Department._meta.get_field("status")
            allowed_values = {
                value
                for value, _label in status_field.choices
            }

            if "active" in allowed_values:
                defaults["status"] = "active"

        department, created = Department.objects.get_or_create(
            **lookup,
            defaults=defaults,
        )

        created_departments.append(
            {
                "id": department.id,
                "name": getattr(
                    department,
                    "name",
                    getattr(
                        department,
                        "department_name",
                        item["name"],
                    ),
                ),
                "created": created,
            }
        )

    return created_departments


def send_hospital_welcome_email(
    *,
    hospital,
    administrator,
    tenant_url,
    login_url,
):
    trial_end = (
        hospital.trial_end.strftime("%d %B %Y")
        if hospital.trial_end
        else "Not available"
    )

    administrator_name = (
        administrator.get_full_name().strip()
        or administrator.username
    )

    subject = f"Welcome to MediCore HMS — {hospital.name}"

    message = (
        f"Hello {administrator_name},\n\n"
        f"Welcome to MediCore HMS.\n\n"
        f"Your hospital workspace has been created successfully.\n\n"
        f"Hospital: {hospital.name}\n"
        f"Administrator email: {administrator.email}\n"
        f"Tenant address: {tenant_url}\n"
        f"Login address: {login_url}\n"
        f"Trial expires: {trial_end}\n\n"
        f"Use the administrator email and the password you created "
        f"during registration to sign in.\n\n"
        f"For security, MediCore will never send your password by email.\n\n"
        f"Support: support@medicorecloud.com\n\n"
        f"Regards,\n"
        f"MediCore HMS Team"
    )

    from_email = getattr(
        settings,
        "DEFAULT_FROM_EMAIL",
        "noreply@medicorecloud.com",
    )

    return send_mail(
        subject=subject,
        message=message,
        from_email=from_email,
        recipient_list=[administrator.email],
        fail_silently=False,
    )
