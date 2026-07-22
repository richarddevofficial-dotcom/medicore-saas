from django.contrib import admin

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


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "employee_number",
        "full_name",
        "hospital",
        "department",
        "position",
        "employment_type",
        "employment_status",
        "is_active",
    )
    list_filter = (
        "hospital",
        "department",
        "employment_type",
        "employment_status",
        "is_active",
    )
    search_fields = (
        "employee_number",
        "first_name",
        "middle_name",
        "last_name",
        "email",
        "phone",
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(JobPosition)
class JobPositionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "code",
        "hospital",
        "department",
        "is_active",
    )
    list_filter = ("hospital", "department", "is_active")
    search_fields = ("title", "code")


@admin.register(EmploymentContract)
class EmploymentContractAdmin(admin.ModelAdmin):
    list_display = (
        "contract_number",
        "employee",
        "start_date",
        "end_date",
        "basic_salary",
        "currency",
        "status",
    )
    list_filter = ("status", "currency")
    search_fields = (
        "contract_number",
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
    )


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "employee",
        "document_type",
        "expiry_date",
        "is_verified",
    )
    list_filter = ("document_type", "is_verified")
    search_fields = (
        "title",
        "document_number",
        "employee__employee_number",
    )


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "hospital",
        "start_time",
        "end_time",
        "is_active",
    )
    list_filter = ("hospital", "is_night_shift", "is_active")
    search_fields = ("name", "code")


@admin.register(ShiftAssignment)
class ShiftAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "shift",
        "start_date",
        "end_date",
        "is_active",
    )
    list_filter = ("shift", "is_active")


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "attendance_date",
        "shift",
        "clock_in",
        "clock_out",
        "status",
    )
    list_filter = ("status", "attendance_date", "shift")
    search_fields = (
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
    )


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "hospital",
        "days_allowed",
        "is_paid",
        "is_active",
    )
    list_filter = ("hospital", "is_paid", "is_active")
    search_fields = ("name", "code")




@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "leave_type",
        "year",
        "allocated_days",
        "carried_forward_days",
        "adjustment_days",
        "used_days",
        "pending_days",
        "is_active",
    )
    list_filter = (
        "year",
        "leave_type",
        "is_active",
        "employee__hospital",
    )
    search_fields = (
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
        "leave_type__name",
    )
@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "leave_type",
        "start_date",
        "end_date",
        "total_days",
        "status",
        "reviewed_by",
    )
    list_filter = ("status", "leave_type", "start_date")
    search_fields = (
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
    )
