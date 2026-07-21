"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmployeeForm from "@/components/hr/employee-form";
import { createEmployee } from "@/lib/api/hr";
import type { EmployeePayload } from "@/types/hr";

export default function AddEmployeePage() {
  const router = useRouter();

  async function handleCreate(payload: EmployeePayload) {
    const employee = await createEmployee(payload);
    router.push(`/hr/employees/${employee.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/hr/employees"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to employees
        </Link>

        <h2 className="mt-4 text-2xl font-bold text-gray-900">
          Add Employee
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Create a new hospital employee record.
        </p>
      </div>

      <EmployeeForm onSubmit={handleCreate} />
    </div>
  );
}
