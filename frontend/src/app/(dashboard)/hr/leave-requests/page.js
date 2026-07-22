"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Loader2,
  Plus,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { getApiError, hrApi } from "@/services/hr";

const initialForm = {
  employee: "",
  leave_type: "",
  start_date: "",
  end_date: "",
  reason: "",
  supporting_document: null,
};

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getEmployeeLabel(employee) {
  const name =
    employee.full_name ||
    [employee.first_name, employee.middle_name, employee.last_name]
      .filter(Boolean)
      .join(" ");

  return employee.employee_number
    ? `${employee.employee_number} — ${name}`
    : name || "Unnamed employee";
}

export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const [form, setForm] = useState(initialForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        ordering: "-created_at",
      };

      if (status) params.status = status;
      if (leaveTypeFilter) params.leave_type = leaveTypeFilter;
      if (search.trim()) params.search = search.trim();

      const [requestData, employeeData, leaveTypeData] =
        await Promise.all([
          hrApi.getLeaveRequests(params),
          hrApi.getEmployees({
            is_active: true,
            ordering: "first_name",
          }),
          hrApi.getLeaveTypes({
            is_active: true,
            ordering: "name",
          }),
        ]);

      setRequests(requestData);
      setEmployees(employeeData);
      setLeaveTypes(leaveTypeData);
    } catch (err) {
      setError(getApiError(err, "Unable to load leave requests."));
    } finally {
      setLoading(false);
    }
  }, [leaveTypeFilter, search, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);

    return () => clearTimeout(timer);
  }, [loadData]);

  const summary = useMemo(() => {
    return requests.reduce(
      (totals, item) => {
        totals.all += 1;

        if (item.status === "PENDING") totals.pending += 1;
        if (item.status === "APPROVED") totals.approved += 1;
        if (item.status === "REJECTED") totals.rejected += 1;

        return totals;
      },
      {
        all: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      },
    );
  }, [requests]);

  function updateForm(event) {
    const { name, value, files } = event.target;

    setForm((current) => ({
      ...current,
      [name]: files ? files[0] || null : value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setShowCreateModal(false);
  }

  async function handleCreate(event) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const selectedLeaveType = leaveTypes.find(
        (item) => String(item.id) === String(form.leave_type),
      );

      let payload;

      if (form.supporting_document) {
        payload = new FormData();
        payload.append("employee", form.employee);
        payload.append("leave_type", form.leave_type);
        payload.append("start_date", form.start_date);
        payload.append("end_date", form.end_date);
        payload.append("reason", form.reason);
        payload.append(
          "supporting_document",
          form.supporting_document,
        );
      } else {
        payload = {
          employee: form.employee,
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason,
        };
      }

      if (
        selectedLeaveType?.requires_document &&
        !form.supporting_document
      ) {
        setError(
          "A supporting document is required for this leave type.",
        );
        return;
      }

      await hrApi.createLeaveRequest(payload);

      setSuccess("Leave request created successfully.");
      resetForm();
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to create leave request."));
    } finally {
      setSubmitting(false);
    }
  }

  function openReview(request, action) {
    setReviewModal({
      request,
      action,
    });
    setReviewNotes("");
    setError("");
  }

  async function handleReview() {
    if (!reviewModal) return;

    const { request, action } = reviewModal;

    setActionId(request.id);
    setError("");
    setSuccess("");

    try {
      if (action === "approve") {
        await hrApi.approveLeaveRequest(
          request.id,
          reviewNotes,
        );
        setSuccess("Leave request approved successfully.");
      } else {
        await hrApi.rejectLeaveRequest(
          request.id,
          reviewNotes,
        );
        setSuccess("Leave request rejected successfully.");
      }

      setReviewModal(null);
      setReviewNotes("");
      await loadData();
    } catch (err) {
      setError(
        getApiError(
          err,
          `Unable to ${action} the leave request.`,
        ),
      );
    } finally {
      setActionId(null);
    }
  }

  const selectedLeaveType = leaveTypes.find(
    (item) => String(item.id) === String(form.leave_type),
  );

  return (
    <div className="space-y-6 px-4 pb-8 sm:px-0">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Leave Requests
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create, review, approve and reject employee leave requests.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateModal(true);
            setError("");
            setSuccess("");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          New Leave Request
        </button>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Requests"
          value={summary.all}
          icon={FileText}
        />

        <SummaryCard
          label="Pending"
          value={summary.pending}
          icon={Clock3}
        />

        <SummaryCard
          label="Approved"
          value={summary.approved}
          icon={Check}
        />

        <SummaryCard
          label="Rejected"
          value={summary.rejected}
          icon={XCircle}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_200px_220px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee or reason..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={leaveTypeFilter}
            onChange={(event) =>
              setLeaveTypeFilter(event.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All leave types</option>

            {leaveTypes.map((leaveType) => (
              <option key={leaveType.id} value={leaveType.id}>
                {leaveType.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("");
              setLeaveTypeFilter("");
            }}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <CalendarDays className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No leave requests found
            </h3>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              Create a new leave request or adjust the filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Employee",
                    "Leave Type",
                    "Dates",
                    "Days",
                    "Status",
                    "Reason",
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
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {request.employee_name || "Employee"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                      {request.leave_type_name || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                      <p>{formatDate(request.start_date)}</p>
                      <p className="text-xs text-gray-400">
                        to {formatDate(request.end_date)}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-700">
                      {request.total_days}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          statusStyles[request.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>

                    <td className="max-w-xs px-4 py-4 text-sm text-gray-600">
                      <p className="line-clamp-2">
                        {request.reason || "—"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      {request.status === "PENDING" ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openReview(request, "approve")
                            }
                            disabled={actionId === request.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openReview(request, "reject")
                            }
                            disabled={actionId === request.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Reviewed
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

      {showCreateModal && (
        <Modal
          title="New Leave Request"
          onClose={resetForm}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <FormField label="Employee" required>
              <select
                name="employee"
                value={form.employee}
                onChange={updateForm}
                required
                className="input-field"
              >
                <option value="">Select employee</option>

                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {getEmployeeLabel(employee)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Leave type" required>
              <select
                name="leave_type"
                value={form.leave_type}
                onChange={updateForm}
                required
                className="input-field"
              >
                <option value="">Select leave type</option>

                {leaveTypes.map((leaveType) => (
                  <option key={leaveType.id} value={leaveType.id}>
                    {leaveType.name}
                    {leaveType.days_allowed
                      ? ` (${leaveType.days_allowed} days)`
                      : ""}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Start date" required>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={updateForm}
                  required
                  className="input-field"
                />
              </FormField>

              <FormField label="End date" required>
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={updateForm}
                  required
                  className="input-field"
                />
              </FormField>
            </div>

            <FormField label="Reason" required>
              <textarea
                name="reason"
                value={form.reason}
                onChange={updateForm}
                rows={4}
                required
                placeholder="Enter the reason for leave..."
                className="input-field resize-none"
              />
            </FormField>

            <FormField
              label={`Supporting document${
                selectedLeaveType?.requires_document
                  ? " — required"
                  : ""
              }`}
              required={selectedLeaveType?.requires_document}
            >
              <input
                type="file"
                name="supporting_document"
                onChange={updateForm}
                required={selectedLeaveType?.requires_document}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </FormField>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Submit Request
              </button>
            </div>
          </form>
        </Modal>
      )}

      {reviewModal && (
        <Modal
          title={
            reviewModal.action === "approve"
              ? "Approve Leave Request"
              : "Reject Leave Request"
          }
          onClose={() => {
            setReviewModal(null);
            setReviewNotes("");
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">
                {reviewModal.request.employee_name}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {reviewModal.request.leave_type_name} ·{" "}
                {reviewModal.request.total_days} day(s)
              </p>
            </div>

            <FormField label="Review notes">
              <textarea
                value={reviewNotes}
                onChange={(event) =>
                  setReviewNotes(event.target.value)
                }
                rows={4}
                placeholder="Optional review notes..."
                className="input-field resize-none"
              />
            </FormField>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleReview}
                disabled={actionId === reviewModal.request.id}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
                  reviewModal.action === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionId === reviewModal.request.id && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {reviewModal.action === "approve"
                  ? "Approve Request"
                  : "Reject Request"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style jsx global>{`
        .input-field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(209 213 219);
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }

        .input-field:focus {
          border-color: rgb(249 115 22);
          box-shadow: 0 0 0 2px rgb(255 237 213);
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      {children}
    </label>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <h3 className="text-lg font-bold text-gray-900">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
