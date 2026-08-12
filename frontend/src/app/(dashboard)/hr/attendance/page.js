"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { getApiError, hrApi } from "@/services/hr";

const attendanceStatuses = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "OFF_DUTY", label: "Off Duty" },
];

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyForm() {
  return {
    employee: "",
    shift: "",
    attendance_date: getToday(),
    clock_in: "",
    clock_out: "",
    status: "PRESENT",
    notes: "",
  };
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [form, setForm] = useState(createEmptyForm());
  const [editingRecord, setEditingRecord] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWindowModalOpen, setIsWindowModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingWindow, setIsSavingWindow] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [canManageAttendance, setCanManageAttendance] = useState(false);
  const [windowForm, setWindowForm] = useState({
    shift: "",
    opensAt: "",
    closesAt: "",
  });

  useEffect(() => {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    setCanManageAttendance(
      ["admin", "hospital_admin", "hr_manager", "super_admin"].includes(role),
    );
  }, []);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError("");

      const [attendanceData, employeeData, shiftData] = await Promise.all([
        hrApi.getAttendance(),
        hrApi.getEmployees(),
        hrApi.getShifts(),
      ]);

      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      setEmployees(Array.isArray(employeeData) ? employeeData : []);
      setShifts(Array.isArray(shiftData) ? shiftData : []);
    } catch (err) {
      setError(getApiError(err, "Unable to load attendance records."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadData({ silent: true });
      }
    }, 60000);

    return () => window.clearInterval(refreshInterval);
  }, [loadData]);

  const filteredAttendance = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return attendance.filter((record) => {
      const employeeName = getEmployeeName(record);
      const employeeNumber = getEmployeeNumber(record);

      const matchesSearch =
        !keyword ||
        employeeName.toLowerCase().includes(keyword) ||
        employeeNumber.toLowerCase().includes(keyword) ||
        String(record.notes || "")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        !statusFilter ||
        String(record.status || "").toUpperCase() ===
          statusFilter.toUpperCase();

      const matchesDate =
        !dateFilter || String(record.attendance_date || "") === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [attendance, dateFilter, search, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: filteredAttendance.length,
      present: filteredAttendance.filter(
        (record) => String(record.status || "").toUpperCase() === "PRESENT",
      ).length,
      absent: filteredAttendance.filter(
        (record) => String(record.status || "").toUpperCase() === "ABSENT",
      ).length,
      late: filteredAttendance.filter(
        (record) => String(record.status || "").toUpperCase() === "LATE",
      ).length,
    };
  }, [filteredAttendance]);

  function openCreateModal() {
    setEditingRecord(null);
    setForm(createEmptyForm());
    setError("");
    setSuccess("");
    setIsModalOpen(true);
  }

  function openEditModal(record) {
    setEditingRecord(record);

    setForm({
      employee: String(
        record.employee?.id ??
          record.employee_details?.id ??
          record.employee ??
          "",
      ),
      shift: String(
        record.shift?.id ?? record.shift_details?.id ?? record.shift ?? "",
      ),
      attendance_date: record.attendance_date || getToday(),
      clock_in: formatTimeForInput(record.clock_in),
      clock_out: formatTimeForInput(record.clock_out),
      status: String(record.status || "PRESENT").toUpperCase(),
      notes: record.notes || "",
    });

    setError("");
    setSuccess("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) return;

    setIsModalOpen(false);
    setEditingRecord(null);
    setForm(createEmptyForm());
  }

  function closeWindowModal() {
    if (isSavingWindow) return;
    setIsWindowModalOpen(false);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.employee) {
      setError("Please select an employee.");
      return;
    }

    if (!form.attendance_date) {
      setError("Attendance date is required.");
      return;
    }

    if (!form.status) {
      setError("Attendance status is required.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        employee: Number(form.employee),
        attendance_date: form.attendance_date,
        status: form.status,
        notes: form.notes.trim(),
        clock_in: combineDateAndTime(form.attendance_date, form.clock_in),
        clock_out: combineDateAndTime(
          form.attendance_date,
          form.clock_out,
          isOvernightClockOut(form, shifts),
        ),
        shift: form.shift ? Number(form.shift) : null,
      };

      if (editingRecord) {
        await hrApi.updateAttendance(editingRecord.id, payload);
        setSuccess("Attendance record updated successfully.");
      } else {
        await hrApi.createAttendance(payload);
        setSuccess("Attendance recorded successfully.");
      }

      setIsModalOpen(false);
      setEditingRecord(null);
      setForm(createEmptyForm());
      await loadData({ silent: true });
    } catch (err) {
      setError(
        getApiError(
          err,
          editingRecord
            ? "Unable to update attendance."
            : "Unable to record attendance.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record) {
    const employeeName = getEmployeeName(record);
    const confirmed = window.confirm(
      `Delete the attendance record for ${employeeName}?`,
    );

    if (!confirmed) return;

    try {
      setDeletingId(record.id);
      setError("");
      setSuccess("");

      await hrApi.deleteAttendance(record.id);

      setSuccess("Attendance record deleted successfully.");
      await loadData({ silent: true });
    } catch (err) {
      setError(getApiError(err, "Unable to delete attendance."));
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setDateFilter("");
  }

  function selectWindowShift(shiftId) {
    const shift = shifts.find((item) => String(item.id) === String(shiftId));
    if (!shift) return;

    const windowTimes = getClockInWindowTimes(shift);
    setWindowForm({
      shift: String(shift.id),
      opensAt: windowTimes.opensAt,
      closesAt: windowTimes.closesAt,
    });
  }

  function openWindowModal() {
    const shift = shifts.find((item) => item.is_active !== false);

    if (!shift) {
      setError("Create an active shift before setting a clock-in window.");
      return;
    }

    selectWindowShift(shift.id);
    setError("");
    setSuccess("");
    setIsWindowModalOpen(true);
  }

  async function handleWindowSubmit(event) {
    event.preventDefault();

    const shift = shifts.find(
      (item) => String(item.id) === String(windowForm.shift),
    );

    if (!shift || !windowForm.opensAt || !windowForm.closesAt) {
      setError("Select a shift and enter both clock-in window times.");
      return;
    }

    try {
      setIsSavingWindow(true);
      setError("");
      setSuccess("");

      const offsets = getClockInWindowOffsets(shift, windowForm);
      await hrApi.updateShift(shift.id, offsets);

      setIsWindowModalOpen(false);
      setSuccess(`Clock-in window updated for ${shift.name || "shift"}.`);
      await loadData({ silent: true });
    } catch (err) {
      setError(getApiError(err, "Unable to update the clock-in window."));
    } finally {
      setIsSavingWindow(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-50 p-3">
              <UserCheck className="h-6 w-6 text-orange-600" />
            </div>

            <div>
              <p className="text-sm font-medium text-orange-600">
                Human Resources
              </p>
              <h1 className="text-2xl font-bold text-gray-900">
                Attendance Management
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Record and manage employee daily attendance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadData({ silent: true })}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            {canManageAttendance && (
              <>
                <button
                  type="button"
                  onClick={openWindowModal}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Clock-in Windows
                </button>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
                >
                  <Plus className="h-4 w-4" />
                  Record Attendance
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Records"
          value={summary.total}
          icon={CalendarDays}
        />
        <SummaryCard
          label="Present"
          value={summary.present}
          icon={CheckCircle2}
        />
        <SummaryCard label="Absent" value={summary.absent} icon={UserX} />
        <SummaryCard label="Late" value={summary.late} icon={Clock3} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee..."
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            >
              <option value="">All statuses</option>
              {attendanceStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
          </div>
        ) : filteredAttendance.length === 0 ? (
          <div className="p-10 text-center">
            <UserCheck className="mx-auto h-12 w-12 text-gray-300" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              No attendance records found
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Record employee attendance to display it here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Shift</th>
                  <th className="px-5 py-3 font-semibold">Check In</th>
                  <th className="px-5 py-3 font-semibold">Check Out</th>
                  <th className="px-5 py-3 font-semibold">Worked Hours</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredAttendance.map((record) => (
                  <tr key={record.id} className="transition hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">
                        {getEmployeeName(record)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {getEmployeeNumber(record)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {formatDate(record.attendance_date)}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {getShiftName(record)}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {formatTimeForDisplay(record.clock_in)}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {formatTimeForDisplay(record.clock_out)}
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-700">
                      {formatWorkedHours(record.clock_in, record.clock_out)}
                    </td>
                    <td className="px-5 py-4">
                      <AttendanceBadge status={record.status} />
                    </td>
                    <td className="px-5 py-4">
                      {canManageAttendance ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(record)}
                            className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                            title="Edit attendance"
                            aria-label={`Edit attendance for ${getEmployeeName(record)}`}
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(record)}
                            disabled={deletingId === record.id}
                            className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete attendance"
                            aria-label={`Delete attendance for ${getEmployeeName(record)}`}
                          >
                            {deletingId === record.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-gray-400">
                          Read only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isWindowModalOpen && (
        <ModalShell onClose={closeWindowModal} disabled={isSavingWindow}>
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Clock-in Window
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Set when employees are allowed to clock in for a shift.
              </p>
            </div>
            <button
              type="button"
              onClick={closeWindowModal}
              disabled={isSavingWindow}
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
              aria-label="Close clock-in window modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleWindowSubmit} className="space-y-5 p-6">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Shift
              </label>
              <select
                value={windowForm.shift}
                onChange={(event) => selectWindowShift(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                required
              >
                <option value="">Select shift</option>
                {shifts
                  .filter((shift) => shift.is_active !== false)
                  .map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name || `Shift ${shift.id}`} (
                      {formatTimeOnly(getShiftStartTime(shift))} -{" "}
                      {formatTimeOnly(getShiftEndTime(shift))})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Opens At
                </label>
                <input
                  type="time"
                  value={windowForm.opensAt}
                  onChange={(event) =>
                    setWindowForm((current) => ({
                      ...current,
                      opensAt: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Closes At
                </label>
                <input
                  type="time"
                  value={windowForm.closesAt}
                  onChange={(event) =>
                    setWindowForm((current) => ({
                      ...current,
                      closesAt: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                />
              </div>
            </div>

            <p className="rounded-lg bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
              These times are converted to minutes before and after the selected
              shift start time before being sent to the API.
            </p>

            <div className="flex justify-end gap-3 border-t pt-5">
              <button
                type="button"
                onClick={closeWindowModal}
                disabled={isSavingWindow}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingWindow}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingWindow && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Window
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {isModalOpen && (
        <ModalShell onClose={closeModal} disabled={isSaving}>
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {editingRecord ? "Edit Attendance" : "Record Attendance"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {editingRecord
                  ? "Update the selected attendance record."
                  : "Create a daily attendance record for an employee."}
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              disabled={isSaving}
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
              aria-label="Close attendance modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  name="employee"
                  value={form.employee}
                  onChange={handleChange}
                  disabled={Boolean(editingRecord)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {getEmployeeOptionLabel(employee)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Attendance Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="attendance_date"
                  value={form.attendance_date}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                >
                  {attendanceStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Shift
                </label>
                <select
                  name="shift"
                  value={form.shift}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                >
                  <option value="">No shift</option>
                  {shifts
                    .filter((shift) => shift.is_active !== false)
                    .map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name || `Shift ${shift.id}`}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Check In
                </label>
                <input
                  type="time"
                  name="clock_in"
                  value={form.clock_in}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Check Out
                </label>
                <input
                  type="time"
                  name="clock_out"
                  value={form.clock_out}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Optional attendance notes..."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>

            {form.shift && isShiftOvernight(findShift(shifts, form.shift)) && (
              <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
                This is an overnight shift. A checkout time earlier than the
                check-in/shift-start time will be saved on the following day.
              </p>
            )}

            <div className="flex justify-end gap-3 border-t pt-5">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingRecord ? "Update Attendance" : "Save Attendance"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}

function ModalShell({ children, onClose, disabled = false }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (!disabled && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        {children}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="rounded-xl bg-orange-50 p-3">
          <Icon className="h-5 w-5 text-orange-600" />
        </div>
      </div>
    </div>
  );
}

function AttendanceBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  const styles = {
    PRESENT: "bg-green-50 text-green-700 ring-green-600/20",
    ABSENT: "bg-red-50 text-red-700 ring-red-600/20",
    LATE: "bg-amber-50 text-amber-700 ring-amber-600/20",
    HALF_DAY: "bg-blue-50 text-blue-700 ring-blue-600/20",
    ON_LEAVE: "bg-purple-50 text-purple-700 ring-purple-600/20",
    OFF_DUTY: "bg-gray-100 text-gray-700 ring-gray-600/20",
  };

  const label =
    attendanceStatuses.find((item) => item.value === normalized)?.label ||
    normalized.replaceAll("_", " ") ||
    "Unknown";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        styles[normalized] || "bg-gray-100 text-gray-700 ring-gray-600/20"
      }`}
    >
      {label}
    </span>
  );
}

function getEmployeeName(record) {
  const employee = record?.employee_details || record?.employee || {};

  if (typeof employee === "string") return employee;

  const fullName = [
    employee.first_name,
    employee.middle_name,
    employee.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    record?.employee_name ||
    employee.full_name ||
    employee.name ||
    fullName ||
    "Unknown Employee"
  );
}

function getEmployeeNumber(record) {
  const employee = record?.employee_details || record?.employee || {};

  return String(
    record?.employee_number ||
      record?.employee_code ||
      employee?.employee_number ||
      employee?.employee_code ||
      employee?.code ||
      "—",
  );
}

function getEmployeeOptionLabel(employee) {
  const fullName = [
    employee?.first_name,
    employee?.middle_name,
    employee?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const name =
    employee?.full_name ||
    employee?.name ||
    fullName ||
    `Employee ${employee?.id}`;
  const number =
    employee?.employee_number ||
    employee?.employee_code ||
    employee?.code ||
    "";

  return number ? `${name} — ${number}` : name;
}

function getShiftName(record) {
  if (record?.shift_details?.name) return record.shift_details.name;
  if (record?.shift?.name) return record.shift.name;
  if (record?.shift_name) return record.shift_name;
  return "—";
}

function formatDate(value) {
  if (!value) return "—";

  const dateOnly = String(value).split("T")[0];
  const parts = dateOnly.split("-").map(Number);

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(date);
  }

  return String(value);
}

function formatTimeForInput(value) {
  if (!value) return "";

  const raw = String(value);
  const hhmm = raw.match(/(?:T|^)(\d{2}):(\d{2})/);
  if (hhmm) return `${hhmm[1]}:${hhmm[2]}`;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatTimeForDisplay(value) {
  if (!value) return "—";

  const time = formatTimeForInput(value);
  if (!time) return "—";

  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTimeOnly(value) {
  if (!value) return "—";
  const normalized = normalizeTime(value);
  if (!normalized) return "—";

  const [hours, minutes] = normalized.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatWorkedHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return "—";

  const start = parseDateTime(clockIn);
  const end = parseDateTime(clockOut);

  if (!start || !end || end < start) return "—";

  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function parseDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function combineDateAndTime(dateValue, timeValue, nextDay = false) {
  if (!dateValue || !timeValue) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);

  if (
    ![year, month, day, hours, minutes].every(Number.isFinite) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (nextDay) date.setDate(date.getDate() + 1);

  return toLocalIsoString(date);
}

function toLocalIsoString(date) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const offsetMins = pad(Math.abs(offsetMinutes) % 60);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${offsetHours}:${offsetMins}`;
}

function findShift(shifts, shiftId) {
  return shifts.find((item) => String(item.id) === String(shiftId)) || null;
}

function getShiftStartTime(shift) {
  return (
    shift?.start_time ||
    shift?.startTime ||
    shift?.shift_start ||
    shift?.shift_start_time ||
    ""
  );
}

function getShiftEndTime(shift) {
  return (
    shift?.end_time ||
    shift?.endTime ||
    shift?.shift_end ||
    shift?.shift_end_time ||
    ""
  );
}

function normalizeTime(value) {
  if (!value) return "";
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(value) {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isShiftOvernight(shift) {
  if (!shift) return false;

  const start = timeToMinutes(getShiftStartTime(shift));
  const end = timeToMinutes(getShiftEndTime(shift));
  if (start === null || end === null) return false;

  return end <= start;
}

function isOvernightClockOut(form, shifts) {
  if (!form.clock_out) return false;

  const shift = findShift(shifts, form.shift);

  if (shift && isShiftOvernight(shift)) {
    const shiftStart = timeToMinutes(getShiftStartTime(shift));
    const checkout = timeToMinutes(form.clock_out);
    if (shiftStart !== null && checkout !== null) {
      return checkout < shiftStart;
    }
  }

  if (form.clock_in) {
    const checkIn = timeToMinutes(form.clock_in);
    const checkOut = timeToMinutes(form.clock_out);
    if (checkIn !== null && checkOut !== null) {
      return checkOut < checkIn;
    }
  }

  return false;
}

function getWindowOffsetValues(shift) {
  const before = Number(
    shift?.clock_in_window_before_minutes ??
      shift?.clock_in_before_minutes ??
      shift?.early_clock_in_minutes ??
      shift?.clock_in_early_minutes ??
      0,
  );
  const after = Number(
    shift?.clock_in_window_after_minutes ??
      shift?.clock_in_after_minutes ??
      shift?.late_clock_in_minutes ??
      shift?.clock_in_late_minutes ??
      0,
  );

  return {
    before: Number.isFinite(before) ? Math.max(0, before) : 0,
    after: Number.isFinite(after) ? Math.max(0, after) : 0,
  };
}

function getClockInWindowTimes(shift) {
  const start = timeToMinutes(getShiftStartTime(shift));
  if (start === null) return { opensAt: "", closesAt: "" };

  // If the API already exposes absolute clock-in window times, use them.
  const absoluteOpen = normalizeTime(
    shift?.clock_in_window_opens_at ||
      shift?.clock_in_window_start ||
      shift?.clock_in_opens_at,
  );
  const absoluteClose = normalizeTime(
    shift?.clock_in_window_closes_at ||
      shift?.clock_in_window_end ||
      shift?.clock_in_closes_at,
  );

  if (absoluteOpen && absoluteClose) {
    return { opensAt: absoluteOpen, closesAt: absoluteClose };
  }

  const { before, after } = getWindowOffsetValues(shift);

  return {
    opensAt: minutesToTime(start - before),
    closesAt: minutesToTime(start + after),
  };
}

function getClockInWindowOffsets(shift, windowForm) {
  const start = timeToMinutes(getShiftStartTime(shift));
  const opens = timeToMinutes(windowForm.opensAt);
  const closes = timeToMinutes(windowForm.closesAt);

  if (start === null || opens === null || closes === null) {
    throw new Error("The selected shift does not have a valid start time.");
  }

  const before = (start - opens + 1440) % 1440;
  const after = (closes - start + 1440) % 1440;

  // Prefer the field names already returned by the API. This keeps the page
  // compatible with several common serializer naming conventions.
  if (Object.prototype.hasOwnProperty.call(shift, "clock_in_before_minutes")) {
    return {
      clock_in_before_minutes: before,
      clock_in_after_minutes: after,
    };
  }

  if (Object.prototype.hasOwnProperty.call(shift, "early_clock_in_minutes")) {
    return {
      early_clock_in_minutes: before,
      late_clock_in_minutes: after,
    };
  }

  if (Object.prototype.hasOwnProperty.call(shift, "clock_in_early_minutes")) {
    return {
      clock_in_early_minutes: before,
      clock_in_late_minutes: after,
    };
  }

  // Default contract used by this page.
  return {
    clock_in_window_before_minutes: before,
    clock_in_window_after_minutes: after,
  };
}
