"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Download } from "lucide-react";
import { getTrialBalance } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function TrialBalancePage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (asOfDate) params.as_of_date = asOfDate;

      const data = await getTrialBalance(params);
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load trial balance",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleApplyFilters() {
    loadReport();
  }

  function handleExportPDF() {
    const content = generateReportContent();
    const printWindow = window.open("", "", "width=800,height=600");
    printWindow.document.write(content);
    printWindow.print();
  }

  function generateReportContent() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Trial Balance</title>
          <style>
            body { font-family: Arial; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; }
            .header p { margin: 5px 0; color: #666; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px; border-bottom: 1px solid #ddd; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; border-top: 2px solid #000; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Trial Balance</h1>
            <p>As at: ${asOfDate}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Account Number</th>
                <th>Account Name</th>
                <th class="text-right">Debit (SSP)</th>
                <th class="text-right">Credit (SSP)</th>
              </tr>
            </thead>
            <tbody>
              ${
                report
                  ? report.accounts
                      ?.map(
                        (acc) => `
                <tr>
                  <td>${acc.account_number}</td>
                  <td>${acc.name}</td>
                  <td class="text-right">${acc.debit?.toLocaleString() || "-"}</td>
                  <td class="text-right">${acc.credit?.toLocaleString() || "-"}</td>
                </tr>
              `,
                      )
                      .join("")
                  : ""
              }
              <tr class="total-row">
                <td colspan="2">TOTAL</td>
                <td class="text-right">${report?.total_debits?.toLocaleString()}</td>
                <td class="text-right">${report?.total_credits?.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading trial balance...
      </div>
    );
  }

  const isBalanced =
    Math.abs((report?.total_debits || 0) - (report?.total_credits || 0)) < 0.01;

  return (
    <div className="space-y-6">
      <Link
        href="/finance/reports"
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Reports
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Trial Balance</h1>
            <p className="mt-2 text-gray-600">
              Verify account balances and ledger accuracy
            </p>
          </div>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download size={18} />
            Export
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                As at Date
              </label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700 mb-6">
            <AlertCircle className="mt-0.5" size={20} />
            <div>
              <h2 className="font-semibold">Error</h2>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {!isBalanced && report && (
          <div className="mb-6 p-4 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200">
            ⚠ Trial balance is not balanced. Total Debits ≠ Total Credits
          </div>
        )}

        {report && (
          <>
            {isBalanced && (
              <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
                ✓ Trial balance is balanced
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Account Number
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Account Name
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Debit (SSP)
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Credit (SSP)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.accounts?.map((account, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-900">
                        {account.account_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {account.name}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">
                        {account.debit
                          ? `SSP ${account.debit.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">
                        {account.credit
                          ? `SSP ${account.credit.toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold text-lg">
                    <td colSpan="2" className="px-6 py-4">
                      TOTAL
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      SSP {report.total_debits?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      SSP {report.total_credits?.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
