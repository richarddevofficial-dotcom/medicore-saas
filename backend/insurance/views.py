from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import InsuranceCompany, InsuranceClaim
from .serializers import InsuranceCompanySerializer, InsuranceClaimSerializer

class InsuranceCompanyViewSet(viewsets.ModelViewSet):
    queryset = InsuranceCompany.objects.all()
    serializer_class = InsuranceCompanySerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'code']
    def perform_create(self, serializer):
        from hospitals.models import Hospital
        serializer.save(hospital=Hospital.objects.first())

class InsuranceClaimViewSet(viewsets.ModelViewSet):
    queryset = InsuranceClaim.objects.all()
    serializer_class = InsuranceClaimSerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['patient_name', 'policy_number', 'company__name']
    def perform_create(self, serializer):
        from hospitals.models import Hospital
        serializer.save(hospital=Hospital.objects.first())
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        claim = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(InsuranceClaim.STATUS):
            claim.status = new_status
            if new_status == 'approved':
                claim.approved_amount = request.data.get('approved_amount', claim.claim_amount)
            claim.save()
            return Response(InsuranceClaimSerializer(claim).data)
        return Response({'error': 'Invalid status'}, status=400)