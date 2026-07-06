from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from hospitals.views import HospitalViewSet
from patients.views import PatientViewSet
from staff.views import StaffViewSet
from departments.views import DepartmentViewSet
from rooms.views import WardViewSet, RoomViewSet, BedViewSet
from pharmacy.views import MedicineViewSet, PrescriptionViewSet
from appointments.views import AppointmentViewSet
from billing.views import BillViewSet, SubscriptionPaymentViewSet
from insurance.views import InsuranceCompanyViewSet, InsuranceClaimViewSet
from imaging.views import ImagingTestViewSet
from reports.views import (
    dashboard_report, staff_report, reception_report, 
    cashier_report, pharmacy_report, lab_report, 
    detailed_report, dashboard_charts
)
from hospitals.models import Hospital
from hospitals.serializers import HospitalSerializer
from config.superadmin_views import (
    super_admin_stats, 
    toggle_hospital_status, 
    update_hospital_plan,
    switch_hospital,
    switch_back_to_superadmin
)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get('email', '')
    phone = request.data.get('phone', '')
    password = request.data.get('password', '')
    
    from django.contrib.auth.models import User
    from staff.models import StaffProfile
    
    user = None
    if email:
        # Try authenticating with email directly
        user = authenticate(username=email, password=password)
        if not user:
            # Find user by email and authenticate with username
            try:
                u = User.objects.filter(email=email).first()
                if u: 
                    user = authenticate(username=u.username, password=password)
            except:
                pass
    
    if not user and phone:
        try:
            sp = StaffProfile.objects.filter(phone=phone).first()
            if sp: 
                user = authenticate(username=sp.user.username, password=password)
        except:
            pass
    
    if user:
        refresh = RefreshToken.for_user(user)
        
        # Try to get staff profile
        staff = None
        try:
            staff = user.staff_profile
        except:
            pass
        
        response_data = {
            'token': str(refresh.access_token),
            'refresh': str(refresh),  # Add refresh token
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': 'super_admin' if user.is_superuser else (staff.role if staff else 'admin'),
                'is_superuser': user.is_superuser,
            }
        }
        
        # Add hospital info if staff has one
        if staff and staff.hospital:
            response_data['hospital'] = {
                'id': staff.hospital.id,
                'name': staff.hospital.name,
                'slug': staff.hospital.slug if hasattr(staff.hospital, 'slug') else '',
            }
        
        return Response(response_data)
    
    return Response({'error': 'Invalid credentials'}, status=401)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def hospital_settings(request):
    hospital = None
    if hasattr(request.user, 'staff_profile'):
        hospital = request.user.staff_profile.hospital
    elif request.user.is_superuser:
        hospital_id = request.query_params.get('hospital_id') or request.data.get('hospital_id')
        if hospital_id:
            hospital = Hospital.objects.filter(id=hospital_id).first()

    if not hospital:
        return Response({'error': 'Hospital not found'}, status=404)

    if request.method == 'GET':
        return Response(HospitalSerializer(hospital).data)
    elif request.method == 'PUT':
        serializer = HospitalSerializer(hospital, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


router = DefaultRouter()
router.register(r'hospitals', HospitalViewSet, basename='hospital')
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'wards', WardViewSet, basename='ward')
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'beds', BedViewSet, basename='bed')
router.register(r'medicines', MedicineViewSet, basename='medicine')
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'bills', BillViewSet, basename='bill')
router.register(r'prescriptions', PrescriptionViewSet, basename='prescription')
router.register(r'insurance-companies', InsuranceCompanyViewSet, basename='insurance-company')
router.register(r'insurance-claims', InsuranceClaimViewSet, basename='insurance-claim')
router.register(r'imaging-tests', ImagingTestViewSet, basename='imaging-test')
router.register(r'subscription-payments', SubscriptionPaymentViewSet, basename='subscription-payment')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # JWT Token Endpoints (Add these for proper JWT support)
    path('api/v1/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Custom Login
    path('api/v1/hospitals/login/', login_view, name='login'),
    path('api/v1/hospitals/settings/', hospital_settings, name='hospital-settings'),
    
    # Super Admin URLs
    path('api/v1/super-admin/stats/', super_admin_stats, name='super-admin-stats'),
    path('api/v1/super-admin/toggle-hospital/', toggle_hospital_status, name='toggle-hospital'),
    path('api/v1/super-admin/update-plan/', update_hospital_plan, name='update-plan'),
    path('api/v1/super-admin/switch-hospital/', switch_hospital, name='switch-hospital'),
    path('api/v1/super-admin/switch-back/', switch_back_to_superadmin, name='switch-back'),
    
    # Reports
    path('api/v1/reports/dashboard/', dashboard_report, name='dashboard-report'),
    path('api/v1/reports/detailed/', detailed_report, name='detailed-report'),
    path('api/v1/reports/staff/', staff_report, name='staff-report'),
    path('api/v1/reports/reception/', reception_report, name='reception-report'),
    path('api/v1/reports/cashier/', cashier_report, name='cashier-report'),
    path('api/v1/reports/pharmacy/', pharmacy_report, name='pharmacy-report'),
    path('api/v1/reports/lab/', lab_report, name='lab-report'),
    path('api/v1/reports/dashboard-charts/', dashboard_charts, name='dashboard-charts'),
    
    # Router URLs
    path('api/v1/', include(router.urls)),
]