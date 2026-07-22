"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
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
  name: "",
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);

      const data = await hrApi.getDepartments({
        ordering: "name",
      });

      setDepartments(data);
    } catch (error) {
      toast.error(
        getApiError(error, "Unable to load departments."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return departments;

    return departments.filter((department) =>
      String(department.name || "")
        .toLowerCase()
        .includes(query),
    );
  }, [departments, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (department) => {
    setEditing(department);
    setForm({
      name: department.name || "",
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

    const name = form.name.trim();

    if (!name) {
      toast.error("Department name is required.");
      return;
    }

    try {
      setSaving(true);

      if (editing) {
        await hrApi.updateDepartment(editing.id, { name });
        toast.success("Department updated.");
      } else {
        await hrApi.createDepartment({ name });
        toast.success("Department created.");
      }

      closeForm();
      await loadDepartments();
    } catch (error) {
      toast.error(
        getApiError(error, "Unable to save department."),
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteDepartment = async (department) => {
    const confirmed = window.confirm(
      `Delete the "${department.name}" department?`,
    );

    if (!confirmed) return;

    try {
      await hrApi.deleteDepartment(department.id);
      toast.success("Department deleted.");
      await loadDepartments();
    } catch (error) {
      toast.error(
        getApiError(
          error,
          "Unable to delete department. It may be in use.",
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
              Departments
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage hospital departments used by employees and
              job positions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/hr/positions"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View Positions
            </Link>

            <button
              type="button"
              onClick={loadDepartments}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Total Departments
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {departments.length}
                </p>
              </div>

              <div className="rounded-xl bg-orange-50 p-3">
                <Building2 className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search departments..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading departments...
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">
                No departments found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Add your first hospital department.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Department
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredDepartments.map((department) => (
                    <tr key={department.id}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-slate-100 p-2">
                            <Building2 className="h-4 w-4 text-slate-600" />
                          </div>

                          <div>
                            <p className="font-medium text-slate-900">
                              {department.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              ID: {department.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(department)}
                            className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                            title="Edit department"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteDepartment(department)
                            }
                            className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                            title="Delete department"
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
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
              <form onSubmit={submitForm}>
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editing
                      ? "Edit Department"
                      : "Add Department"}
                  </h2>
                </div>

                <div className="p-5">
                  <label className="block text-sm font-medium text-slate-700">
                    Department name
                  </label>

                  <input
                    autoFocus
                    value={form.name}
                    onChange={(event) =>
                      setForm({ name: event.target.value })
                    }
                    placeholder="Example: Human Resources"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Department"}
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
