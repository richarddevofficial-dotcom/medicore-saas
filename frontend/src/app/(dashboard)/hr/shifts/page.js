"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Edit,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { hrApi, getApiError } from "@/services/hr";

const emptyForm = {
  name: "",
  start_time: "",
  end_time: "",
  description: "",
  is_active: true,
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingShift, setEditingShift] = useState(null);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadShifts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const data = await hrApi.getShifts();
      setShifts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getApiError(err, "Unable to load shifts."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const filteredShifts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return shifts;
    }

    return shifts.filter((shift) => {
      return [
        shift.name,
        shift.description,
        shift.start_time,
        shift.end_time,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(keyword),
        );
    });
  }, [search, shifts]);

  function openCreateModal() {
    setEditingShift(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setIsModalOpen(true);
  }

  function openEditModal(shift) {
    setEditingShift(shift);

    setForm({
      name: shift.name || "",
      start_time: formatTimeForInput(shift.start_time),
      end_time: formatTimeForInput(shift.end_time),
      description: shift.description || "",
      is_active: shift.is_active ?? true,
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
    setEditingShift(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Shift name is required.");
      return;
    }

    if (!form.start_time || !form.end_time) {
      setError("Start time and end time are required.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        name: form.name.trim(),
        start_time: form.start_time,
        end_time: form.end_time,
        description: form.description.trim(),
        is_active: form.is_active,
      };

      if (editingShift) {
        await hrApi.updateShift(editingShift.id, payload);
        setSuccess("Shift updated successfully.");
      } else {
        await hrApi.createShift(payload);
        setSuccess("Shift created successfully.");
      }

      closeModal();
      await loadShifts();
    } catch (err) {
      setError(
        getApiError(
          err,
          editingShift
            ? "Unable to update the shift."
            : "Unable to create the shift.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(shift) {
    const confirmed = window.confirm(
      `Delete the shift "${shift.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(shift.id);
      setError("");
      setSuccess("");

      await hrApi.deleteShift(shift.id);

      setSuccess("Shift deleted successfully.");
      await loadShifts();
    } catch (err) {
      setError(getApiError(err, "Unable to delete the shift."));
    } finally {
      setDeletingId(null);
    }
  }

  const activeCount = shifts.filter(
    (shift) => shift.is_active !== false,
  ).length;

  const inactiveCount = shifts.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-50 p-3">
              <Clock3 className="h-6 w-6 text-orange-600" />
            </div>

            <div>
              <p className="text-sm font-medium text-orange-600">
                Human Resources
              </p>

              <h1 className="text-2xl font-bold text-gray-900">
                Shift Management
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Create and manage employee work shifts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" />
            Add Shift
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total Shifts"
          value={shifts.length}
        />

        <SummaryCard
          label="Active Shifts"
          value={activeCount}
        />

        <SummaryCard
          label="Inactive Shifts"
          value={inactiveCount}
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
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shifts..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="p-10 text-center">
            <Clock3 className="mx-auto h-12 w-12 text-gray-300" />

            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              No shifts found
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Create a work shift to begin managing employee schedules.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    Shift
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Start Time
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    End Time
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
                {filteredShifts.map((shift) => (
                  <tr
                    key={shift.id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">
                        {shift.name}
                      </p>

                      {shift.description && (
                        <p className="mt-1 max-w-md truncate text-xs text-gray-500">
                          {shift.description}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 text-gray-700">
                      {formatTimeForDisplay(shift.start_time)}
                    </td>

                    <td className="px-5 py-4 text-gray-700">
                      {formatTimeForDisplay(shift.end_time)}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge active={shift.is_active !== false} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(shift)}
                          className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                          title="Edit shift"
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(shift)}
                          disabled={deletingId === shift.id}
                          className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Delete shift"
                        >
                          {deletingId === shift.id ? (
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
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingShift ? "Edit Shift" : "Add Shift"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter the shift working hours and details.
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
              <div className="space-y-4 p-6">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Shift Name
                  </label>

                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Example: Morning Shift"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="start_time"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Start Time
                    </label>

                    <input
                      id="start_time"
                      name="start_time"
                      type="time"
                      value={form.start_time}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="end_time"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      End Time
                    </label>

                    <input
                      id="end_time"
                      name="end_time"
                      type="time"
                      value={form.end_time}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Description
                  </label>

                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Optional shift description"
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />

                  <span>
                    <span className="block text-sm font-medium text-gray-800">
                      Active Shift
                    </span>

                    <span className="block text-xs text-gray-500">
                      Employees can be assigned to this shift.
                    </span>
                  </span>
                </label>
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

                  {editingShift ? "Update Shift" : "Create Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={
        active
          ? "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700"
          : "inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600"
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
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
