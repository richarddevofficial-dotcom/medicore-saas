from rest_framework import viewsets, filters
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db import IntegrityError
from django.db.models import Count, Q
from django.utils import timezone

from .models import Ward, Room, Bed, BedAssignment
from .serializers import WardSerializer, RoomSerializer, BedSerializer, BedAssignmentSerializer


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


def _sync_room_occupancy(room):
    room.is_occupied = room.beds.filter(status='occupied').exists()
    room.save(update_fields=['is_occupied'])


def _get_staff_profile(user):
    return getattr(user, 'staff_profile', None)


def _assert_bed_workflow_permission(user):
    if user.is_superuser:
        return
    staff = _get_staff_profile(user)
    if not staff:
        raise ValidationError({'error': 'User has no staff profile'})
    if staff.role not in {'admin', 'doctor', 'nurse', 'receptionist'}:
        raise ValidationError({'error': 'You do not have permission for bed assignment actions'})

class WardViewSet(viewsets.ModelViewSet):
    queryset = Ward.objects.select_related('hospital').all()
    serializer_class = WardSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'ward_type']
    ordering_fields = ['name', 'floor']

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return Ward.objects.all()
        if not hospital:
            return Ward.objects.none()
        return Ward.objects.filter(hospital=hospital)
    
    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            raise ValidationError('Hospital context is required')

        name = str(serializer.validated_data.get('name', '')).strip()
        if Ward.objects.filter(hospital=hospital, name__iexact=name).exists():
            raise ValidationError({'name': 'Ward with this name already exists in your hospital'})

        try:
            serializer.save(hospital=hospital)
        except IntegrityError:
            raise ValidationError({'name': 'Ward with this name already exists in your hospital'})

    def perform_update(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            hospital = serializer.instance.hospital
        if not hospital:
            raise ValidationError('Hospital context is required')

        name = str(serializer.validated_data.get('name', serializer.instance.name)).strip()
        duplicate_exists = Ward.objects.filter(
            hospital=hospital,
            name__iexact=name,
        ).exclude(id=serializer.instance.id).exists()
        if duplicate_exists:
            raise ValidationError({'name': 'Ward with this name already exists in your hospital'})

        try:
            serializer.save()
        except IntegrityError:
            raise ValidationError({'name': 'Ward with this name already exists in your hospital'})

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.select_related('hospital', 'ward').all()
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['room_number', 'room_type', 'ward__name']
    ordering_fields = ['room_number', 'ward__name']

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return Room.objects.all()
        if not hospital:
            return Room.objects.none()
        return Room.objects.filter(hospital=hospital)
    
    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            raise ValidationError('Hospital context is required')

        ward = serializer.validated_data.get('ward')
        if ward and ward.hospital_id != hospital.id:
            raise ValidationError({'ward': 'Selected ward does not belong to your hospital'})

        serializer.save(hospital=hospital)

    def perform_update(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            hospital = serializer.instance.hospital
        if not hospital:
            raise ValidationError('Hospital context is required')

        ward = serializer.validated_data.get('ward')
        if ward and ward.hospital_id != hospital.id:
            raise ValidationError({'ward': 'Selected ward does not belong to your hospital'})

        serializer.save()

    def perform_destroy(self, instance):
        if instance.beds.exists():
            raise ValidationError({'room': 'Cannot delete room with existing beds'})
        super().perform_destroy(instance)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        queryset = self.get_queryset()
        total = queryset.count()
        occupied = queryset.filter(is_occupied=True).count()
        available = total - occupied
        return Response({
            'total_rooms': total,
            'occupied': occupied,
            'available': available,
        })

class BedViewSet(viewsets.ModelViewSet):
    queryset = Bed.objects.select_related('hospital', 'room').all()
    serializer_class = BedSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['bed_number', 'room__room_number', 'status']
    ordering_fields = ['room__room_number', 'bed_number']

    def get_queryset(self):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            return Bed.objects.all()
        if not hospital:
            return Bed.objects.none()
        return Bed.objects.filter(hospital=hospital)
    
    def perform_create(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if not hospital:
            raise ValidationError('Hospital context is required')

        room = serializer.validated_data.get('room')
        if room and room.hospital_id != hospital.id:
            raise ValidationError({'room': 'Selected room does not belong to your hospital'})

        bed = serializer.save(hospital=hospital)
        _sync_room_occupancy(bed.room)

    def perform_update(self, serializer):
        hospital = _resolve_request_hospital(self.request)
        if self.request.user.is_superuser and not hospital:
            hospital = serializer.instance.hospital
        if not hospital:
            raise ValidationError('Hospital context is required')

        previous_room = serializer.instance.room
        room = serializer.validated_data.get('room', previous_room)
        if room and room.hospital_id != hospital.id:
            raise ValidationError({'room': 'Selected room does not belong to your hospital'})

        bed = serializer.save()
        _sync_room_occupancy(bed.room)
        if previous_room_id := getattr(previous_room, 'id', None):
            if previous_room_id != bed.room_id:
                _sync_room_occupancy(previous_room)

    def perform_destroy(self, instance):
        room = instance.room
        super().perform_destroy(instance)
        _sync_room_occupancy(room)

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        _assert_bed_workflow_permission(request.user)

        bed = self.get_object()
        hospital = bed.hospital
        patient_id = request.data.get('patient_id')
        notes = str(request.data.get('notes', '')).strip()

        if not patient_id:
            return Response({'error': 'patient_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        from patients.models import Patient

        try:
            patient = Patient.objects.get(id=patient_id, hospital=hospital)
        except Patient.DoesNotExist:
            return Response({'error': 'Patient not found in your hospital'}, status=status.HTTP_404_NOT_FOUND)

        if bed.status in {'maintenance', 'cleaning'}:
            return Response({'error': 'Bed is not assignable in current status'}, status=status.HTTP_400_BAD_REQUEST)

        staff = _get_staff_profile(request.user)

        try:
            with transaction.atomic():
                bed = Bed.objects.select_for_update().get(id=bed.id)

                if BedAssignment.objects.filter(bed=bed, released_at__isnull=True).exists():
                    return Response({'error': 'Bed already has an active assignment'}, status=status.HTTP_400_BAD_REQUEST)

                if BedAssignment.objects.filter(patient=patient, released_at__isnull=True).exists():
                    return Response({'error': 'Patient already has an active bed assignment'}, status=status.HTTP_400_BAD_REQUEST)

                assignment = BedAssignment.objects.create(
                    hospital=hospital,
                    patient=patient,
                    bed=bed,
                    notes=notes,
                    assigned_by=staff,
                    status='active',
                )

                bed.status = 'occupied'
                bed.save(update_fields=['status'])
                _sync_room_occupancy(bed.room)

                if patient.status != 'admitted':
                    patient.status = 'admitted'
                    patient.save(update_fields=['status'])
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BedAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        _assert_bed_workflow_permission(request.user)

        bed = self.get_object()
        release_reason = str(request.data.get('release_reason', '')).strip()
        next_status = str(request.data.get('next_status', 'available')).strip() or 'available'

        if next_status not in {'available', 'cleaning', 'maintenance'}:
            return Response({'error': 'Invalid next_status'}, status=status.HTTP_400_BAD_REQUEST)

        staff = _get_staff_profile(request.user)

        with transaction.atomic():
            bed = Bed.objects.select_for_update().get(id=bed.id)
            assignment = (
                BedAssignment.objects.select_for_update()
                .select_related('patient')
                .filter(bed=bed, released_at__isnull=True)
                .first()
            )
            if not assignment:
                return Response({'error': 'No active assignment for this bed'}, status=status.HTTP_400_BAD_REQUEST)

            assignment.status = 'released'
            assignment.release_reason = release_reason
            assignment.released_at = timezone.now()
            assignment.released_by = staff
            assignment.save(update_fields=['status', 'release_reason', 'released_at', 'released_by'])

            bed.status = next_status
            bed.save(update_fields=['status'])
            _sync_room_occupancy(bed.room)

            patient = assignment.patient
            if patient.status == 'admitted':
                patient.status = 'discharged'
                patient.save(update_fields=['status'])

        return Response(BedAssignmentSerializer(assignment).data)

    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        _assert_bed_workflow_permission(request.user)

        source_bed = self.get_object()
        target_bed_id = request.data.get('target_bed_id')
        notes = str(request.data.get('notes', '')).strip()

        if not target_bed_id:
            return Response({'error': 'target_bed_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        staff = _get_staff_profile(request.user)

        with transaction.atomic():
            source_bed = Bed.objects.select_for_update().get(id=source_bed.id)
            source_assignment = (
                BedAssignment.objects.select_for_update()
                .select_related('patient')
                .filter(bed=source_bed, released_at__isnull=True)
                .first()
            )
            if not source_assignment:
                return Response({'error': 'Source bed has no active assignment'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                target_bed = Bed.objects.select_for_update().get(id=target_bed_id)
            except Bed.DoesNotExist:
                return Response({'error': 'Target bed not found'}, status=status.HTTP_404_NOT_FOUND)

            if target_bed.hospital_id != source_bed.hospital_id:
                return Response({'error': 'Target bed must belong to same hospital'}, status=status.HTTP_400_BAD_REQUEST)

            if target_bed.status in {'occupied', 'maintenance', 'cleaning'}:
                return Response({'error': 'Target bed is not available for transfer'}, status=status.HTTP_400_BAD_REQUEST)

            if BedAssignment.objects.filter(bed=target_bed, released_at__isnull=True).exists():
                return Response({'error': 'Target bed already has an active assignment'}, status=status.HTTP_400_BAD_REQUEST)

            source_assignment.status = 'transferred'
            source_assignment.release_reason = (
                f"Transferred to bed {target_bed.bed_number}. {notes}".strip()
            )
            source_assignment.released_at = timezone.now()
            source_assignment.released_by = staff
            source_assignment.save(update_fields=['status', 'release_reason', 'released_at', 'released_by'])

            new_assignment = BedAssignment.objects.create(
                hospital=source_bed.hospital,
                patient=source_assignment.patient,
                bed=target_bed,
                transfer_from=source_assignment,
                notes=notes,
                assigned_by=staff,
                status='active',
            )

            source_bed.status = 'cleaning'
            source_bed.save(update_fields=['status'])
            target_bed.status = 'occupied'
            target_bed.save(update_fields=['status'])

            _sync_room_occupancy(source_bed.room)
            if source_bed.room_id != target_bed.room_id:
                _sync_room_occupancy(target_bed.room)

        return Response(BedAssignmentSerializer(new_assignment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def assignments(self, request):
        queryset = self.get_queryset()
        bed_ids = queryset.values_list('id', flat=True)

        assignments_qs = BedAssignment.objects.select_related('bed__room', 'patient').filter(bed_id__in=bed_ids)
        active_only = str(request.query_params.get('active_only', '')).lower() in {'1', 'true', 'yes'}
        if active_only:
            assignments_qs = assignments_qs.filter(released_at__isnull=True)

        data = BedAssignmentSerializer(assignments_qs[:200], many=True).data
        return Response(data)

    @action(detail=False, methods=['get'])
    def occupancy_analytics(self, request):
        queryset = self.get_queryset()
        bed_ids = list(queryset.values_list('id', flat=True))

        total = len(bed_ids)
        occupied = queryset.filter(status='occupied').count()
        available = queryset.filter(status='available').count()
        reserved = queryset.filter(status='reserved').count()
        maintenance = queryset.filter(status__in=['maintenance', 'cleaning']).count()

        bed_assignments = BedAssignment.objects.filter(bed_id__in=bed_ids)
        active_assignments = bed_assignments.filter(released_at__isnull=True).count()
        transferred_today = bed_assignments.filter(
            status='transferred',
            released_at__date=timezone.now().date(),
        ).count()

        ward_breakdown = list(
            Ward.objects.filter(rooms__beds__id__in=bed_ids)
            .annotate(
                total_beds=Count('rooms__beds', distinct=True),
                occupied_beds=Count('rooms__beds', filter=Q(rooms__beds__status='occupied'), distinct=True),
                available_beds=Count('rooms__beds', filter=Q(rooms__beds__status='available'), distinct=True),
            )
            .values('id', 'name', 'total_beds', 'occupied_beds', 'available_beds')
            .order_by('name')
        )

        occupancy_rate = round((occupied / total) * 100, 2) if total else 0

        return Response(
            {
                'summary': {
                    'total_beds': total,
                    'occupied': occupied,
                    'available': available,
                    'reserved': reserved,
                    'maintenance_or_cleaning': maintenance,
                    'active_assignments': active_assignments,
                    'transferred_today': transferred_today,
                    'occupancy_rate': occupancy_rate,
                },
                'ward_breakdown': ward_breakdown,
            }
        )
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        bed = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Bed.BED_STATUS):
            bed.status = new_status
            bed.save()
            _sync_room_occupancy(bed.room)
            return Response(BedSerializer(bed).data)
        return Response({'error': 'Invalid status'}, status=400)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        queryset = self.get_queryset()
        total = queryset.count()
        available = queryset.filter(status='available').count()
        occupied = queryset.filter(status='occupied').count()
        reserved = queryset.filter(status='reserved').count()
        return Response({
            'total_beds': total,
            'available': available,
            'occupied': occupied,
            'reserved': reserved,
        })