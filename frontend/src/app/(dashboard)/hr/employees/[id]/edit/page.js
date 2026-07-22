"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import EmployeeForm from "@/components/hr/employee-form";
import { getEmployee, updateEmployee } from "@/lib/api/hr";

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();

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

  async function handleUpdate(payload) {
    await updateEmployee(params.id, payload);

    router.push(`/hr/employees/${params.id}`);
    router.refresh();
  }

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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Edit Employee
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Update employee information.
        </p>
      </div>

      <EmployeeForm
        initialData={employee}
        onSubmit={handleUpdate}
        submitLabel="Update Employee"
      />
    </div>
  );
}
