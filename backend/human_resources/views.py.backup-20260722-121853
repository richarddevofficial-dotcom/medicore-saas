from datetime import timedelta
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Attendance,
    Employee,
    EmployeeDocument,
    EmploymentContract,
    JobPosition,
    LeaveRequest,
    LeaveType,
    Shift,
    ShiftAssignment,
)
from .permissions import IsHRManager, IsHRUser, get_user_hospital_id
from .serializers import (
    AttendanceSerializer,
    EmployeeDocumentSerializer,
    EmployeeSerializer,
    EmploymentContractSerializer,
    JobPositionSerializer,
    LeaveRequestSerializer,
    LeaveTypeSerializer,
    ShiftAssignmentSerializer,
    ShiftSerializer,
)


class HospitalScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHRUser]
    hospital_lookup = "hospital_id"

    def get_hospital_id(self):
        return get_user_hospital_id(self.request.user)

    def get_queryset(self):
        queryset = super().get_queryset()

        if self.request.user.is_superuser:
            hospital_id = self.request.query_params.get("hospital")
            if hospital_id:
                return queryset.filter(
                    **{self.hospital_lookup: hospital_id}
                )
            return queryset

        hospital_id = self.get_hospital_id()
        if not hospital_id:
            return queryset.none()

        return queryset.filter(
            **{self.hospital_lookup: hospital_id}
        )

    def perform_create(self, serializer):
        hospital_id = self.get_hospital_id()

        if self.request.user.is_superuser:
            requested_hospital = self.request.data.get("hospital")
            hospital_id = requested_hospital or hospital_id

        if not hospital_id:
            serializer.save()
            return

        serializer.save(hospital_id=hospital_id)


class JobPositionViewSet(HospitalScopedViewSet):
    queryset = JobPosition.objects.select_related(
        "hospital",
        "department",
    )
    serializer_class = JobPositionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "code", "description"]
    ordering_fields = ["title", "created_at"]


class EmployeeViewSet(HospitalScopedViewSet):
    queryset = Employee.objects.select_related(
        "hospital",
        "user",
        "department",
        "position",
        "reports_to",
    )
    serializer_class = EmployeeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "employee_number",
        "first_name",
        "middle_name",
        "last_name",
        "email",
        "phone",
        "national_id",
    ]
    ordering_fields = [
        "first_name",
        "last_name",
        "hire_date",
        "created_at",
    ]

    def get_queryset(self):
        queryset = super().get_queryset()

        status_value = self.request.query_params.get("employment_status")
        department = self.request.query_params.get("department")
        position = self.request.query_params.get("position")
        employment_type = self.request.query_params.get("employment_type")
        active = self.request.query_params.get("is_active")

        if status_value:
            queryset = queryset.filter(employment_status=status_value)

        if department:
            queryset = queryset.filter(department_id=department)

        if position:
            queryset = queryset.filter(position_id=position)

        if employment_type:
            queryset = queryset.filter(employment_type=employment_type)

        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")

        return queryset

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsHRManager],
    )
    def deactivate(self, request, pk=None):
        employee = self.get_object()
        employee.is_active = False
        employee.employment_status = request.data.get(
            "employment_status",
            "TERMINATED",
        )
        employee.termination_date = request.data.get(
            "termination_date",
            timezone.localdate(),
        )
        employee.save(
            update_fields=[
                "is_active",
                "employment_status",
                "termination_date",
                "updated_at",
            ]
        )

        return Response(
            {
                "success": True,
                "message": "Employee deactivated successfully.",
            }
        )


