"use client";

import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEmployee } from "@/lib/api/hr";
import type { Employee } from "@/types/hr";

export default function EmployeeDetailsPage() {
  const params = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEmployee() {
      try {
        setEmployee(await getEmployee(params.id));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load employee.",
        );
      }
    }

    void loadEmployee();
  }, [params.id]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        {error}
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
        Loading employee...
      </div>
    );
  }

  const fields = [
    ["Employee Number", employee.employee_number],
    ["Full Name", employee.full_name],
    ["Email", employee.email || "—"],
    ["Phone", employee.phone || "—"],
    ["Department", employee.department_name || "Unassigned"],
    ["Position", employee.position_title || "Unassigned"],
    ["Employment Type", employee.employment_type.replaceAll("_", " ")],
    ["Employment Status", employee.employment_status.replaceAll("_", " ")],
    ["Hire Date", employee.hire_date],
    ["National ID", employee.national_id || "—"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/hr/employees"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Employees
        </Link>

        <Link
          href={`/hr/employees/${employee.id}/edit`}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </div>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="border-b pb-5">
          <h2 className="text-2xl font-bold text-gray-900">
            {employee.full_name}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {employee.employee_number}
          </p>
        </div>

        <dl className="mt-6 grid gap-5 md:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm font-medium text-gray-500">
                {label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
