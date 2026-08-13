from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from config.plan_permissions import RequiresProPlan
from config.audit_logger import AuditLogger
from finance.accounting_permissions import IsFinanceManager
from .models import InsuranceCompany, InsuranceClaim
from .serializers import InsuranceCompanySerializer, InsuranceClaimSerializer


ALLOWED_CLAIM_TRANSITIONS = {
    'pending': {'approved', 'rejected'},
    'approved': {'paid', 'rejected'},
    'rejected': set(),
    'paid': set(),
}


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

    def perform_destroy(self, instance):
        if instance.status != 'pending':
            raise ValidationError(
                'Only pending claims can be deleted. Approved, rejected, or '
                'paid claims are financial records and must be retained.'
            )
        instance.delete()

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated, RequiresProPlan, IsFinanceManager],
    )
    def update_status(self, request, pk=None):
        new_status = request.data.get('status')
        if new_status not in dict(InsuranceClaim.STATUS):
            return Response({'error': 'Invalid status'}, status=400)

        with transaction.atomic():
            claim = (
                InsuranceClaim.objects
                .select_for_update()
                .get(pk=self.get_object().pk)
            )

            allowed = ALLOWED_CLAIM_TRANSITIONS.get(claim.status, set())
            if new_status not in allowed:
                return Response(
                    {
                        'error': (
                            f"Cannot change claim from '{claim.status}' "
                            f"to '{new_status}'."
                        )
                    },
                    status=400,
                )

            if new_status == 'approved':
                try:
                    approved_amount = request.data.get(
                        'approved_amount',
                        claim.claim_amount,
                    )
                    approved_amount = round(float(approved_amount), 2)
                except (TypeError, ValueError):
                    return Response(
                        {'error': 'approved_amount must be a valid number.'},
                        status=400,
                    )
                if approved_amount <= 0 or approved_amount > float(claim.claim_amount):
                    return Response(
                        {
                            'error': (
                                'approved_amount must be greater than 0 and '
                                f'no more than the claim amount ({claim.claim_amount}).'
                            )
                        },
                        status=400,
                    )
                claim.approved_amount = approved_amount

            old_status = claim.status
            claim.status = new_status
            if new_status in {'approved', 'rejected', 'paid'}:
                claim.processed_date = timezone.now().date()
            claim.save()

        AuditLogger.log_audit(
            user=request.user,
            action=f"INSURANCE_CLAIM_{new_status.upper()}",
            target=f"insurance_claim:{claim.id}",
            hospital=claim.hospital,
            old_values={'status': old_status},
            new_values={
                'status': new_status,
                'claim_amount': str(claim.claim_amount),
                'approved_amount': str(claim.approved_amount),
            },
            request=request,
        )

        return Response(InsuranceClaimSerializer(claim).data)