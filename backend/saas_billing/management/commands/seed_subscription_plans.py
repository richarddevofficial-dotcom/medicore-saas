from decimal import Decimal

from django.core.management.base import BaseCommand

from saas_billing.models import PlanFeature, SubscriptionPlan


PLANS = [
    {
        "code": "starter",
        "name": "Starter",
        "description": "For clinics and small healthcare facilities.",
        "monthly_price": Decimal("99.90"),
        "service_fee": Decimal("300.00"),
        "currency": "USD",
        "max_staff": 20,
        "max_patients": 2000,
        "storage_gb": 10,
        "display_order": 1,
        "features": [
            ("patient_management", "Patient Management", True, 2000),
            ("appointments", "Appointments", True, None),
            ("pharmacy", "Pharmacy", True, None),
            ("laboratory", "Laboratory", True, None),
            ("imaging", "Imaging", False, None),
            ("advanced_reports", "Advanced Reports", False, None),
            ("api_access", "API Access", False, None),
        ],
    },
    {
        "code": "professional",
        "name": "Professional",
        "description": "For growing hospitals with multiple departments.",
        "monthly_price": Decimal("149.90"),
        "service_fee": Decimal("500.00"),
        "currency": "USD",
        "max_staff": 100,
        "max_patients": 20000,
        "storage_gb": 50,
        "display_order": 2,
        "features": [
            ("patient_management", "Patient Management", True, 20000),
            ("appointments", "Appointments", True, None),
            ("pharmacy", "Pharmacy", True, None),
            ("laboratory", "Laboratory", True, None),
            ("imaging", "Imaging", True, None),
            ("advanced_reports", "Advanced Reports", True, None),
            ("api_access", "API Access", True, None),
        ],
    },
    {
        "code": "enterprise",
        "name": "Enterprise",
        "description": "For large hospitals and hospital groups.",
        "monthly_price": Decimal("249.90"),
        "service_fee": Decimal("1000.00"),
        "currency": "USD",
        "max_staff": None,
        "max_patients": None,
        "storage_gb": None,
        "display_order": 3,
        "features": [
            ("patient_management", "Patient Management", True, None),
            ("appointments", "Appointments", True, None),
            ("pharmacy", "Pharmacy", True, None),
            ("laboratory", "Laboratory", True, None),
            ("imaging", "Imaging", True, None),
            ("advanced_reports", "Advanced Reports", True, None),
            ("api_access", "API Access", True, None),
            ("priority_support", "Priority Support", True, None),
            ("custom_integrations", "Custom Integrations", True, None),
        ],
    },
]


class Command(BaseCommand):
    help = "Create or update MediCore subscription plans."

    def handle(self, *args, **options):
        for source_plan_data in PLANS:
            plan_data = source_plan_data.copy()
            feature_data = plan_data.pop("features")

            plan, created = SubscriptionPlan.objects.update_or_create(
                code=plan_data["code"],
                defaults=plan_data,
            )

            for feature_code, feature_name, enabled, limit_value in feature_data:
                PlanFeature.objects.update_or_create(
                    plan=plan,
                    feature_code=feature_code,
                    defaults={
                        "feature_name": feature_name,
                        "is_enabled": enabled,
                        "limit_value": limit_value,
                    },
                )

            action = "Created" if created else "Updated"

            self.stdout.write(
                self.style.SUCCESS(
                    f"{action}: {plan.name} "
                    f"(${plan.monthly_price}/month, "
                    f"${plan.service_fee} service fee)"
                )
            )
