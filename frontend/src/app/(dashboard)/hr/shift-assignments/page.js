"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarClock,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  createShiftAssignment,
  deleteShiftAssignment,
  getEmployees,
  getShiftAssignments,
  getShifts,
  normalizeResults,
  updateShiftAssignment,
} from "@/lib/api/hr";

const initialForm = {
  employee: "",
  shift: "",
  start_date: "",
  end_date: "",
  notes: "",
  is_active: true,
};

function getEmployeeName(employee) {
  return (
    employee.full_name ||
    [
      employee.first_name,
      employee.middle_name,
      employee.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unnamed employee"
  );
}

function getEmployeeLabel(employee) {
  const name = getEmployeeName(employee);

  return employee.employee_number
    ? `${employee.employee_number} — ${name}`
    : name;
}

function formatDate(value) {
  if (!value) {
    return "No end date";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ShiftAssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState(null);
  const [form, setForm] = useState(initialForm);

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getShiftAssignments({
        search,
        ordering: "-start_date",
      });

      setAssignments(normalizeResults(data));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load shift assignments."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadFormOptions = useCallback(async () => {
    try {
      const [employeeData, shiftData] = await Promise.all([
        getEmployees({
          ordering: "first_name",
        }),
        getShifts({
          ordering: "name",
        }),
      ]);

      setEmployees(normalizeResults(employeeData));
      setShifts(normalizeResults(shiftData));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load employees and shifts."
      );
    }
  }, []);

  useEffect(() => {
    loadFormOptions();
  }, [loadFormOptions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadAssignments();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [loadAssignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const employeeMatches =
        !employeeFilter ||
        String(assignment.employee) ===
          String(employeeFilter);

      const shiftMatches =
        !shiftFilter ||
        String(assignment.shift) === String(shiftFilter);

      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          assignment.is_active) ||
        (statusFilter === "inactive" &&
          !assignment.is_active);

      return (
        employeeMatches &&
        shiftMatches &&
        statusMatches
      );
    });
  }, [
    assignments,
    employeeFilter,
    shiftFilter,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const activeAssignments = assignments.filter(
      (assignment) => assignment.is_active
    );

    const employeeIds = new Set(
      activeAssignments.map((assignment) =>
        String(assignment.employee)
      )
    );

    const shiftIds = new Set(
      activeAssignments.map((assignment) =>
        String(assignment.shift)
      )
    );

    return {
      total: assignments.length,
      active: activeAssignments.length,
      employees: employeeIds.size,
      shifts: shiftIds.size,
    };
  }, [assignments]);

  function openCreateModal() {
    setEditingAssignment(null);
    setForm(initialForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(assignment) {
    setEditingAssignment(assignment);

    setForm({
      employee: assignment.employee
        ? String(assignment.employee)
        : "",
      shift: assignment.shift
        ? String(assignment.shift)
        : "",
      start_date: assignment.start_date || "",
      end_date: assignment.end_date || "",
      notes: assignment.notes || "",
      is_active: Boolean(assignment.is_active),
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) {
      return;
    }

    setModalOpen(false);
    setEditingAssignment(null);
    setForm(initialForm);
  }

  function handleFormChange(event) {
    const { name, value, type, checked } =
      event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    if (
      form.end_date &&
      form.start_date &&
      form.end_date < form.start_date
    ) {
      setError(
        "The end date cannot be earlier than the start date."
      );
      setSubmitting(false);
      return;
    }

    const payload = {
      employee: form.employee,
      shift: form.shift,
      start_date: form.start_date,
      end_date: form.end_date || null,
      notes: form.notes.trim(),
      is_active: form.is_active,
    };

    try {
      if (editingAssignment) {
        await updateShiftAssignment(
          editingAssignment.id,
          payload
        );

        setSuccess(
          "Shift assignment updated successfully."
        );
      } else {
        await createShiftAssignment(payload);

        setSuccess(
          "Shift assigned to employee successfully."
        );
      }

      setModalOpen(false);
      setEditingAssignment(null);
      setForm(initialForm);

      await loadAssignments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingAssignment
            ? "Unable to update shift assignment."
            : "Unable to create shift assignment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(assignment) {
    const confirmed = window.confirm(
      `Delete the shift assignment for ${
        assignment.employee_name || "this employee"
      }?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(assignment.id);
      setError("");
      setSuccess("");

      await deleteShiftAssignment(assignment.id);

      setSuccess(
        "Shift assignment deleted successfully."
      );

      await loadAssignments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete shift assignment."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setEmployeeFilter("");
    setShiftFilter("");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Shift Assignments
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Assign employees to hospital work shifts.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <Plus size={18} />
          Assign Shift
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Assignments"
          value={summary.total}
          icon={CalendarClock}
        />

        <SummaryCard
          title="Active Assignments"
          value={summary.active}
          icon={CheckCircle2}
        />

        <SummaryCard
          title="Assigned Employees"
          value={summary.employees}
          icon={UsersRound}
        />

        <SummaryCard
          title="Assigned Shifts"
          value={summary.shifts}
          icon={CalendarClock}
        />
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_220px_170px_auto]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search employee or shift..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <select
            value={employeeFilter}
            onChange={(event) =>
              setEmployeeFilter(event.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All employees</option>

            {employees.map((employee) => (
              <option
                key={employee.id}
                value={employee.id}
              >
                {getEmployeeLabel(employee)}
              </option>
            ))}
          </select>

          <select
            value={shiftFilter}
            onChange={(event) =>
              setShiftFilter(event.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All shifts</option>

            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
          Loading shift assignments...
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
          <UserRound
            size={44}
            className="mx-auto text-gray-300"
          />

          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            No shift assignments found
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Assign an employee to a shift to get started.
          </p>

          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus size={18} />
            Assign Shift
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Employee",
                    "Shift",
                    "Start Date",
                    "End Date",
                    "Notes",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredAssignments.map(
                  (assignment) => (
                    <tr
                      key={assignment.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-4 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {assignment.employee_name ||
                            "Employee"}
                        </p>

                        <p className="mt-0.5 text-xs text-gray-500">
                          Employee assignment
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <p className="text-sm font-medium text-gray-800">
                          {assignment.shift_name ||
                            "Unknown shift"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                        {formatDate(
                          assignment.start_date
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                        {formatDate(assignment.end_date)}
                      </td>

                      <td className="max-w-xs px-4 py-4 text-sm text-gray-600">
                        <p className="line-clamp-2">
                          {assignment.notes || "—"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            assignment.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {assignment.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                assignment
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            <Edit3 size={15} />
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={
                              deletingId ===
                              assignment.id
                            }
                            onClick={() =>
                              handleDelete(
                                assignment
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId ===
                            assignment.id ? (
                              <Loader2
                                size={15}
                                className="animate-spin"
                              />
                            ) : (
                              <Trash2 size={15} />
                            )}

                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingAssignment
                    ? "Edit Shift Assignment"
                    : "Assign Shift"}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Select an employee and their work
                  shift.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Employee"
                  required
                >
                  <select
                    name="employee"
                    value={form.employee}
                    onChange={handleFormChange}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">
                      Select employee
                    </option>

                    {employees.map((employee) => (
                      <option
                        key={employee.id}
                        value={employee.id}
                      >
                        {getEmployeeLabel(employee)}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Shift" required>
                  <select
                    name="shift"
                    value={form.shift}
                    onChange={handleFormChange}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">
                      Select shift
                    </option>

                    {shifts.map((shift) => (
                      <option
                        key={shift.id}
                        value={shift.id}
                      >
                        {shift.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Start date"
                  required
                >
                  <input
                    type="date"
                    name="start_date"
                    value={form.start_date}
                    onChange={handleFormChange}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </FormField>

                <FormField label="End date">
                  <input
                    type="date"
                    name="end_date"
                    value={form.end_date}
                    onChange={handleFormChange}
                    min={form.start_date || undefined}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </FormField>
              </div>

              <FormField label="Notes">
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  rows={4}
                  placeholder="Add assignment notes..."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </FormField>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-gray-50 p-4">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleFormChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />

                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    Active assignment
                  </span>

                  <span className="mt-0.5 block text-xs text-gray-500">
                    The employee is currently assigned
                    to this shift.
                  </span>
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {editingAssignment
                    ? "Save Changes"
                    : "Assign Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold text-gray-900">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  required = false,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}
