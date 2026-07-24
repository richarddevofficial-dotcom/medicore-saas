"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Plus, Trash2, Edit } from "lucide-react";
import { getAllowanceTypes, deleteAllowanceType } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function AllowanceTypesPage() {
  const [allowances, setAllowances] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadAllowances();
  }, []);

  async function loadAllowances() {
    try {
      setLoading(true);
      setError("");

      const data = await getAllowanceTypes();
      setAllowances(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load allowance types.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this allowance type?"))
      return;

    try {
      setDeleting(id);
      await deleteAllowanceType(id);
      setAllowances((prev) => prev.filter((a) => a.id !== id));
      toast.success("Allowance type deleted successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete allowance type",
      );
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading allowance types...
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
          <h1 className="text-3xl font-bold text-gray-900">Allowance Types</h1>
          <p className="mt-2 text-gray-600">
            Manage salary allowance components (DA, HRA, etc.)
          </p>
        </div>
        <Link href="/finance/payroll-config/allowances/new">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <Plus size={18} />
            New Allowance
          </button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Unable to load allowances</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {allowances.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
          <p className="text-gray-600">No allowance types created yet</p>
          <Link href="/finance/payroll-config/allowances/new">
            <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
              Create your first allowance type
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
                  Taxable
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allowances.map((allowance) => (
                <tr key={allowance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {allowance.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {allowance.description || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                      {allowance.allowance_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        allowance.is_taxable
                          ? "bg-orange-100 text-orange-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {allowance.is_taxable ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/finance/payroll-config/allowances/${allowance.id}/edit`}
                      >
                        <button
                          disabled={deleting === allowance.id}
                          className="p-1.5 text-gray-600 hover:text-blue-600 disabled:opacity-50"
                        >
                          <Edit size={18} />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(allowance.id)}
                        disabled={deleting === allowance.id}
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
