"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Plus, Trash2, Edit } from "lucide-react";
import { getDeductionTypes, deleteDeductionType } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function DeductionTypesPage() {
  const [deductions, setDeductions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadDeductions();
  }, []);

  async function loadDeductions() {
    try {
      setLoading(true);
      setError("");

      const data = await getDeductionTypes();
      setDeductions(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load deduction types.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this deduction type?"))
      return;

    try {
      setDeleting(id);
      await deleteDeductionType(id);
      setDeductions((prev) => prev.filter((d) => d.id !== id));
      toast.success("Deduction type deleted successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete deduction type",
      );
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading deduction types...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/finance/payroll-config"
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Payroll Config
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Deduction Types</h1>
          <p className="mt-2 text-gray-600">
            Manage salary deduction components (PF, IT, etc.)
          </p>
        </div>
        <Link href="/finance/payroll-config/deductions/new">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <Plus size={18} />
            New Deduction
          </button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Unable to load deductions</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {deductions.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
          <p className="text-gray-600">No deduction types created yet</p>
          <Link href="/finance/payroll-config/deductions/new">
            <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
              Create your first deduction type
            </button>
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Limit
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {deductions.map((deduction) => (
                <tr key={deduction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {deduction.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {deduction.description || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-medium">
                      {deduction.deduction_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {deduction.limit_percentage
                      ? `${deduction.limit_percentage}%`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/finance/payroll-config/deductions/${deduction.id}/edit`}
                      >
                        <button
                          disabled={deleting === deduction.id}
                          className="p-1.5 text-gray-600 hover:text-blue-600 disabled:opacity-50"
                        >
                          <Edit size={18} />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(deduction.id)}
                        disabled={deleting === deduction.id}
                        className="p-1.5 text-gray-600 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
