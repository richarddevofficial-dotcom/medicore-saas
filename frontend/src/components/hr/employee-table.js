"use client";

import Link from "next/link";
import { Eye, Pencil, UserX } from "lucide-react";

function getEmployeeName(employee) {
  if (employee.full_name) {
    return employee.full_name;
  }

  return [
    employee.first_name,
    employee.middle_name,
    employee.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function getRelatedName(value) {
  if (!value) return "—";
  if (typeof value === "string") return value;

  return (
    value.name ||
    value.title ||
    value.position_name ||
    value.department_name ||
    "—"
  );
}

export default function EmployeeTable({
  employees,
  onDeactivate,
}) {
  if (!employees.length) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        No employees found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Employee
              </th>

              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Number
              </th>

              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Department
              </th>

              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Position
              </th>

              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </th>

              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <p className="font-medium text-gray-900">
                    {getEmployeeName(employee) || "Unnamed employee"}
                  </p>

                  <p className="mt-0.5 text-sm text-gray-500">
                    {employee.email || employee.phone || "No contact"}
                  </p>
                </td>

                <td className="px-5 py-4 text-sm text-gray-700">
                  {employee.employee_number || "—"}
                </td>

                <td className="px-5 py-4 text-sm text-gray-700">
                  {getRelatedName(employee.department)}
                </td>

                <td className="px-5 py-4 text-sm text-gray-700">
                  {getRelatedName(employee.position)}
                </td>

                <td className="px-5 py-4">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold capitalize text-green-700">
                    {(employee.status || "active").replaceAll("_", " ")}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/hr/employees/${employee.id}`}
                      className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      title="View"
                    >
                      <Eye size={17} />
                    </Link>

                    <Link
                      href={`/hr/employees/${employee.id}/edit`}
                      className="rounded-lg p-2 text-orange-600 hover:bg-orange-50"
                      title="Edit"
                    >
                      <Pencil size={17} />
                    </Link>

                    <button
                      type="button"
                      onClick={() => onDeactivate(employee)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      title="Deactivate"
                    >
                      <UserX size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
