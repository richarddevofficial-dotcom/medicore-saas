from rest_framework import serializers
from .models import Bill, SubscriptionPayment, ServiceCatalog, POSReceipt


class ServiceCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCatalog
        fields = '__all__'
        read_only_fields = ['hospital', 'created_at', 'updated_at']

class BillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill
        fields = '__all__'
        read_only_fields = ['hospital', 'bill_number', 'total_amount', 'balance', 'created_at', 'updated_at']

class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)

    def validate_billing_cycle_months(self, value):
        allowed_cycles = {1, 3, 4, 6, 12}
        if value not in allowed_cycles:
            raise serializers.ValidationError(
                "billing_cycle_months must be one of: 1, 3, 4, 6, 12"
            )
        return value
    
    class Meta:
        model = SubscriptionPayment
        fields = '__all__'
        read_only_fields = ['hospital', 'created_at']
        extra_kwargs = {
            'idempotency_key': {'required': False, 'allow_blank': True},
        }


class POSReceiptSerializer(serializers.ModelSerializer):
    medicine_id = serializers.IntegerField(write_only=True, required=True)
    medicine_name = serializers.CharField(source='medicine_name_snapshot', read_only=True)

    class Meta:
        model = POSReceipt
        fields = '__all__'
        read_only_fields = [
            'hospital',
            'receipt_number',
            'total_amount',
            'cashier_name',
            'created_by',
            'created_at',
            'medicine',
            'medicine_name_snapshot',
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError('Unit price cannot be negative.')
        return value
