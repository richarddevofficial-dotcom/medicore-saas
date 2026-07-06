from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.utils import timezone
from django.contrib.auth.models import User
from hospitals.models import Hospital
from patients.models import Patient
from billing.models import Bill
from staff.models import StaffProfile
from rest_framework_simplejwt.tokens import RefreshToken

@api_view(['GET'])
@permission_classes([IsAdminUser])
def super_admin_stats(request):
    """Super admin dashboard stats - all hospitals"""
    total_hospitals = Hospital.objects.count()
    active_hospitals = Hospital.objects.filter(is_active=True).count()
    trial_hospitals = Hospital.objects.filter(subscription_plan='trial').count()
    total_patients = Patient.objects.count()
    total_revenue = sum(float(b.total_amount or 0) for b in Bill.objects.filter(status='paid'))
    
    # Hospital breakdown
    hospitals = []
    for h in Hospital.objects.all():
        hospitals.append({
            'id': h.id,
            'name': h.name,
            'plan': h.subscription_plan,
            'status': 'active' if h.is_active else 'inactive',
            'patients': Patient.objects.filter(hospital=h).count(),
            'revenue': sum(float(b.total_amount or 0) for b in Bill.objects.filter(hospital=h, status='paid')),
            'staff': StaffProfile.objects.filter(hospital=h).count(),
            'days_left': h.days_left,
            'created_at': h.created_at,
        })
    
    return Response({
        'total_hospitals': total_hospitals,
        'active_hospitals': active_hospitals,
        'trial_hospitals': trial_hospitals,
        'total_patients': total_patients,
        'total_revenue': total_revenue,
        'hospitals': hospitals,
    })

@api_view(['POST'])
@permission_classes([IsAdminUser])
def toggle_hospital_status(request):
    """Activate/deactivate a hospital"""
    hospital_id = request.data.get('hospital_id')
    try:
        hospital = Hospital.objects.get(id=hospital_id)
        hospital.is_active = not hospital.is_active
        hospital.subscription_status = 'active' if hospital.is_active else 'inactive'
        hospital.save()

        staff_user_ids = StaffProfile.objects.filter(
            hospital=hospital,
            user__is_superuser=False,
        ).values_list('user_id', flat=True)
        User.objects.filter(id__in=staff_user_ids).update(is_active=hospital.is_active)

        return Response({'status': 'success', 'is_active': hospital.is_active})
    except Hospital.DoesNotExist:
        return Response({'error': 'Hospital not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def update_hospital_plan(request):
    """Update hospital subscription plan"""
    hospital_id = request.data.get('hospital_id')
    plan = request.data.get('plan')
    try:
        hospital = Hospital.objects.get(id=hospital_id)
        hospital.subscription_plan = plan
        hospital.save()
        return Response({'status': 'success', 'plan': plan})
    except Hospital.DoesNotExist:
        return Response({'error': 'Hospital not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def switch_hospital(request):
    """Super admin switches to view a hospital"""
    hospital_id = request.data.get('hospital_id')
    try:
        hospital = Hospital.objects.get(id=hospital_id)
        
        # Generate new token with hospital info
        refresh = RefreshToken.for_user(request.user)
        
        return Response({
            'token': str(refresh.access_token),
            'user': {
                'id': request.user.id,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
                'role': 'admin',  # Acting as hospital admin
                'is_superuser': request.user.is_superuser,
            },
            'hospital': {
                'id': hospital.id,
                'name': hospital.name,
                'slug': hospital.slug if hasattr(hospital, 'slug') else '',
            }
        })
    except Hospital.DoesNotExist:
        return Response({'error': 'Hospital not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def switch_back_to_superadmin(request):
    """Switch back to super admin view"""
    return Response({
        'success': True,
        'message': 'Switched back to super admin view'
    })