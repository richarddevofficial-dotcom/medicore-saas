"use client";

import { useRouter } from "next/navigation";
import EmployeeForm from "@/components/hr/employee-form";
import { createEmployee } from "@/lib/api/hr";

export default function AddEmployeePage() {
  const router = useRouter();

  async function handleCreate(payload) {
    const employee = await createEmployee(payload);

    if (employee?.id) {
      router.push(`/hr/employees/${employee.id}`);
    } else {
      router.push("/hr/employees");
    }

    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Add Employee
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Register a new employee in the hospital.
        </p>
      </div>

      <EmployeeForm
        onSubmit={handleCreate}
        submitLabel="Create Employee"
      />
    </div>
  );
}
