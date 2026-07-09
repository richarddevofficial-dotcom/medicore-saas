from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from config.plan_permissions import RequiresProPlan
from .models import InsuranceCompany, InsuranceClaim
from .serializers import InsuranceCompanySerializer, InsuranceClaimSerializer


def _resolve_request_hospital(request):
    user = request.user
    if user.is_superuser:
        hospital_id = request.data.get('hospital_id') or request.query_params.get('hospital_id')
        if not hospital_id:
            return None
        from hospitals.models import Hospital
        return Hospital.objects.filter(id=hospital_id).first()

    if hasattr(user, 'staff_profile'):
        return user.staff_profile.hospital
    return None

class InsuranceCompanyViewSet(viewsets.ModelViewSet):
    queryset = InsuranceCompany.objects.all()
    serializer_class = InsuranceCompanySerializer
    permission_classes = [IsAuthenticated, RequiresProPlan]
    pagination_class = None
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'code']

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return InsuranceCompany.objects.all()
        if not hospital:
            return InsuranceCompany.objects.none()
        return InsuranceCompany.objects.filter(hospital=hospital)

    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            raise ValidationError('Hospital context is required')

        code = str(serializer.validated_data.get('code', '')).strip()
        if not code:
            raise ValidationError({'code': 'Insurance company code is required'})
        if InsuranceCompany.objects.filter(hospital=hospital, code__iexact=code).exists():
            raise ValidationError({'code': 'Insurance company with this code already exists in your hospital'})

        serializer.save(hospital=hospital)

    def perform_update(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            hospital = serializer.instance.hospital
        if not hospital:
            raise ValidationError('Hospital context is required')

        code = str(serializer.validated_data.get('code', serializer.instance.code)).strip()
        if not code:
            raise ValidationError({'code': 'Insurance company code is required'})

        duplicate_exists = InsuranceCompany.objects.filter(
            hospital=hospital,
            code__iexact=code,
        ).exclude(id=serializer.instance.id).exists()
        if duplicate_exists:
            raise ValidationError({'code': 'Insurance company with this code already exists in your hospital'})

        serializer.save()

class InsuranceClaimViewSet(viewsets.ModelViewSet):
    queryset = InsuranceClaim.objects.all()
    serializer_class = InsuranceClaimSerializer
    permission_classes = [IsAuthenticated, RequiresProPlan]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['patient_name', 'policy_number', 'company__name']
    ordering_fields = ['submitted_date', 'processed_date', 'claim_amount', 'status']

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return InsuranceClaim.objects.select_related('company').all()
        if not hospital:
            return InsuranceClaim.objects.none()
        return InsuranceClaim.objects.select_related('company').filter(hospital=hospital)

    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            raise ValidationError('Hospital context is required')

        company = serializer.validated_data.get('company')
        if company and company.hospital_id != hospital.id:
            raise ValidationError({'company': 'Selected insurance company does not belong to your hospital'})

        serializer.save(hospital=hospital)

    def perform_update(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            hospital = serializer.instance.hospital
        if not hospital:
            raise ValidationError('Hospital context is required')

        company = serializer.validated_data.get('company', serializer.instance.company)
        if company and company.hospital_id != hospital.id:
            raise ValidationError({'company': 'Selected insurance company does not belong to your hospital'})

        serializer.save()
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        claim = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(InsuranceClaim.STATUS):
            claim.status = new_status
            if new_status == 'approved':
                claim.approved_amount = request.data.get('approved_amount', claim.claim_amount)
            if new_status in {'approved', 'rejected', 'paid'}:
                claim.processed_date = timezone.now().date()
            claim.save()
            return Response(InsuranceClaimSerializer(claim).data)
        return Response({'error': 'Invalid status'}, status=400)