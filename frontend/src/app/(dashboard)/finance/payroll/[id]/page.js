"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, AlertCircle, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { getPayrollCycle } from "@/lib/api/finance";

export default function SalarySlipDetailPage() {
  const params = useParams();
  const salarySlipId = params.id;

  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadSalarySlip();
  }, [salarySlipId]);

  async function loadSalarySlip() {
    try {
      setLoading(true);
      setError("");
      const data = await getPayrollCycle(salarySlipId);
      setSlip(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load salary slip",
      );
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error || !slip) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 text-red-600" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">
              Unable to load salary slip
            </h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const basicSalary = Number(slip.base_salary || 0);
  const grossSalary = Number(slip.gross_salary || 0);
  const totalDeductions = Number(slip.total_deductions || 0);
  const netSalary = Number(slip.net_salary || 0);
  const salaryMonth = new Date(`${slip.month}T00:00:00`).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/finance/payroll"
          className="flex items-center text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Payroll
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 print:hidden"
        >
          <Printer size={18} />
          Print Slip
        </button>
      </div>

      <div className="rounded-lg border bg-white p-8 print:border-0 print:shadow-none">
        {/* Header */}
        <div className="text-center border-b pb-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">SALARY SLIP</h1>
          <p className="text-gray-600 mt-1">For the period: {salaryMonth}</p>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-6 mb-8 print:grid-cols-2">
          <div>
            <p className="text-sm text-gray-600">Employee Name</p>
            <p className="text-lg font-semibold text-gray-900">
              {slip.employee_name || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Employee ID</p>
            <p className="text-lg font-semibold text-gray-900">
              {slip.employee_id_number || slip.employee || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Salary Structure</p>
            <p className="text-lg font-semibold text-gray-900">
              {slip.salary_structure?.name || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Generated</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(slip.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Earnings */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
            EARNINGS
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-700">Basic Salary</span>
              <span className="font-semibold">
                SSP {basicSalary.toLocaleString()}
              </span>
            </div>
            {slip.earnings?.map((earning) => (
              <div
                key={earning.id}
                className="flex justify-between py-2 border-b"
              >
                <span className="text-gray-700">
                  {earning.allowance_type?.name ||
                    earning.allowance_type?.code ||
                    "Allowance"}
                </span>
                <span className="font-semibold">
                  SSP {Number(earning.amount || 0).toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex justify-between py-2 bg-green-50 px-2 rounded font-semibold">
              <span>Total Earnings</span>
              <span>SSP {grossSalary.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
            DEDUCTIONS
          </h2>
          <div className="space-y-2">
            {slip.deductions?.map((deduction) => (
              <div
                key={deduction.id}
                className="flex justify-between py-2 border-b"
              >
                <span className="text-gray-700">
                  {deduction.deduction_type?.name ||
                    deduction.deduction_type?.code ||
                    "Deduction"}
                </span>
                <span className="font-semibold">
                  SSP {Number(deduction.amount || 0).toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex justify-between py-2 bg-red-50 px-2 rounded font-semibold">
              <span>Total Deductions</span>
              <span>SSP {totalDeductions.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Net Salary */}
        <div className="mb-8 rounded-lg bg-blue-50 p-6 border-2 border-blue-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">
              Net Salary
            </span>
            <span className="text-2xl font-bold text-blue-600">
              SSP {netSalary.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="grid grid-cols-2 gap-6 print:grid-cols-2">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  slip.status === "paid"
                    ? "bg-green-100 text-green-800"
                    : slip.status === "approved" || slip.status === "processed"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {slip.status?.charAt(0).toUpperCase() + slip.status?.slice(1)}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Generated Date</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {new Date(slip.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-8 border-t text-center text-sm text-gray-600 print:border-t">
          <p>
            This is a computer-generated salary slip. No signature is required.
          </p>
          <p className="mt-2">Confidential - For Employee Use Only</p>
        </div>
      </div>
    </div>
  );
}
