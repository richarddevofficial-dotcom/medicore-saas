"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, Eye } from "lucide-react";
import { approveSalarySlip, getPayroll } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function PayrollPage() {
  const [salarySlips, setSalarySlips] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [canApprove, setCanApprove] = useState(false);
  const [filter, setFilter] = useState("all");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const role = (localStorage.getItem("role") || "").toLowerCase();
    setCanApprove(
      ["admin", "super_admin", "hospital_admin", "hr_manager"].includes(role),
    );
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
      setSalarySlips(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payroll.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id) {
    if (!confirm("Approve this generated salary slip?")) return;

    try {
      setApproving(id);
      await approveSalarySlip(id);
      toast.success("Salary slip approved successfully");
      await loadPayroll();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve salary slip",
      );
    } finally {
      setApproving(null);
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
          <p className="mt-2 text-gray-600">Review employee salary slips</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b">
        {["all", "draft", "generated", "approved", "processed", "paid"].map(
          (status) => (
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
          ),
        )}
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

      {salarySlips.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
          <p className="text-gray-600">No salary slips found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {salarySlips.map((salarySlip) => (
            <div
              key={salarySlip.id}
              className="rounded-lg border bg-white p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {salarySlip.employee_name ||
                        `Employee #${salarySlip.employee}`}
                    </h3>
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                        salarySlip.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : salarySlip.status === "processed" ||
                              salarySlip.status === "approved"
                            ? "bg-blue-100 text-blue-800"
                            : salarySlip.status === "generated"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {salarySlip.status || "draft"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-gray-500">Period</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(
                          `${salarySlip.month}T00:00:00`,
                        ).toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Employee ID</p>
                      <p className="font-semibold text-gray-900">
                        {salarySlip.employee}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Amount</p>
                      <p className="font-semibold text-gray-900">
                        SSP{" "}
                        {Number(salarySlip.net_salary || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(salarySlip.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Link href={`/finance/payroll/${salarySlip.id}`}>
                    <button
                      className="p-2 text-gray-600 hover:text-blue-600"
                      title="View salary slip"
                    >
                      <Eye size={18} />
                    </button>
                  </Link>
                  {canApprove && salarySlip.status === "generated" && (
                    <button
                      onClick={() => handleApprove(salarySlip.id)}
                      disabled={approving === salarySlip.id}
                      className="p-2 text-gray-600 hover:text-green-600 disabled:opacity-50"
                      title="Approve salary slip"
                    >
                      <Check size={18} />
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
