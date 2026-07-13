from rest_framework import serializers

from .models import SubscriptionPlan


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "code",
            "name",
            "description",
            "currency",
            "monthly_price",
            "service_fee",
            "max_staff",
            "max_patients",
            "storage_gb",
            "features",
        ]
