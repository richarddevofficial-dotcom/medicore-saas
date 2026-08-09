"use client";

import { useEffect, useState } from "react";
import { BadgeDollarSign } from "lucide-react";
import toast from "react-hot-toast";
import {
  createEmployeeSalaryAssignment,
  getEmployeeSalaryAssignments,
  getSalaryStructures,
  updateEmployeeSalaryAssignment,
} from "@/lib/api/finance";

function normalizeResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

export default function EmployeeSalaryAssignment({ employeeId }) {
  const [canManage, setCanManage] = useState(false);
  const [structures, setStructures] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [structureId, setStructureId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    setCanManage(
      ["admin", "hospital_admin", "hr_manager", "super_admin"].includes(role),
    );
  }, []);

  useEffect(() => {
    async function loadAssignment() {
      try {
        setLoading(true);
        setError("");
        const [structuresData, assignmentsData] = await Promise.all([
          getSalaryStructures({ is_active: true }),
          getEmployeeSalaryAssignments({ employee: employeeId }),
        ]);
        const availableStructures = normalizeResults(structuresData);
        const currentAssignment = normalizeResults(assignmentsData)[0] || null;

        setStructures(availableStructures);
        setAssignment(currentAssignment);
        setStructureId(
          currentAssignment?.salary_structure?.id?.toString() || "",
        );
        setEffectiveFrom(currentAssignment?.effective_from || "");
        setEffectiveTo(currentAssignment?.effective_to || "");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load payroll assignment.",
        );
      } finally {
        setLoading(false);
      }
    }

    if (employeeId && canManage) {
      loadAssignment();
    } else if (employeeId) {
      setLoading(false);
    }
  }, [canManage, employeeId]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!structureId || !effectiveFrom) {
      setError("Select a salary structure and effective date.");
      return;
    }
    if (effectiveTo && effectiveFrom > effectiveTo) {
      setError("Effective end must be on or after the start date.");
      return;
    }

    const payload = {
      salary_structure_id: Number(structureId),
      effective_from: effectiveFrom,
      effective_to: effectiveTo || null,
    };

    try {
      setSaving(true);
      setError("");
      const saved = assignment
        ? await updateEmployeeSalaryAssignment(assignment.id, payload)
        : await createEmployeeSalaryAssignment({
            ...payload,
            employee: employeeId,
          });
      setAssignment(saved);
      toast.success(
        assignment
          ? "Payroll assignment updated"
          : "Employee assigned to salary structure",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save payroll assignment.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return null;
  }

  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
          <BadgeDollarSign size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Payroll Assignment</h3>
          <p className="text-sm text-gray-500">
            HR assigns this employee to an active salary structure.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading payroll assignment...</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-4">
          <label className="text-sm font-medium text-gray-700 lg:col-span-2">
            Salary Structure
            <select
              value={structureId}
              onChange={(event) => setStructureId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Select structure</option>
              {structures.map((structure) => (
                <option key={structure.id} value={structure.id}>
                  {structure.name} - SSP {structure.base_salary}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Effective From
            <input
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Effective To
            <input
              type="date"
              value={effectiveTo}
              onChange={(event) => setEffectiveTo(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600 lg:col-span-3">{error}</p>
          ) : (
            <div className="lg:col-span-3" />
          )}

          <button
            type="submit"
            disabled={saving || structures.length === 0}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : assignment
                ? "Update Assignment"
                : "Assign Structure"}
          </button>
        </form>
      )}
    </section>
  );
}
