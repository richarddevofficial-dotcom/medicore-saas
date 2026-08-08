from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .permissions import get_user_hospital_id
from .models import (
    Attendance,
    Employee,
    EmployeeDocument,
    EmploymentContract,
    JobPosition,
    LeaveBalance,
    LeaveRequest,
    LeaveType,
    Shift,
    ShiftAssignment,
)


def validate_related_hospitals(serializer, attrs, *field_names):
    """Keep all related HR records in the same hospital tenant."""

    related_hospital_id = None

    for field_name in field_names:
        related_object = attrs.get(
            field_name,
            getattr(serializer.instance, field_name, None),
        )
        object_hospital_id = getattr(
            related_object,
            "hospital_id",
            None,
        )

        if object_hospital_id is None:
            continue

        if (
            related_hospital_id is not None
            and related_hospital_id != object_hospital_id
        ):
            raise serializers.ValidationError(
                {
                    field_name: (
                        "The selected record belongs to another hospital."
                    )
                }
            )

        related_hospital_id = object_hospital_id

    request = serializer.context.get("request")
    user = getattr(request, "user", None)

    if user and user.is_authenticated and not user.is_superuser:
        user_hospital_id = get_user_hospital_id(user)

        if user_hospital_id is None:
            raise serializers.ValidationError(
                "Hospital context is required."
            )

        if (
            related_hospital_id is not None
            and related_hospital_id != user_hospital_id
        ):
            raise serializers.ValidationError(
                "The selected record belongs to another hospital."
            )


class JobPositionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
    )

    class Meta:
        model = JobPosition
        fields = "__all__"
        read_only_fields = ["hospital", "created_at", "updated_at"]

    def validate(self, attrs):
        validate_related_hospitals(self, attrs, "department")
        return attrs


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
    )
    position_title = serializers.CharField(
        source="position.title",
        read_only=True,
    )
    reports_to_name = serializers.CharField(
        source="reports_to.full_name",
        read_only=True,
    )

    class Meta:
        model = Employee
        fields = "__all__"
        read_only_fields = ["hospital", "created_at", "updated_at"]

    def validate(self, attrs):
        validate_related_hospitals(
            self,
            attrs,
            "department",
            "position",
            "reports_to",
        )

        request = self.context.get("request")
        request_user = getattr(request, "user", None)
        hospital_id = (
            get_user_hospital_id(request_user)
            if request_user and request_user.is_authenticated
            else None
        )
        employee_number = attrs.get(
            "employee_number",
            getattr(self.instance, "employee_number", None),
        )
        duplicate_numbers = Employee.objects.filter(
            hospital_id=hospital_id,
            employee_number=employee_number,
        )
        if self.instance:
            duplicate_numbers = duplicate_numbers.exclude(pk=self.instance.pk)
        if hospital_id and employee_number and duplicate_numbers.exists():
            raise serializers.ValidationError(
                {
                    "employee_number": (
                        "This employee number is already in use."
                    )
                }
            )

        department = attrs.get(
            "department",
            getattr(self.instance, "department", None),
        )
        position = attrs.get(
            "position",
            getattr(self.instance, "position", None),
        )
        if (
            department
            and position
            and position.department_id
            and position.department_id != department.id
        ):
            raise serializers.ValidationError(
                {
                    "position": (
                        "The selected position does not belong to "
                        "the selected department."
                    )
                }
            )

        linked_user = attrs.get(
            "user",
            getattr(self.instance, "user", None),
        )
        if linked_user and request_user and not request_user.is_superuser:
            linked_profile = getattr(linked_user, "staff_profile", None)
            if (
                not linked_profile
                or linked_profile.hospital_id
                != get_user_hospital_id(request_user)
            ):
                raise serializers.ValidationError(
                    {
                        "user": (
                            "The selected staff account belongs to "
                            "another hospital."
                        )
                    }
                )

        return attrs


class EmploymentContractSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )
    employee_number = serializers.CharField(
        source="employee.employee_number",
        read_only=True,
    )
    department_name = serializers.CharField(
        source="employee.department.name",
        read_only=True,
        allow_null=True,
    )
    position_title = serializers.CharField(
        source="employee.position.title",
        read_only=True,
        allow_null=True,
    )
    days_until_expiry = serializers.SerializerMethodField()
    expiry_state = serializers.SerializerMethodField()

    class Meta:
        model = EmploymentContract
        fields = "__all__"
        read_only_fields = [
            "created_at",
            "updated_at",
        ]

    def get_days_until_expiry(self, obj):
        if not obj.end_date:
            return None

        return (obj.end_date - timezone.localdate()).days

    def get_expiry_state(self, obj):
        if obj.status == "TERMINATED":
            return "TERMINATED"

        if obj.status == "RENEWED":
            return "RENEWED"

        if not obj.end_date:
            return "OPEN_ENDED"

        days_remaining = (
            obj.end_date - timezone.localdate()
        ).days

        if days_remaining < 0:
            return "EXPIRED"

        if days_remaining == 0:
            return "EXPIRES_TODAY"

        if days_remaining <= 7:
            return "EXPIRING_7_DAYS"

        if days_remaining <= 30:
            return "EXPIRING_30_DAYS"

        return "ACTIVE"

    def validate_employee(self, employee):
        return employee

    def validate(self, attrs):
        validate_related_hospitals(self, attrs, "employee")
        start_date = attrs.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )
        end_date = attrs.get(
            "end_date",
            getattr(self.instance, "end_date", None),
        )
        probation_end_date = attrs.get(
            "probation_end_date",
            getattr(
                self.instance,
                "probation_end_date",
                None,
            ),
        )

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {
                    "end_date": (
                        "End date cannot be before start date."
                    )
                }
            )

        if (
            start_date
            and probation_end_date
            and probation_end_date < start_date
        ):
            raise serializers.ValidationError(
                {
                    "probation_end_date": (
                        "Probation end date cannot be "
                        "before the contract start date."
                    )
                }
            )

        if (
            end_date
            and probation_end_date
            and probation_end_date > end_date
        ):
            raise serializers.ValidationError(
                {
                    "probation_end_date": (
                        "Probation end date cannot be "
                        "after the contract end date."
                    )
                }
            )

        return attrs


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )

    class Meta:
        model = EmployeeDocument
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        validate_related_hospitals(self, attrs, "employee")
        return attrs


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = "__all__"
        read_only_fields = ["hospital", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        hospital_id = (
            get_user_hospital_id(user)
            if user and user.is_authenticated
            else None
        )
        code = attrs.get("code", getattr(self.instance, "code", ""))
        duplicate_codes = Shift.objects.filter(
            hospital_id=hospital_id,
            code__iexact=code,
        )
        if self.instance:
            duplicate_codes = duplicate_codes.exclude(pk=self.instance.pk)
        if hospital_id and code and duplicate_codes.exists():
            raise serializers.ValidationError(
                {"code": "This shift code is already in use."}
            )

        start_time = attrs.get(
            "start_time",
            getattr(self.instance, "start_time", None),
        )
        end_time = attrs.get(
            "end_time",
            getattr(self.instance, "end_time", None),
        )
        early_minutes = attrs.get(
            "clock_in_early_minutes",
            getattr(self.instance, "clock_in_early_minutes", 60),
        )
        close_minutes = attrs.get(
            "clock_in_close_minutes",
            getattr(self.instance, "clock_in_close_minutes", 240),
        )
        if early_minutes > 1440:
            raise serializers.ValidationError(
                {"clock_in_early_minutes": "Clock-in cannot open more than one day early."}
            )
        if close_minutes < 1:
            raise serializers.ValidationError(
                {"clock_in_close_minutes": "Clock-in must close after the shift starts."}
            )
        if start_time and end_time:
            start_minutes = start_time.hour * 60 + start_time.minute
            end_minutes = end_time.hour * 60 + end_time.minute
            shift_minutes = (end_minutes - start_minutes) % 1440 or 1440
            if close_minutes > shift_minutes:
                raise serializers.ValidationError(
                    {
                        "clock_in_close_minutes": (
                            "Clock-in must close no later than the shift end time."
                        )
                    }
                )

        return attrs


class ShiftAssignmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )
    shift_name = serializers.CharField(
        source="shift.name",
        read_only=True,
    )

    class Meta:
        model = ShiftAssignment
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        validate_related_hospitals(self, attrs, "employee", "shift")
        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        start_date = attrs.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        is_active = attrs.get(
            "is_active",
            getattr(self.instance, "is_active", True),
        )
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be before start date."}
            )

        if employee and start_date and is_active:
            overlaps = ShiftAssignment.objects.filter(
                employee=employee,
                is_active=True,
            ).filter(Q(end_date__isnull=True) | Q(end_date__gte=start_date))
            if end_date:
                overlaps = overlaps.filter(start_date__lte=end_date)
            if self.instance:
                overlaps = overlaps.exclude(pk=self.instance.pk)
            if overlaps.exists():
                raise serializers.ValidationError(
                    {
                        "start_date": (
                            "This employee already has an active shift assignment "
                            "during the selected date range."
                        )
                    }
                )
        return attrs


