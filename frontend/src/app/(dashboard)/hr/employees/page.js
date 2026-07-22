"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import EmployeeTable from "@/components/hr/employee-table";
import {
  deactivateEmployee,
  getEmployees,
  normalizeResults,
} from "@/lib/api/hr";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getEmployees({
        search,
      });

      setEmployees(normalizeResults(data));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load employees."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadEmployees();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [loadEmployees]);

  async function handleDeactivate(employee) {
    const employeeName =
      employee.full_name ||
      `${employee.first_name || ""} ${employee.last_name || ""}`.trim();

    const confirmed = window.confirm(
      `Deactivate ${employeeName || "this employee"}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deactivateEmployee(employee.id);
      await loadEmployees();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Unable to deactivate employee."
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Employees
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Manage all hospital employees.
          </p>
        </div>

        <Link
          href="/hr/employees/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <Plus size={18} />
          Add Employee
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employees..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
          Loading employees...
        </div>
      ) : (
        <EmployeeTable
          employees={employees}
          onDeactivate={handleDeactivate}
        />
      )}
    </div>
  );
}
