from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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


def _shift_datetime(work_date, shift_time):
    return timezone.make_aware(
        datetime.combine(work_date, shift_time),
        timezone.get_current_timezone(),
    )


def _attendance_windows(employee, now):
    local_now = timezone.localtime(now)
    today = local_now.date()
    previous_date = today - timedelta(days=1)
    assignments = (
        ShiftAssignment.objects
        .select_related("shift")
        .filter(
            employee=employee,
            is_active=True,
            shift__is_active=True,
            start_date__lte=today,
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=previous_date))
    )
    early_minutes = settings.ATTENDANCE_CLOCK_IN_EARLY_MINUTES
    close_minutes = settings.ATTENDANCE_CLOCK_IN_CLOSE_MINUTES
    windows = []

    for assignment in assignments:
        shift = assignment.shift
        overnight = shift.is_night_shift or shift.end_time <= shift.start_time
        work_dates = [today]
        if overnight:
            work_dates.append(previous_date)

        for work_date in work_dates:
            if assignment.start_date > work_date:
                continue
            if assignment.end_date and assignment.end_date < work_date:
                continue

            shift_start = _shift_datetime(work_date, shift.start_time)
            shift_end_date = work_date + timedelta(days=1) if overnight else work_date
            shift_end = _shift_datetime(shift_end_date, shift.end_time)
            opens_at = shift_start - timedelta(minutes=early_minutes)
            closes_at = min(
                shift_start + timedelta(minutes=close_minutes),
                shift_end,
            )
            windows.append(
                {
                    "assignment": assignment,
                    "work_date": work_date,
                    "shift_start": shift_start,
                    "shift_end": shift_end,
                    "opens_at": opens_at,
                    "closes_at": closes_at,
                    "is_open": opens_at <= local_now <= closes_at,
                }
            )

    return sorted(
        windows,
        key=lambda item: abs((item["shift_start"] - local_now).total_seconds()),
    )


def _serialize_attendance_status(employee, now):
    local_now = timezone.localtime(now)
    windows = _attendance_windows(employee, now)
    open_window = next((item for item in windows if item["is_open"]), None)
    open_attendance = (
        Attendance.objects
        .select_related("shift")
        .filter(
            employee=employee,
            attendance_date__in=[
                local_now.date(),
                local_now.date() - timedelta(days=1),
            ],
            clock_in__isnull=False,
            clock_out__isnull=True,
        )
        .order_by("-attendance_date")
        .first()
    )
    selected_window = open_window or (windows[0] if windows else None)
    window_attendance = (
        Attendance.objects
        .select_related("shift")
        .filter(
            employee=employee,
            attendance_date=selected_window["work_date"],
        )
        .first()
        if selected_window
        else None
    )
    attendance = open_attendance or window_attendance
    already_clocked_in = bool(attendance and attendance.clock_in)

    return {
        "server_time": local_now.isoformat(),
        "can_clock_in": bool(open_window and not window_attendance),
        "can_clock_out": bool(open_attendance),
        "attendance": (
            AttendanceSerializer(attendance).data if attendance else None
        ),
        "shift": (
            {
                "id": selected_window["assignment"].shift_id,
                "name": selected_window["assignment"].shift.name,
                "work_date": selected_window["work_date"].isoformat(),
                "starts_at": selected_window["shift_start"].isoformat(),
                "ends_at": selected_window["shift_end"].isoformat(),
                "clock_in_opens_at": selected_window["opens_at"].isoformat(),
                "clock_in_closes_at": selected_window["closes_at"].isoformat(),
            }
            if selected_window
            else None
        ),
        "message": (
            "You are already clocked in."
            if already_clocked_in and attendance and not attendance.clock_out
            else "Attendance is already recorded for this shift."
            if window_attendance
            else "Clock-in is open."
            if open_window
            else "Clock-in is outside the allowed arrival window."
            if selected_window
            else "No active shift is assigned for today."
        ),
    }


class MyAttendanceStatusView(EmployeeSelfServiceMixin, APIView):
    def get(self, request):
        employee = self.get_employee()
        if not employee:
            return Response(
                {"detail": "Your account is not linked to an active employee."},
                status=400,
            )
        return Response(_serialize_attendance_status(employee, timezone.now()))


class MyAttendanceClockInView(EmployeeSelfServiceMixin, APIView):
    def post(self, request):
        employee = self.get_employee()
        if not employee:
            return Response(
                {"detail": "Your account is not linked to an active employee."},
                status=400,
            )

        now = timezone.now()
        window = next(
            (item for item in _attendance_windows(employee, now) if item["is_open"]),
            None,
        )
        if not window:
            return Response(
                {"detail": "Clock-in is outside the allowed arrival window."},
                status=400,
            )

        grace_deadline = window["shift_start"] + timedelta(
            minutes=settings.ATTENDANCE_LATE_GRACE_MINUTES
        )
        with transaction.atomic():
            attendance, created = Attendance.objects.get_or_create(
                employee=employee,
                attendance_date=window["work_date"],
                defaults={
                    "shift": window["assignment"].shift,
                    "clock_in": now,
                    "status": "PRESENT" if now <= grace_deadline else "LATE",
                },
            )
            if not created:
                return Response(
                    {"detail": "Attendance is already recorded for this shift."},
                    status=400,
                )

        return Response(AttendanceSerializer(attendance).data, status=201)


class MyAttendanceClockOutView(EmployeeSelfServiceMixin, APIView):
    def post(self, request):
        employee = self.get_employee()
        if not employee:
            return Response(
                {"detail": "Your account is not linked to an active employee."},
                status=400,
            )

        now = timezone.now()
        local_date = timezone.localtime(now).date()
        attendance = (
            Attendance.objects
            .filter(
                employee=employee,
                attendance_date__in=[local_date, local_date - timedelta(days=1)],
                clock_in__isnull=False,
                clock_out__isnull=True,
            )
            .order_by("-attendance_date")
            .first()
        )
        if not attendance:
            return Response(
                {"detail": "No open attendance record is available to clock out."},
                status=400,
            )

        attendance.clock_out = now
        attendance.save(update_fields=["clock_out", "updated_at"])
        return Response(AttendanceSerializer(attendance).data)


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