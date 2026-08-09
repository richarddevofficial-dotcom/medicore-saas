"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Plus, Trash2, Edit } from "lucide-react";
import { getPayrollYears, deletePayrollYear } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function PayrollYearsPage() {
  const [payrollYears, setPayrollYears] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadPayrollYears();
  }, []);

  async function loadPayrollYears() {
    try {
      setLoading(true);
      setError("");

      const data = await getPayrollYears();
      setPayrollYears(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load payroll years.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this payroll year?")) return;

    try {
      setDeleting(id);
      await deletePayrollYear(id);
      setPayrollYears((prev) => prev.filter((p) => p.id !== id));
      toast.success("Payroll year deleted successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete payroll year",
      );
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading payroll years...
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
          <h1 className="text-3xl font-bold text-gray-900">Payroll Years</h1>
          <p className="mt-2 text-gray-600">
            Define financial years for payroll processing
          </p>
        </div>
        <Link href="/finance/payroll-config/payroll-years/new">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <Plus size={18} />
            New Payroll Year
          </button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Unable to load payroll years</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {payrollYears.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
          <p className="text-gray-600">No payroll years created yet</p>
          <Link href="/finance/payroll-config/payroll-years/new">
            <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
              Create your first payroll year
            </button>
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Start Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  End Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payrollYears.map((year) => (
                <tr key={year.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {year.year}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(year.start_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(year.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        year.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {year.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/finance/payroll-config/payroll-years/${year.id}/edit`}
                      >
                        <button
                          disabled={deleting === year.id}
                          className="p-1.5 text-gray-600 hover:text-blue-600 disabled:opacity-50"
                        >
                          <Edit size={18} />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(year.id)}
                        disabled={deleting === year.id}
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