class EmploymentContractViewSet(HospitalScopedViewSet):
    queryset = EmploymentContract.objects.select_related(
        "employee",
        "employee__hospital",
        "employee__department",
        "employee__position",
    )
    serializer_class = EmploymentContractSerializer
    hospital_lookup = "employee__hospital_id"
    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    search_fields = [
        "contract_number",
        "employee__employee_number",
        "employee__first_name",
        "employee__middle_name",
        "employee__last_name",
        "employee__department__name",
        "employee__position__title",
    ]
    ordering_fields = [
        "contract_number",
        "basic_salary",
        "start_date",
        "end_date",
        "created_at",
    ]

    def get_queryset(self):
        queryset = super().get_queryset()

        status_value = self.request.query_params.get("status")
        employee_id = self.request.query_params.get("employee")
        currency = self.request.query_params.get("currency")
        expiry = self.request.query_params.get("expiry")
        expiring_within = self.request.query_params.get(
            "expiring_within"
        )

        if status_value:
            queryset = queryset.filter(
                status=status_value.upper()
            )

        if employee_id:
            queryset = queryset.filter(
                employee_id=employee_id
            )

        if currency:
            queryset = queryset.filter(
                currency__iexact=currency
            )

        today = timezone.localdate()

        if expiry == "expired":
            queryset = queryset.filter(
                end_date__lt=today
            )

        elif expiry == "active":
            queryset = queryset.filter(
                Q(end_date__isnull=True)
                | Q(end_date__gte=today)
            ).exclude(status="TERMINATED")

        elif expiry == "open-ended":
            queryset = queryset.filter(
                end_date__isnull=True
            )

        if expiring_within:
            try:
                days = int(expiring_within)
            except (TypeError, ValueError):
                days = None

            if days is not None and days >= 0:
                expiry_limit = today + timedelta(days=days)

                queryset = queryset.filter(
                    end_date__gte=today,
                    end_date__lte=expiry_limit,
                ).exclude(
                    status__in=[
                        "TERMINATED",
                        "RENEWED",
                    ]
                )

        return queryset

    def perform_create(self, serializer):
        serializer.save()


class EmployeeDocumentViewSet(HospitalScopedViewSet):
    queryset = EmployeeDocument.objects.select_related(
        "employee",
        "employee__hospital",
    )
    serializer_class = EmployeeDocumentSerializer
    hospital_lookup = "employee__hospital_id"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "title",
        "document_number",
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
    ]
    ordering_fields = ["issued_date", "expiry_date", "created_at"]

    def perform_create(self, serializer):
        serializer.save()


class ShiftViewSet(HospitalScopedViewSet):
    queryset = Shift.objects.select_related("hospital")
    serializer_class = ShiftSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["start_time", "name"]


class ShiftAssignmentViewSet(HospitalScopedViewSet):
    queryset = ShiftAssignment.objects.select_related(
        "employee",
        "employee__hospital",
        "shift",
    )
    serializer_class = ShiftAssignmentSerializer
    hospital_lookup = "employee__hospital_id"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
        "shift__name",
    ]
    ordering_fields = ["start_date", "end_date", "created_at"]

    def perform_create(self, serializer):
        serializer.save()


class AttendanceViewSet(HospitalScopedViewSet):
    queryset = Attendance.objects.select_related(
        "employee",
        "employee__hospital",
        "shift",
    )
    serializer_class = AttendanceSerializer
    hospital_lookup = "employee__hospital_id"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
    ]
    ordering_fields = ["attendance_date", "clock_in", "clock_out"]

    def get_queryset(self):
        queryset = super().get_queryset()

        date = self.request.query_params.get("date")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        employee = self.request.query_params.get("employee")
        attendance_status = self.request.query_params.get("status")

        if date:
            queryset = queryset.filter(attendance_date=date)

        if start_date:
            queryset = queryset.filter(attendance_date__gte=start_date)

        if end_date:
            queryset = queryset.filter(attendance_date__lte=end_date)

        if employee:
            queryset = queryset.filter(employee_id=employee)

        if attendance_status:
            queryset = queryset.filter(status=attendance_status)

        return queryset


class LeaveTypeViewSet(HospitalScopedViewSet):
    queryset = LeaveType.objects.select_related("hospital")
    serializer_class = LeaveTypeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "days_allowed"]


