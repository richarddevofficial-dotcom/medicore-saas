from rest_framework import serializers
from .models import InsuranceCompany, InsuranceClaim

class InsuranceCompanySerializer(serializers.ModelSerializer):
    claim_count = serializers.SerializerMethodField()
    class Meta:
        model = InsuranceCompany
        fields = '__all__'
        read_only_fields = ['hospital', 'created_at']
    def get_claim_count(self, obj):
        return obj.insuranceclaim_set.count()

class InsuranceClaimSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    class Meta:
        model = InsuranceClaim
        fields = '__all__'
        read_only_fields = ['hospital', 'submitted_date']