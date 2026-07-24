"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Edit3,
  FileCheck2,
  Loader2,
  Plus,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import { getApiError, hrApi } from "@/services/hr";

const initialForm = {
  name: "",
  code: "",
  days_allowed: "",
  is_paid: true,
  requires_document: false,
  is_active: true,
};

function normalizeCode(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function LeaveTypesPage() {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [form, setForm] = useState(initialForm);

  const loadLeaveTypes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        ordering: "name",
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      const data = await hrApi.getLeaveTypes(params);
      setLeaveTypes(data);
    } catch (err) {
      setError(getApiError(err, "Unable to load leave types."));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(loadLeaveTypes, 300);
    return () => clearTimeout(timer);
  }, [loadLeaveTypes]);

  const summary = useMemo(() => {
    return leaveTypes.reduce(
      (totals, item) => {
        totals.total += 1;

        if (item.is_active) totals.active += 1;
        if (item.is_paid) totals.paid += 1;
        if (item.requires_document) totals.documentRequired += 1;

        return totals;
      },
      {
        total: 0,
        active: 0,
        paid: 0,
        documentRequired: 0,
      },
    );
  }, [leaveTypes]);

  function openCreateModal() {
    setEditingType(null);
    setForm(initialForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(leaveType) {
    setEditingType(leaveType);
    setForm({
      name: leaveType.name || "",
      code: leaveType.code || "",
      days_allowed: leaveType.days_allowed ?? "",
      is_paid: Boolean(leaveType.is_paid),
      requires_document: Boolean(leaveType.requires_document),
      is_active: Boolean(leaveType.is_active),
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;

    setModalOpen(false);
    setEditingType(null);
    setForm(initialForm);
  }

  function updateForm(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function updateName(event) {
    const value = event.target.value;

    setForm((current) => ({
      ...current,
      name: value,
      code:
        editingType || current.code
          ? current.code
          : normalizeCode(value),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name.trim(),
      code: normalizeCode(form.code),
      days_allowed: Number(form.days_allowed),
      is_paid: form.is_paid,
      requires_document: form.requires_document,
      is_active: form.is_active,
    };

    try {
      if (editingType) {
        await hrApi.updateLeaveType(editingType.id, payload);
        setSuccess("Leave type updated successfully.");
      } else {
        await hrApi.createLeaveType(payload);
        setSuccess("Leave type created successfully.");
      }

      closeModal();
      await loadLeaveTypes();
    } catch (err) {
      setError(
        getApiError(
          err,
          editingType
            ? "Unable to update leave type."
            : "Unable to create leave type.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(leaveType) {
    const confirmed = window.confirm(
      `Delete "${leaveType.name}"?\n\nLeave types already used by leave requests may not be deletable. You can edit and deactivate it instead.`,
    );

    if (!confirmed) return;

    setDeletingId(leaveType.id);
    setError("");
    setSuccess("");

    try {
      await hrApi.deleteLeaveType(leaveType.id);
      setSuccess("Leave type deleted successfully.");
      await loadLeaveTypes();
    } catch (err) {
      setError(
        getApiError(
          err,
          "Unable to delete this leave type. Deactivate it if it is already in use.",
        ),
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6 px-4 pb-8 sm:px-0">
      <header className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leave Types</h1>

          <p className="mt-1 text-sm text-gray-500">
            Configure leave entitlement, payment status and document
            requirements.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          Add Leave Type
        </button>
      </header>

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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Leave Types"
          value={summary.total}
          icon={CalendarDays}
        />

        <SummaryCard
          label="Active Types"
          value={summary.active}
          icon={CheckCircle2}
        />

        <SummaryCard
          label="Paid Leave"
          value={summary.paid}
          icon={WalletCards}
        />

        <SummaryCard
          label="Document Required"
          value={summary.documentRequired}
          icon={FileCheck2}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by leave type name or code..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : leaveTypes.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <CalendarDays className="h-12 w-12 text-gray-300" />

            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              No leave types found
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Add Annual Leave, Sick Leave or another leave type.
            </p>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Add Leave Type
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Leave Type",
                    "Code",
                    "Days Allowed",
                    "Payment",
                    "Document",
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
                {leaveTypes.map((leaveType) => (
                  <tr
                    key={leaveType.id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {leaveType.name}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-semibold text-gray-700">
                        {leaveType.code}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-gray-800">
                      {leaveType.days_allowed} days
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <StatusBadge
                        enabled={leaveType.is_paid}
                        enabledText="Paid"
                        disabledText="Unpaid"
                      />
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <StatusBadge
                        enabled={leaveType.requires_document}
                        enabledText="Required"
                        disabledText="Optional"
                      />
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <StatusBadge
                        enabled={leaveType.is_active}
                        enabledText="Active"
                        disabledText="Inactive"
                      />
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(leaveType)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === leaveType.id}
                          onClick={() => handleDelete(leaveType)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === leaveType.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}

                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <Modal
          title={editingType ? "Edit Leave Type" : "Add Leave Type"}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Leave type name" required>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={updateName}
                required
                placeholder="Example: Annual Leave"
                className="input-field"
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Code" required>
                <input
                  type="text"
                  name="code"
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: normalizeCode(event.target.value),
                    }))
                  }
                  required
                  placeholder="ANNUAL"
                  className="input-field uppercase"
                />
              </FormField>

              <FormField label="Days allowed" required>
                <input
                  type="number"
                  name="days_allowed"
                  value={form.days_allowed}
                  onChange={updateForm}
                  required
                  min="0"
                  step="1"
                  placeholder="21"
                  className="input-field"
                />
              </FormField>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <CheckboxField
                name="is_paid"
                checked={form.is_paid}
                onChange={updateForm}
                label="Paid leave"
                description="Employees remain entitled to payment during this leave."
              />

              <CheckboxField
                name="requires_document"
                checked={form.requires_document}
                onChange={updateForm}
                label="Require supporting document"
                description="The employee must upload evidence when requesting this leave."
              />

              <CheckboxField
                name="is_active"
                checked={form.is_active}
                onChange={updateForm}
                label="Active"
                description="Active leave types can be selected in new requests."
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
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
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {editingType ? "Save Changes" : "Create Leave Type"}
              </button>
            </div>
          </form>
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
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>

        <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  enabled,
  enabledText,
  disabledText,
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        enabled
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {enabled ? enabledText : disabledText}
    </span>
  );
}

function CheckboxField({
  name,
  checked,
  onChange,
  label,
  description,
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
      />

      <span>
        <span className="block text-sm font-semibold text-gray-800">
          {label}
        </span>

        <span className="mt-0.5 block text-xs text-gray-500">
          {description}
        </span>
      </span>
    </label>
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
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>

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
