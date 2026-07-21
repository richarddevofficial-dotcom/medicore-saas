"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EmployeeForm from "@/components/hr/employee-form";
import { getEmployee, updateEmployee } from "@/lib/api/hr";
import type { Employee, EmployeePayload } from "@/types/hr";

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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

  async function handleUpdate(payload: EmployeePayload) {
    await updateEmployee(params.id, payload);
    router.push(`/hr/employees/${params.id}`);
    router.refresh();
  }

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

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/hr/employees/${employee.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to employee
        </Link>

        <h2 className="mt-4 text-2xl font-bold text-gray-900">
          Edit Employee
        </h2>
      </div>

      <EmployeeForm
        initialData={employee}
        submitLabel="Update Employee"
        onSubmit={handleUpdate}
      />
    </div>
  );
}
