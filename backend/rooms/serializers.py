from rest_framework import serializers
from .models import Ward, Room, Bed, BedAssignment

class WardSerializer(serializers.ModelSerializer):
    room_count = serializers.SerializerMethodField()
    rooms = serializers.SerializerMethodField()
    
    class Meta:
        model = Ward
        fields = ['id', 'name', 'ward_type', 'department', 'floor', 'description', 'is_active', 'room_count', 'rooms', 'created_at']
        read_only_fields = ['hospital', 'created_at']
    
    def get_room_count(self, obj):
        return obj.rooms.count()
    
    def get_rooms(self, obj):
        from .serializers import RoomSerializer
        return RoomSerializer(obj.rooms.all(), many=True).data

class RoomSerializer(serializers.ModelSerializer):
    ward_name = serializers.CharField(source='ward.name', read_only=True)
    beds = serializers.SerializerMethodField()
    
    class Meta:
        model = Room
        fields = ['id', 'room_number', 'ward', 'ward_name', 'room_type', 'floor', 'capacity', 'price_per_day', 'is_occupied', 'is_active', 'beds', 'created_at']
        read_only_fields = ['hospital', 'created_at', 'is_occupied']
    
    def get_beds(self, obj):
        return BedSerializer(obj.beds.all(), many=True).data

class BedSerializer(serializers.ModelSerializer):
    room_number = serializers.SerializerMethodField()
    active_assignment = serializers.SerializerMethodField()
    
    class Meta:
        model = Bed
        fields = [
            'id',
            'bed_number',
            'room',
            'room_number',
            'bed_type',
            'status',
            'price_per_day',
            'is_active',
            'active_assignment',
            'created_at',
        ]
        read_only_fields = ['hospital', 'created_at']

    def get_room_number(self, obj):
        room = getattr(obj, 'room', None)
        return getattr(room, 'room_number', None)

    def get_active_assignment(self, obj):
        assignment = obj.assignments.filter(released_at__isnull=True).select_related('patient').first()
        if not assignment:
            return None
        patient = assignment.patient
        if not patient:
            return None
        return {
            'id': assignment.id,
            'patient_id': patient.id,
            'patient_mrn': patient.mrn,
            'patient_name': f"{patient.first_name} {patient.last_name}".strip(),
            'assigned_at': assignment.assigned_at,
            'status': assignment.status,
        }


class BedAssignmentSerializer(serializers.ModelSerializer):
    bed_number = serializers.CharField(source='bed.bed_number', read_only=True)
    room_number = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    patient_mrn = serializers.CharField(source='patient.mrn', read_only=True)

    class Meta:
        model = BedAssignment
        fields = [
            'id',
            'hospital',
            'patient',
            'patient_name',
            'patient_mrn',
            'bed',
            'bed_number',
            'room_number',
            'status',
            'notes',
            'release_reason',
            'assigned_by',
            'released_by',
            'transfer_from',
            'assigned_at',
            'released_at',
        ]
        read_only_fields = [
            'hospital',
            'assigned_by',
            'released_by',
            'assigned_at',
            'released_at',
            'status',
        ]

    def get_room_number(self, obj):
        bed = getattr(obj, 'bed', None)
        room = getattr(bed, 'room', None)
        return getattr(room, 'room_number', None)

    def get_patient_name(self, obj):
        patient = obj.patient
        if not patient:
            return ''
        return f"{patient.first_name} {patient.last_name}".strip()