class LeaveRequestViewSet(HospitalScopedViewSet):
    queryset = LeaveRequest.objects.select_related(
        "employee",
        "employee__hospital",
        "leave_type",
        "reviewed_by",
    )
    serializer_class = LeaveRequestSerializer
    hospital_lookup = "employee__hospital_id"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
        "reason",
    ]
    ordering_fields = ["start_date", "end_date", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()

        request_status = self.request.query_params.get("status")
        employee = self.request.query_params.get("employee")
        leave_type = self.request.query_params.get("leave_type")

        if request_status:
            queryset = queryset.filter(status=request_status)

        if employee:
            queryset = queryset.filter(employee_id=employee)

        if leave_type:
            queryset = queryset.filter(leave_type_id=leave_type)

        return queryset

    def perform_create(self, serializer):
        serializer.save()

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsHRManager],
    )
    def approve(self, request, pk=None):
        leave_request = self.get_object()

        if leave_request.status != "PENDING":
            return Response(
                {"error": "Only pending leave requests can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        leave_request.status = "APPROVED"
        leave_request.reviewed_by = request.user
        leave_request.reviewed_at = timezone.now()
        leave_request.review_notes = request.data.get("review_notes", "")
        leave_request.save(
            update_fields=[
                "status",
                "reviewed_by",
                "reviewed_at",
                "review_notes",
                "updated_at",
            ]
        )

        return Response(
            {
                "success": True,
                "message": "Leave request approved.",
            }
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsHRManager],
    )
    def reject(self, request, pk=None):
        leave_request = self.get_object()

        if leave_request.status != "PENDING":
            return Response(
                {"error": "Only pending leave requests can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        leave_request.status = "REJECTED"
        leave_request.reviewed_by = request.user
        leave_request.reviewed_at = timezone.now()
        leave_request.review_notes = request.data.get("review_notes", "")
        leave_request.save(
            update_fields=[
                "status",
                "reviewed_by",
                "reviewed_at",
                "review_notes",
                "updated_at",
            ]
        )

        return Response(
            {
                "success": True,
                "message": "Leave request rejected.",
            }
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsHRUser])
def hr_dashboard(request):
    hospital_id = get_user_hospital_id(request.user)

    employees = Employee.objects.all()
    leave_requests = LeaveRequest.objects.all()
    attendance = Attendance.objects.all()

    if not request.user.is_superuser:
        if not hospital_id:
            return Response(
                {
                    "total_employees": 0,
                    "active_employees": 0,
                    "employees_on_leave": 0,
                    "pending_leave_requests": 0,
                    "present_today": 0,
                    "absent_today": 0,
                    "departments": [],
                }
            )

        employees = employees.filter(hospital_id=hospital_id)
        leave_requests = leave_requests.filter(
            employee__hospital_id=hospital_id
        )
        attendance = attendance.filter(
            employee__hospital_id=hospital_id
        )

    today = timezone.localdate()

    department_summary = list(
        employees.filter(is_active=True)
        .values(
            "department_id",
            "department__name",
        )
        .annotate(total=Count("id"))
        .order_by("-total")
    )

    return Response(
        {
            "total_employees": employees.count(),
            "active_employees": employees.filter(is_active=True).count(),
            "employees_on_leave": employees.filter(
                employment_status="ON_LEAVE"
            ).count(),
            "pending_leave_requests": leave_requests.filter(
                status="PENDING"
            ).count(),
            "present_today": attendance.filter(
                attendance_date=today,
                status__in=["PRESENT", "LATE"],
            ).count(),
            "absent_today": attendance.filter(
                attendance_date=today,
                status="ABSENT",
            ).count(),
            "contracts_expiring_soon": EmploymentContract.objects.filter(
                employee__in=employees,
                status="ACTIVE",
                end_date__isnull=False,
                end_date__gte=today,
                end_date__lte=today + timedelta(days=30),
            ).count(),
            "departments": department_summary,
        }
    )
