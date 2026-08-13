from rest_framework import serializers

from .models import SubscriptionPlan
from .subscription_services import (
    BILLING_CYCLE_ANNUAL,
    BILLING_CYCLE_MONTHLY,
    BILLING_CYCLE_SIX_MONTHS,
    get_cycle_pricing,
)


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    billing_periods = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "code",
            "name",
            "description",
            "currency",
            "monthly_price",
            "six_month_price",
            "annual_price",
            "service_fee",
            "max_staff",
            "max_patients",
            "storage_gb",
            "features",
            "billing_periods",
        ]

    def get_billing_periods(self, plan):
        return [
            self._period_payload(plan, cycle)
            for cycle in (
                BILLING_CYCLE_MONTHLY,
                BILLING_CYCLE_SIX_MONTHS,
                BILLING_CYCLE_ANNUAL,
            )
        ]

    @staticmethod
    def _period_payload(plan, cycle):
        pricing = get_cycle_pricing(plan, cycle)
        return {
            "billing_cycle": cycle,
            "months": pricing["months"],
            "original_amount": str(pricing["original_amount"]),
            "discount_percent": str(pricing["discount_percent"]),
            "discount_amount": str(pricing["discount_amount"]),
            "final_amount": str(pricing["final_amount"]),
        }
