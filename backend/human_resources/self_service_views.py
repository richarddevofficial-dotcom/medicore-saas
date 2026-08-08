from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated

from .models import (
    Attendance,
    Employee,
    LeaveBalance,
    LeaveRequest,
    LeaveType,
    ShiftAssignment,
)
from .serializers import (
    AttendanceSerializer,
    LeaveBalanceSerializer,
    LeaveRequestSerializer,
    LeaveTypeSerializer,
    ShiftAssignmentSerializer,
)


class MyShiftAssignmentSerializer(ShiftAssignmentSerializer):
    shift_code = serializers.CharField(source="shift.code", read_only=True)
    shift_start_time = serializers.TimeField(
        source="shift.start_time",
        read_only=True,
    )
    shift_end_time = serializers.TimeField(
        source="shift.end_time",
        read_only=True,
    )


class MyLeaveRequestSerializer(LeaveRequestSerializer):
    class Meta(LeaveRequestSerializer.Meta):
        read_only_fields = [
            *LeaveRequestSerializer.Meta.read_only_fields,
            "employee",
            "status",
            "total_days",
            "review_notes",
        ]

    def validate(self, attrs):
        employee = (
            Employee.objects
            .filter(user=self.context["request"].user, is_active=True)
            .first()
        )
        if employee:
            attrs["employee"] = employee
        return super().validate(attrs)


class EmployeeSelfServiceMixin:
    permission_classes = [IsAuthenticated]

    def get_employee(self):
        if not hasattr(self, "_self_service_employee"):
            self._self_service_employee = (
                Employee.objects
                .filter(user=self.request.user, is_active=True)
                .first()
            )
        return self._self_service_employee


class MyShiftListView(EmployeeSelfServiceMixin, generics.ListAPIView):
    serializer_class = MyShiftAssignmentSerializer

    def get_queryset(self):
        employee = self.get_employee()
        if not employee:
            return ShiftAssignment.objects.none()

        queryset = (
            ShiftAssignment.objects
            .select_related("employee", "shift")
            .filter(employee=employee)
        )
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if start_date:
            queryset = queryset.filter(
                Q(end_date__isnull=True) | Q(end_date__gte=start_date)
            )
        if end_date:
            queryset = queryset.filter(start_date__lte=end_date)
        return queryset.order_by("-start_date")


class MyAttendanceListView(EmployeeSelfServiceMixin, generics.ListAPIView):
    serializer_class = AttendanceSerializer

    def get_queryset(self):
        employee = self.get_employee()
        if not employee:
            return Attendance.objects.none()

        queryset = (
            Attendance.objects
            .select_related("employee", "shift")
            .filter(employee=employee)
        )
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if start_date:
            queryset = queryset.filter(attendance_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(attendance_date__lte=end_date)
        return queryset.order_by("-attendance_date", "-clock_in")


class MyLeaveTypeListView(EmployeeSelfServiceMixin, generics.ListAPIView):
    serializer_class = LeaveTypeSerializer

    def get_queryset(self):
        employee = self.get_employee()
        if not employee:
            return LeaveType.objects.none()
        return LeaveType.objects.filter(
            hospital=employee.hospital,
            is_active=True,
        )


class MyLeaveBalanceListView(EmployeeSelfServiceMixin, generics.ListAPIView):
    serializer_class = LeaveBalanceSerializer

    def get_queryset(self):
        employee = self.get_employee()
        if not employee:
            return LeaveBalance.objects.none()
        year = self.request.query_params.get(
            "year",
            timezone.localdate().year,
        )
        return (
            LeaveBalance.objects
            .select_related("employee", "leave_type")
            .filter(employee=employee, year=year, is_active=True)
        )


class MyLeaveRequestListCreateView(
    EmployeeSelfServiceMixin,
    generics.ListCreateAPIView,
):
    serializer_class = MyLeaveRequestSerializer

    def get_queryset(self):
        employee = self.get_employee()
        if not employee:
            return LeaveRequest.objects.none()
        return (
            LeaveRequest.objects
            .select_related("employee", "leave_type", "reviewed_by")
            .filter(employee=employee)
        )

    def perform_create(self, serializer):
        employee = self.get_employee()
        if not employee:
            raise serializers.ValidationError(
                {"employee": "Your account is not linked to an active employee."}
            )

        leave_type = serializer.validated_data["leave_type"]
        if leave_type.hospital_id != employee.hospital_id:
            raise serializers.ValidationError(
                {"leave_type": "The selected leave type is not available."}
            )

        with transaction.atomic():
            leave_request = serializer.save(employee=employee)
            LeaveBalance.objects.filter(
                employee=employee,
                leave_type=leave_type,
                year=leave_request.start_date.year,
                is_active=True,
            ).update(
                pending_days=F("pending_days") + leave_request.total_days
            )