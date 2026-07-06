from rest_framework import serializers
from .models import Bill, SubscriptionPayment

class BillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill
        fields = '__all__'
        read_only_fields = ['hospital', 'bill_number', 'total_amount', 'balance', 'created_at', 'updated_at']

class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    
    class Meta:
        model = SubscriptionPayment
        fields = '__all__'
        read_only_fields = ['hospital', 'created_at']
