"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { getApiError, hrApi } from "@/services/hr";

const emptyForm = {
  title: "",
  code: "",
  department: "",
  description: "",
  is_active: true,
};

export default function PositionsPage() {
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [positionData, departmentData] =
        await Promise.all([
          hrApi.getPositions({ ordering: "title" }),
          hrApi.getDepartments({ ordering: "name" }),
        ]);

      setPositions(positionData);
      setDepartments(departmentData);
    } catch (error) {
      toast.error(
        getApiError(error, "Unable to load HR positions."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPositions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return positions.filter((position) => {
      const matchesSearch =
        !query ||
        String(position.title || "")
          .toLowerCase()
          .includes(query) ||
        String(position.code || "")
          .toLowerCase()
          .includes(query) ||
        String(position.department_name || "")
          .toLowerCase()
          .includes(query);

      const matchesDepartment =
        !departmentFilter ||
        String(position.department) ===
          String(departmentFilter);

      return matchesSearch && matchesDepartment;
    });
  }, [positions, search, departmentFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (position) => {
    setEditing(position);
    setForm({
      title: position.title || "",
      code: position.code || "",
      department: position.department || "",
      description: position.description || "",
      is_active: position.is_active !== false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const submitForm = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      toast.error("Position title is required.");
      return;
    }

    if (!form.code.trim()) {
      toast.error("Position code is required.");
      return;
    }

    if (!form.department) {
      toast.error("Select a department.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      code: form.code.trim().toUpperCase(),
      department: Number(form.department),
      description: form.description.trim(),
      is_active: form.is_active,
    };

    try {
      setSaving(true);

      if (editing) {
        await hrApi.updatePosition(editing.id, payload);
        toast.success("Position updated.");
      } else {
        await hrApi.createPosition(payload);
        toast.success("Position created.");
      }

      closeForm();
      await loadData();
    } catch (error) {
      toast.error(
        getApiError(error, "Unable to save position."),
      );
    } finally {
      setSaving(false);
    }
  };

  const deletePosition = async (position) => {
    const confirmed = window.confirm(
      `Delete the "${position.title}" position?`,
    );

    if (!confirmed) return;

    try {
      await hrApi.deletePosition(position.id);
      toast.success("Position deleted.");
      await loadData();
    } catch (error) {
      toast.error(
        getApiError(
          error,
          "Unable to delete position. It may be assigned to employees.",
        ),
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">
              Human Resources
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Job Positions
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage job titles and assign them to departments.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/hr/departments"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View Departments
            </Link>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              disabled={departments.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Position
            </button>
          </div>
        </div>

        {departments.length === 0 && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Create a department before adding job positions.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Positions
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {positions.length}
              </p>
            </div>

            <div className="rounded-xl bg-orange-50 p-3">
              <BriefcaseBusiness className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, code or department..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(event) =>
                setDepartmentFilter(event.target.value)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
            >
              <option value="">All departments</option>

              {departments.map((department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading positions...
            </div>
          ) : filteredPositions.length === 0 ? (
            <div className="p-12 text-center">
              <BriefcaseBusiness className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">
                No positions found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Position
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Department
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredPositions.map((position) => (
                    <tr key={position.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">
                          {position.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {position.code}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {position.department_name || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            position.is_active !== false
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {position.is_active !== false
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(position)}
                            className="rounded-lg border border-slate-300 p-2 text-slate-600"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deletePosition(position)
                            }
                            className="rounded-lg border border-red-200 p-2 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
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

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
              <form onSubmit={submitForm}>
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editing ? "Edit Position" : "Add Position"}
                  </h2>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Position title
                    </label>
                    <input
                      value={form.title}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          title: event.target.value,
                        })
                      }
                      placeholder="Example: HR Manager"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Position code
                    </label>
                    <input
                      value={form.code}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          code: event.target.value,
                        })
                      }
                      placeholder="Example: HR-MGR"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Department
                    </label>
                    <select
                      value={form.department}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          department: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">Select department</option>

                      {departments.map((department) => (
                        <option
                          key={department.id}
                          value={department.id}
                        >
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Description
                    </label>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          description: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          is_active: event.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Active position
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Position"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
