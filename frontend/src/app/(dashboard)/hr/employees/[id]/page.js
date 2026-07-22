"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { getEmployee } from "@/lib/api/hr";

function displayValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return (
      value.name ||
      value.title ||
      value.position_name ||
      value.department_name ||
      "—"
    );
  }

  return String(value).replaceAll("_", " ");
}

export default function EmployeeDetailsPage() {
  const params = useParams();
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEmployee() {
      try {
        setLoading(true);
        setError("");

        const data = await getEmployee(params.id);
        setEmployee(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load employee."
        );
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadEmployee();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading employee...
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        {error || "Employee not found."}
      </div>
    );
  }

  const fullName =
    employee.full_name ||
    [
      employee.first_name,
      employee.middle_name,
      employee.last_name,
    ]
      .filter(Boolean)
      .join(" ");

  const details = [
    ["Employee Number", employee.employee_number],
    ["Email", employee.email],
    ["Phone", employee.phone],
    ["Gender", employee.gender],
    ["Date of Birth", employee.date_of_birth],
    ["Hire Date", employee.hire_date],
    ["Department", employee.department],
    ["Position", employee.position],
    ["Employment Type", employee.employment_type],
    ["Status", employee.status],
    ["Address", employee.address],
    ["Emergency Contact", employee.emergency_contact_name],
    ["Emergency Phone", employee.emergency_contact_phone],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/hr/employees"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft size={16} />
            Back to employees
          </Link>

          <h2 className="text-2xl font-bold text-gray-900">
            {fullName || "Employee Details"}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {employee.employee_number || "No employee number"}
          </p>
        </div>

        <Link
          href={`/hr/employees/${employee.id}/edit`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <Pencil size={17} />
          Edit Employee
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {label}
              </p>

              <p className="mt-1 capitalize text-gray-900">
                {displayValue(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
