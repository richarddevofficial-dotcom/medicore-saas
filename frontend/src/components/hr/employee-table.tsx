"use client";

import { Eye, Pencil, UserX } from "lucide-react";
import Link from "next/link";
import type { Employee } from "@/types/hr";

interface Props {
  employees: Employee[];
  onDeactivate: (employee: Employee) => void;
}

function statusClasses(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700";
    case "PROBATION":
      return "bg-blue-100 text-blue-700";
    case "ON_LEAVE":
      return "bg-yellow-100 text-yellow-700";
    case "SUSPENDED":
      return "bg-orange-100 text-orange-700";
    case "TERMINATED":
    case "RESIGNED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function EmployeeTable({
  employees,
  onDeactivate,
}: Props) {
  if (employees.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center">
        <p className="font-medium text-gray-700">No employees found</p>
        <p className="mt-1 text-sm text-gray-500">
          Add an employee or adjust the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Employee",
                "Number",
                "Department",
                "Position",
                "Type",
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

          <tbody className="divide-y divide-gray-100">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {employee.full_name ||
                        `${employee.first_name} ${employee.last_name}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {employee.email || employee.phone || "No contact"}
                    </p>
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                  {employee.employee_number}
                </td>

                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                  {employee.department_name || "Unassigned"}
                </td>

                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                  {employee.position_title || "Unassigned"}
                </td>

                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                  {employee.employment_type.replaceAll("_", " ")}
                </td>

                <td className="whitespace-nowrap px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                      employee.employment_status,
                    )}`}
                  >
                    {employee.employment_status.replaceAll("_", " ")}
                  </span>
                </td>

                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/hr/employees/${employee.id}`}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      title="View employee"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>

                    <Link
                      href={`/hr/employees/${employee.id}/edit`}
                      className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      title="Edit employee"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>

                    {employee.is_active && (
                      <button
                        type="button"
                        onClick={() => onDeactivate(employee)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        title="Deactivate employee"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
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