class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )
    shift_name = serializers.CharField(
        source="shift.name",
        read_only=True,
    )

    class Meta:
        model = Attendance
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        validate_related_hospitals(self, attrs, "employee", "shift")
        clock_in = attrs.get(
            "clock_in",
            getattr(self.instance, "clock_in", None),
        )
        clock_out = attrs.get(
            "clock_out",
            getattr(self.instance, "clock_out", None),
        )
        if clock_in and clock_out and clock_out <= clock_in:
            raise serializers.ValidationError(
                {"clock_out": "Clock-out time must be after clock-in time."}
            )
        return attrs


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = "__all__"
        read_only_fields = ["hospital", "created_at", "updated_at"]




class LeaveBalanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )
    employee_number = serializers.CharField(
        source="employee.employee_number",
        read_only=True,
    )
    leave_type_name = serializers.CharField(
        source="leave_type.name",
        read_only=True,
    )
    total_entitlement = serializers.DecimalField(
        max_digits=7,
        decimal_places=2,
        read_only=True,
    )
    remaining_days = serializers.DecimalField(
        max_digits=7,
        decimal_places=2,
        read_only=True,
    )
    available_days = serializers.DecimalField(
        max_digits=7,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = LeaveBalance
        fields = "__all__"
        read_only_fields = [
            "used_days",
            "pending_days",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        validate_related_hospitals(self, attrs, "employee", "leave_type")
        employee = attrs.get(
            "employee",
            getattr(self.instance, "employee", None),
        )
        leave_type = attrs.get(
            "leave_type",
            getattr(self.instance, "leave_type", None),
        )

        if (
            employee
            and leave_type
            and employee.hospital_id != leave_type.hospital_id
        ):
            raise serializers.ValidationError(
                "Employee and leave type must belong "
                "to the same hospital."
            )

        if employee and not employee.is_active:
            raise serializers.ValidationError(
                {
                    "employee": (
                        "Leave cannot be allocated "
                        "to an inactive employee."
                    )
                }
            )

        return attrs
class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )
    leave_type_name = serializers.CharField(
        source="leave_type.name",
        read_only=True,
    )
    reviewed_by_email = serializers.EmailField(
        source="reviewed_by.email",
        read_only=True,
    )

    class Meta:
        model = LeaveRequest
        fields = "__all__"
        read_only_fields = [
            "reviewed_by",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        validate_related_hospitals(self, attrs, "employee", "leave_type")
        start_date = attrs.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )
        end_date = attrs.get(
            "end_date",
            getattr(self.instance, "end_date", None),
        )

        if start_date and end_date:
            if end_date < start_date:
                raise serializers.ValidationError(
                    {"end_date": "End date cannot be before start date."}
                )

            attrs["total_days"] = (end_date - start_date).days + 1

        leave_type = attrs.get(
            "leave_type",
            getattr(self.instance, "leave_type", None),
        )
        document = attrs.get(
            "supporting_document",
            getattr(self.instance, "supporting_document", None),
        )

        if leave_type and leave_type.requires_document and not document:
            raise serializers.ValidationError(
                {
                    "supporting_document":
                        "A supporting document is required for this leave type."
                }
            )

        # Check available balance on new requests only
        employee = attrs.get(
            "employee",
            getattr(self.instance, "employee", None),
        )
        total_days = attrs.get(
            "total_days",
            getattr(self.instance, "total_days", None),
        )
        if employee and leave_type and total_days and not self.instance:
            year = start_date.year if start_date else timezone.localdate().year
            balance = LeaveBalance.objects.filter(
                employee=employee,
                leave_type=leave_type,
                year=year,
                is_active=True,
            ).first()
            if balance is None:
                raise serializers.ValidationError(
                    {
                        "leave_type": (
                            "No active leave balance exists for this employee."
                        )
                    }
                )

            if balance.available_days < total_days:
                raise serializers.ValidationError(
                    {
                        "total_days": (
                            f"Insufficient leave balance. "
                            f"Available: {balance.available_days} day(s)."
                        )
                    }
                )

        return attrs
