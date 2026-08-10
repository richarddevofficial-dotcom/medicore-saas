from decimal import Decimal

from django.db import transaction
from django.core.management.base import BaseCommand

from saas_billing.models import PlanFeature, SubscriptionPlan


PLANS = [
    {
        "code": "starter",
        "name": "Starter",
        "description": "14-day free trial with full MediCore access.",
        "monthly_price": Decimal("0.00"),
        "six_month_price": Decimal("0.00"),
        "annual_price": Decimal("0.00"),
        "service_fee": Decimal("0.00"),
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
        "code": "pro",
        "name": "Professional",
        "description": "For growing hospitals with multiple departments.",
        "monthly_price": Decimal("89.90"),
        "six_month_price": Decimal("539.40"),
        "annual_price": Decimal("1078.80"),
        "service_fee": Decimal("500.00"),
        "currency": "USD",
        "max_staff": 100,
        "max_patients": 20000,
        "storage_gb": 50,
        "display_order": 3,
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
            "code": "basic",
            "name": "Basic",
            "description": "For clinics and small healthcare facilities.",
            "monthly_price": Decimal("49.90"),
            "six_month_price": Decimal("299.40"),
            "annual_price": Decimal("598.80"),
            "service_fee": Decimal("300.00"),
            "currency": "USD",
            "max_staff": 20,
            "max_patients": 2000,
            "storage_gb": 10,
            "display_order": 2,
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
        "code": "enterprise",
        "name": "Enterprise",
        "description": "For large hospitals and hospital groups.",
        "monthly_price": Decimal("129.90"),
        "six_month_price": Decimal("779.40"),
        "annual_price": Decimal("1558.80"),
        "service_fee": Decimal("1000.00"),
        "currency": "USD",
        "max_staff": None,
        "max_patients": None,
        "storage_gb": None,
            "display_order": 4,
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

            with transaction.atomic():
                plan = SubscriptionPlan.objects.filter(
                    code=plan_data["code"],
                ).first()
                if not plan:
                    plan = SubscriptionPlan.objects.filter(
                        name__iexact=plan_data["name"],
                    ).first()

                created = plan is None
                if created:
                    plan = SubscriptionPlan.objects.create(**plan_data)
                else:
                    for field, value in plan_data.items():
                        setattr(plan, field, value)
                    plan.save()

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
