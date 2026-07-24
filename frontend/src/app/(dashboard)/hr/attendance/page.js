"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { getApiError, hrApi } from "@/services/hr";

const attendanceStatuses = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "half_day", label: "Half Day" },
  { value: "leave", label: "On Leave" },
];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function createEmptyForm() {
  return {
    employee: "",
    shift: "",
    date: getToday(),
    check_in: "",
    check_out: "",
    status: "present",
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [attendanceData, employeeData, shiftData] =
        await Promise.all([
          hrApi.getAttendance(),
          hrApi.getEmployees(),
          hrApi.getShifts(),
        ]);

      setAttendance(
        Array.isArray(attendanceData) ? attendanceData : [],
      );

      setEmployees(
        Array.isArray(employeeData) ? employeeData : [],
      );

      setShifts(Array.isArray(shiftData) ? shiftData : []);
    } catch (err) {
      setError(
        getApiError(err, "Unable to load attendance records."),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAttendance = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return attendance.filter((record) => {
      const employeeName = getEmployeeName(record);
      const employeeNumber =
        record.employee_number ||
        record.employee_code ||
        record.employee_details?.employee_number ||
        "";

      const matchesSearch =
        !keyword ||
        employeeName.toLowerCase().includes(keyword) ||
        String(employeeNumber).toLowerCase().includes(keyword) ||
        String(record.notes || "").toLowerCase().includes(keyword);

      const matchesStatus =
        !statusFilter ||
        String(record.status || "").toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesDate =
        !dateFilter || record.date === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [attendance, dateFilter, search, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: attendance.length,
      present: attendance.filter(
        (record) =>
          String(record.status).toLowerCase() === "present",
      ).length,
      absent: attendance.filter(
        (record) =>
          String(record.status).toLowerCase() === "absent",
      ).length,
      late: attendance.filter(
        (record) =>
          String(record.status).toLowerCase() === "late",
      ).length,
    };
  }, [attendance]);

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
        record.employee?.id ||
          record.employee_details?.id ||
          record.employee ||
          "",
      ),
      shift: String(
        record.shift?.id ||
          record.shift_details?.id ||
          record.shift ||
          "",
      ),
      date: record.date || getToday(),
      check_in: formatTimeForInput(record.check_in),
      check_out: formatTimeForInput(record.check_out),
      status: record.status || "present",
      notes: record.notes || "",
    });

    setError("");
    setSuccess("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingRecord(null);
    setForm(createEmptyForm());
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

    if (!form.date) {
      setError("Attendance date is required.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        employee: Number(form.employee),
        date: form.date,
        status: form.status,
        notes: form.notes.trim(),
        check_in: form.check_in || null,
        check_out: form.check_out || null,
      };

      if (form.shift) {
        payload.shift = Number(form.shift);
      } else {
        payload.shift = null;
      }

      if (editingRecord) {
        await hrApi.updateAttendance(
          editingRecord.id,
          payload,
        );

        setSuccess("Attendance record updated successfully.");
      } else {
        await hrApi.createAttendance(payload);
        setSuccess("Attendance recorded successfully.");
      }

      closeModal();
      await loadData();
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

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(record.id);
      setError("");
      setSuccess("");

      await hrApi.deleteAttendance(record.id);

      setSuccess("Attendance record deleted successfully.");
      await loadData();
    } catch (err) {
      setError(
        getApiError(err, "Unable to delete attendance."),
      );
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setDateFilter("");
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

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" />
            Record Attendance
          </button>
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

        <SummaryCard
          label="Absent"
          value={summary.absent}
          icon={UserX}
        />

        <SummaryCard
          label="Late"
          value={summary.late}
          icon={Clock3}
        />
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
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search employee..."
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            >
              <option value="">All statuses</option>

              {attendanceStatuses.map((status) => (
                <option
                  key={status.value}
                  value={status.value}
                >
                  {status.label}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(event.target.value)
              }
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
                  <th className="px-5 py-3 font-semibold">
                    Employee
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Date
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Shift
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Check In
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Check Out
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredAttendance.map((record) => (
                  <tr
                    key={record.id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">
                        {getEmployeeName(record)}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {getEmployeeNumber(record)}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-gray-700">
                      {formatDate(record.date)}
                    </td>

                    <td className="px-5 py-4 text-gray-700">
                      {getShiftName(record)}
                    </td>

                    <td className="px-5 py-4 text-gray-700">
                      {formatTimeForDisplay(record.check_in)}
                    </td>

                    <td className="px-5 py-4 text-gray-700">
                      {formatTimeForDisplay(record.check_out)}
                    </td>

                    <td className="px-5 py-4">
                      <AttendanceBadge status={record.status} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(record)
                          }
                          className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                          title="Edit attendance"
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(record)}
                          disabled={deletingId === record.id}
                          className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Delete attendance"
                        >
                          {deletingId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingRecord
                    ? "Edit Attendance"
                    : "Record Attendance"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter the employee attendance information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-5 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="employee"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Employee
                    </label>

                    <select
                      id="employee"
                      name="employee"
                      value={form.employee}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    >
                      <option value="">
                        Select employee
                      </option>

                      {employees.map((employee) => (
                        <option
                          key={employee.id}
                          value={employee.id}
                        >
                          {getEmployeeOptionLabel(employee)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="date"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Attendance Date
                    </label>

                    <input
                      id="date"
                      name="date"
                      type="date"
                      value={form.date}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="shift"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Shift
                    </label>

                    <select
                      id="shift"
                      name="shift"
                      value={form.shift}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    >
                      <option value="">No shift selected</option>

                      {shifts
                        .filter(
                          (shift) =>
                            shift.is_active !== false,
                        )
                        .map((shift) => (
                          <option
                            key={shift.id}
                            value={shift.id}
                          >
                            {shift.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="status"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Status
                    </label>

                    <select
                      id="status"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    >
                      {attendanceStatuses.map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="check_in"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Check-in Time
                    </label>

                    <input
                      id="check_in"
                      name="check_in"
                      type="time"
                      value={form.check_in}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="check_out"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Check-out Time
                    </label>

                    <input
                      id="check_out"
                      name="check_out"
                      type="time"
                      value={form.check_out}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="notes"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Notes
                  </label>

                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Optional attendance notes"
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4">
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
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {editingRecord
                    ? "Update Attendance"
                    : "Save Attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold text-gray-900">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-orange-50 p-3">
          <Icon className="h-5 w-5 text-orange-600" />
        </div>
      </div>
    </div>
  );
}

function AttendanceBadge({ status }) {
  const normalizedStatus = String(
    status || "unknown",
  ).toLowerCase();

  const labels = {
    present: "Present",
    absent: "Absent",
    late: "Late",
    half_day: "Half Day",
    leave: "On Leave",
  };

  const styles = {
    present: "bg-green-100 text-green-700",
    absent: "bg-red-100 text-red-700",
    late: "bg-yellow-100 text-yellow-700",
    half_day: "bg-blue-100 text-blue-700",
    leave: "bg-purple-100 text-purple-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[normalizedStatus] ||
        "bg-gray-100 text-gray-700"
      }`}
    >
      {labels[normalizedStatus] || status || "Unknown"}
    </span>
  );
}

function getEmployeeName(record) {
  const employee =
    record.employee_details ||
    record.employee_data ||
    (typeof record.employee === "object"
      ? record.employee
      : null);

  if (record.employee_name) {
    return record.employee_name;
  }

  if (employee?.full_name) {
    return employee.full_name;
  }

  const firstName =
    employee?.first_name ||
    employee?.user?.first_name ||
    "";

  const lastName =
    employee?.last_name ||
    employee?.user?.last_name ||
    "";

  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "Unknown Employee";
}

function getEmployeeNumber(record) {
  const employee =
    record.employee_details ||
    record.employee_data ||
    (typeof record.employee === "object"
      ? record.employee
      : null);

  return (
    record.employee_number ||
    record.employee_code ||
    employee?.employee_number ||
    employee?.employee_code ||
    "No employee number"
  );
}

function getEmployeeOptionLabel(employee) {
  const name =
    employee.full_name ||
    `${employee.first_name || employee.user?.first_name || ""} ${
      employee.last_name || employee.user?.last_name || ""
    }`.trim() ||
    employee.user?.username ||
    `Employee ${employee.id}`;

  const employeeNumber =
    employee.employee_number || employee.employee_code;

  return employeeNumber
    ? `${name} (${employeeNumber})`
    : name;
}

function getShiftName(record) {
  if (record.shift_name) {
    return record.shift_name;
  }

  if (record.shift_details?.name) {
    return record.shift_details.name;
  }

  if (
    typeof record.shift === "object" &&
    record.shift?.name
  ) {
    return record.shift.name;
  }

  return "—";
}

function formatTimeForInput(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 5);
}

function formatTimeForDisplay(value) {
  if (!value) {
    return "—";
  }

  const time = String(value).slice(0, 5);
  const [hourValue, minute] = time.split(":");
  const hour = Number(hourValue);

  if (Number.isNaN(hour)) {
    return time;
  }

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${period}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
