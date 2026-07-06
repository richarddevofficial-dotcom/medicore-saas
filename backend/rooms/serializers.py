from rest_framework import serializers
from .models import Ward, Room, Bed

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
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    
    class Meta:
        model = Bed
        fields = ['id', 'bed_number', 'room', 'room_number', 'bed_type', 'status', 'price_per_day', 'is_active', 'created_at']
        read_only_fields = ['hospital', 'created_at']
