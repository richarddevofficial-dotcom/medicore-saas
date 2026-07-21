"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import EmployeeTable from "@/components/hr/employee-table";
import {
  deactivateEmployee,
  getEmployees,
  normalizeResults,
} from "@/lib/api/hr";
import type { Employee } from "@/types/hr";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getEmployees({
        search,
        employment_status: status,
        employment_type: employmentType,
      });

      setEmployees(normalizeResults(response));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load employees.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status, employmentType]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadEmployees();
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [loadEmployees]);

  async function handleDeactivate(employee: Employee) {
    const confirmed = window.confirm(
      `Deactivate ${employee.full_name || employee.first_name}?`,
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
          : "Unable to deactivate employee.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employees</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage hospital employee records.
          </p>
        </div>

        <Link
          href="/hr/employees/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </Link>
      </div>

      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employees..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PROBATION">Probation</option>
          <option value="ON_LEAVE">On leave</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="RESIGNED">Resigned</option>
          <option value="TERMINATED">Terminated</option>
          <option value="RETIRED">Retired</option>
        </select>

        <select
          value={employmentType}
          onChange={(event) => setEmploymentType(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500"
        >
          <option value="">All employment types</option>
          <option value="PERMANENT">Permanent</option>
          <option value="CONTRACT">Contract</option>
          <option value="PART_TIME">Part-time</option>
          <option value="TEMPORARY">Temporary</option>
          <option value="INTERN">Intern</option>
          <option value="VOLUNTEER">Volunteer</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
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
