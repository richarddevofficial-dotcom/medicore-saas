from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Ward, Room, Bed
from .serializers import WardSerializer, RoomSerializer, BedSerializer

class WardViewSet(viewsets.ModelViewSet):
    queryset = Ward.objects.all()
    serializer_class = WardSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'ward_type']
    ordering_fields = ['name', 'floor']
    
    def perform_create(self, serializer):
        from hospitals.models import Hospital
        serializer.save(hospital=Hospital.objects.first())

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['room_number', 'room_type', 'ward__name']
    ordering_fields = ['room_number', 'ward__name']
    
    def perform_create(self, serializer):
        from hospitals.models import Hospital
        serializer.save(hospital=Hospital.objects.first())
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = Room.objects.count()
        occupied = Room.objects.filter(is_occupied=True).count()
        available = total - occupied
        return Response({
            'total_rooms': total,
            'occupied': occupied,
            'available': available,
        })

class BedViewSet(viewsets.ModelViewSet):
    queryset = Bed.objects.all()
    serializer_class = BedSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['bed_number', 'room__room_number', 'status']
    ordering_fields = ['room__room_number', 'bed_number']
    
    def perform_create(self, serializer):
        from hospitals.models import Hospital
        serializer.save(hospital=Hospital.objects.first())
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        bed = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Bed.BED_STATUS):
            bed.status = new_status
            bed.save()
            return Response(BedSerializer(bed).data)
        return Response({'error': 'Invalid status'}, status=400)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = Bed.objects.count()
        available = Bed.objects.filter(status='available').count()
        occupied = Bed.objects.filter(status='occupied').count()
        reserved = Bed.objects.filter(status='reserved').count()
        return Response({
            'total_beds': total,
            'available': available,
            'occupied': occupied,
            'reserved': reserved,
        })