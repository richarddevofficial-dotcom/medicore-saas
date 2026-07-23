"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Plus, Trash2, Edit, Play } from "lucide-react";
import { getPayroll, processPayroll } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadPayroll();
  }, [filter]);

  async function loadPayroll() {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (filter !== "all") {
        params.status = filter;
      }

      const data = await getPayroll(params);
      setPayrolls(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payroll.");
    } finally {
      setLoading(false);
    }
  }

  async function handleProcess(id) {
    if (!confirm("Are you sure you want to process this payroll cycle?"))
      return;

    try {
      setProcessing(id);
      await processPayroll(id);
      toast.success("Payroll processed successfully");
      await loadPayroll();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to process payroll",
      );
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading payroll...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/finance"
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Finance
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Payroll</h1>
          <p className="mt-2 text-gray-600">Manage employee payroll cycles</p>
        </div>
        <Link href="/finance/payroll/new">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <Plus size={18} />
            New Payroll
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b">
        {["all", "draft", "processing", "completed"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-medium text-sm ${
              filter === status
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Unable to load payroll</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {payrolls.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
          <p className="text-gray-600">No payroll cycles found</p>
          <Link href="/finance/payroll/new">
            <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
              Create your first payroll cycle
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {payrolls.map((payroll) => (
            <div
              key={payroll.id}
              className="rounded-lg border bg-white p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {payroll.cycle_name || `Payroll Cycle ${payroll.id}`}
                    </h3>
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                        payroll.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : payroll.status === "processing"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {payroll.status || "Draft"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-gray-500">Period</p>
                      <p className="font-semibold text-gray-900">
                        {payroll.period}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Employees</p>
                      <p className="font-semibold text-gray-900">
                        {payroll.employee_count || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Amount</p>
                      <p className="font-semibold text-gray-900">
                        {payroll.total_amount || "SSP 0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="font-semibold text-gray-900">
                        {payroll.created_date}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Link href={`/finance/payroll/${payroll.id}/view`}>
                    <button className="p-2 text-gray-600 hover:text-blue-600">
                      <Edit size={18} />
                    </button>
                  </Link>
                  {payroll.status === "draft" && (
                    <button
                      onClick={() => handleProcess(payroll.id)}
                      disabled={processing === payroll.id}
                      className="p-2 text-gray-600 hover:text-green-600 disabled:opacity-50"
                      title="Process Payroll"
                    >
                      <Play size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
