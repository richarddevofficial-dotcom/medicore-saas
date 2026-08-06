"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Download } from "lucide-react";
import { getIncomeStatement } from "@/lib/api/finance";
import {
  buildFinancialPrintDocument,
  escapeHtml,
  formatAmount,
  printFinancialReport,
} from "@/lib/financial-report-print";
import { useHospitalSettings } from "@/hooks/useSettings";
import toast from "react-hot-toast";

export default function IncomeStatementPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: new Date().toISOString().split("T")[0],
  });
  const { data: hospitalSettings } = useHospitalSettings();
  const hospitalName = hospitalSettings?.name || "Medical Centre";

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const data = await getIncomeStatement(params);
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load income statement",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleApplyFilters() {
    loadReport();
  }

  function handleExportPDF() {
    printFinancialReport(generateReportContent());
  }

  function generateReportContent() {
    return buildFinancialPrintDocument({
      hospitalName,
      title: "Income Statement",
      periodLabel: `${filters.start_date || "Start"} to ${filters.end_date || "End"}`,
      summary: [
        {
          label: "Total Revenue",
          value: `SSP ${formatAmount(report?.total_revenue)}`,
        },
        {
          label: "Total Expenses",
          value: `SSP ${formatAmount(report?.total_expenses)}`,
        },
        {
          label: "Net Income",
          value: `SSP ${formatAmount(report?.net_profit)}`,
        },
      ],
      content: `
          <table>
            <thead>
              <tr>
                <th class="category">Description</th>
                <th>Amount (SSP)</th>
              </tr>
            </thead>
            <tbody>
              ${generateReportRows()}
            </tbody>
          </table>`,
    });
  }

  function generateReportRows() {
    if (!report) return "";

    let html = "";

    // Revenue
    if (report.revenue && report.revenue.length > 0) {
      html += `<tr><td class="category">REVENUE</td><td></td></tr>`;
      report.revenue.forEach((item) => {
        html += `<tr><td class="subcategory">${escapeHtml(item.name)}</td><td>SSP ${formatAmount(item.amount)}</td></tr>`;
      });
      html += `<tr class="section-total"><td>Total Revenue</td><td>SSP ${formatAmount(report.total_revenue)}</td></tr>`;
    }

    // Expenses
    if (report.expenses && report.expenses.length > 0) {
      html += `<tr><td class="category">EXPENSES</td><td></td></tr>`;
      report.expenses.forEach((item) => {
        html += `<tr><td class="subcategory">${escapeHtml(item.name)}</td><td>SSP ${formatAmount(item.amount)}</td></tr>`;
      });
      html += `<tr class="section-total"><td>Total Expenses</td><td>SSP ${formatAmount(report.total_expenses)}</td></tr>`;
    }

    // Net Income
    html += `<tr class="net-income"><td>NET INCOME</td><td>SSP ${formatAmount(report.net_profit)}</td></tr>`;

    return html;
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading income statement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/finance"
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Finance
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Income Statement
            </h1>
            <p className="mt-2 text-gray-600">Revenue and expense analysis</p>
          </div>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download size={18} />
            Export
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Apply Filters
          </button>
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

        {report && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                    Amount (SSP)
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Revenue Section */}
                {report.revenue && report.revenue.length > 0 && (
                  <>
                    <tr className="bg-blue-50">
                      <td className="px-6 py-3 font-semibold text-gray-900">
                        REVENUE
                      </td>
                      <td></td>
                    </tr>
                    {report.revenue.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-6 py-3 pl-12 text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-900">
                          SSP {item.amount?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-100 border-b">
                      <td className="px-6 py-3 font-semibold text-gray-900">
                        Total Revenue
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-900">
                        SSP {report.total_revenue?.toLocaleString()}
                      </td>
                    </tr>
                  </>
                )}

                {/* Expenses Section */}
                {report.expenses && report.expenses.length > 0 && (
                  <>
                    <tr className="bg-red-50">
                      <td className="px-6 py-3 font-semibold text-gray-900">
                        EXPENSES
                      </td>
                      <td></td>
                    </tr>
                    {report.expenses.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-6 py-3 pl-12 text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-900">
                          SSP {item.amount?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-red-100 border-b">
                      <td className="px-6 py-3 font-semibold text-gray-900">
                        Total Expenses
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-900">
                        SSP {report.total_expenses?.toLocaleString()}
                      </td>
                    </tr>
                  </>
                )}

                {/* Net Income */}
                <tr className="border-t-2 border-b-2">
                  <td className="px-6 py-4 font-bold text-lg text-gray-900">
                    NET INCOME
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-lg text-gray-900">
                    SSP {report.net_profit?.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
