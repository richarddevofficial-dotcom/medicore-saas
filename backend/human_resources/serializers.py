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


class JobPositionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
    )

    class Meta:
        model = JobPosition
        fields = "__all__"
        read_only_fields = ["hospital", "created_at", "updated_at"]


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
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return employee

        user = request.user

        if user.is_superuser:
            return employee

        staff_profile = getattr(user, "staff_profile", None)
        hospital_id = getattr(
            staff_profile,
            "hospital_id",
            None,
        )

        if not hospital_id:
            raise serializers.ValidationError(
                "Hospital context is required."
            )

        if employee.hospital_id != hospital_id:
            raise serializers.ValidationError(
                "The selected employee belongs to another hospital."
            )

        return employee

    def validate(self, attrs):
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


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = "__all__"
        read_only_fields = ["hospital", "created_at", "updated_at"]


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
            if balance is not None and balance.available_days < total_days:
                raise serializers.ValidationError(
                    {
                        "total_days": (
                            f"Insufficient leave balance. "
                            f"Available: {balance.available_days} day(s)."
                        )
                    }
                )

        return attrs
