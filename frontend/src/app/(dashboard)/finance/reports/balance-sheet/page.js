"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Download } from "lucide-react";
import { getBalanceSheet } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function BalanceSheetPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [endDate, setEndDate] = useState(
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
      if (endDate) params.end_date = endDate;

      const data = await getBalanceSheet(params);
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load balance sheet",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleApplyFilters() {
    loadReport();
  }

  function handleExportPDF() {
    // Generate a simple PDF export
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
          <title>Balance Sheet</title>
          <style>
            body { font-family: Arial; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; }
            .header p { margin: 5px 0; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 10px; text-align: right; border-bottom: 1px solid #ddd; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .category { text-align: left; font-weight: bold; }
            .subcategory { text-align: left; padding-left: 20px; }
            .total-row { font-weight: bold; border-top: 2px solid #000; }
            .section-total { font-weight: bold; border-top: 1px solid #000; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Balance Sheet</h1>
            <p>As at: ${endDate}</p>
          </div>
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
          </table>
        </body>
      </html>
    `;
  }

  function generateReportRows() {
    if (!report) return "";

    let html = "";

    // Assets
    if (report.assets && report.assets.length > 0) {
      html += `<tr><td class="category">ASSETS</td><td></td></tr>`;
      report.assets.forEach((item) => {
        html += `<tr><td class="subcategory">${item.name}</td><td>${item.balance?.toLocaleString()}</td></tr>`;
      });
      html += `<tr class="section-total"><td>Total Assets</td><td>${report.total_assets?.toLocaleString()}</td></tr>`;
    }

    // Liabilities
    if (report.liabilities && report.liabilities.length > 0) {
      html += `<tr><td class="category">LIABILITIES</td><td></td></tr>`;
      report.liabilities.forEach((item) => {
        html += `<tr><td class="subcategory">${item.name}</td><td>${item.balance?.toLocaleString()}</td></tr>`;
      });
      html += `<tr class="section-total"><td>Total Liabilities</td><td>${report.total_liabilities?.toLocaleString()}</td></tr>`;
    }

    // Equity
    if (report.equity && report.equity.length > 0) {
      html += `<tr><td class="category">EQUITY</td><td></td></tr>`;
      report.equity.forEach((item) => {
        html += `<tr><td class="subcategory">${item.name}</td><td>${item.balance?.toLocaleString()}</td></tr>`;
      });
      html += `<tr class="section-total"><td>Total Equity</td><td>${report.total_equity?.toLocaleString()}</td></tr>`;
    }

    return html;
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading balance sheet...
      </div>
    );
  }

  const totalLiabilitiesAndEquity =
    (report?.total_liabilities || 0) + (report?.total_equity || 0);
  const isBalanced =
    Math.abs((report?.total_assets || 0) - totalLiabilitiesAndEquity) < 0.01;

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
            <h1 className="text-3xl font-bold text-gray-900">Balance Sheet</h1>
            <p className="mt-2 text-gray-600">
              Assets, liabilities, and equity snapshot
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
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
            ⚠ Balance sheet is not balanced. Assets ≠ Liabilities + Equity
          </div>
        )}

        {report && (
          <div className="grid grid-cols-2 gap-8">
            {/* Left Column - Assets and Liabilities */}
            <div>
              {/* Assets */}
              {report.assets && report.assets.length > 0 && (
                <div className="mb-8">
                  <div className="bg-blue-50 px-6 py-3 rounded-t-lg border border-blue-200">
                    <h3 className="font-bold text-lg text-gray-900">ASSETS</h3>
                  </div>
                  <div className="border border-t-0 border-blue-200 rounded-b-lg overflow-hidden">
                    <table className="w-full">
                      <tbody>
                        {report.assets.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-b-0">
                            <td className="px-6 py-3 text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-6 py-3 text-right text-gray-900">
                              SSP {item.balance?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-100 font-bold">
                          <td className="px-6 py-3 text-gray-900">
                            Total Assets
                          </td>
                          <td className="px-6 py-3 text-right text-gray-900">
                            SSP {report.total_assets?.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Liabilities */}
              {report.liabilities && report.liabilities.length > 0 && (
                <div>
                  <div className="bg-red-50 px-6 py-3 rounded-t-lg border border-red-200">
                    <h3 className="font-bold text-lg text-gray-900">
                      LIABILITIES
                    </h3>
                  </div>
                  <div className="border border-t-0 border-red-200 rounded-b-lg overflow-hidden">
                    <table className="w-full">
                      <tbody>
                        {report.liabilities.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-b-0">
                            <td className="px-6 py-3 text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-6 py-3 text-right text-gray-900">
                              SSP {item.balance?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-red-100 font-bold">
                          <td className="px-6 py-3 text-gray-900">
                            Total Liabilities
                          </td>
                          <td className="px-6 py-3 text-right text-gray-900">
                            SSP {report.total_liabilities?.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Equity */}
            <div>
              {report.equity && report.equity.length > 0 && (
                <div>
                  <div className="bg-green-50 px-6 py-3 rounded-t-lg border border-green-200">
                    <h3 className="font-bold text-lg text-gray-900">EQUITY</h3>
                  </div>
                  <div className="border border-t-0 border-green-200 rounded-b-lg overflow-hidden">
                    <table className="w-full">
                      <tbody>
                        {report.equity.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-b-0">
                            <td className="px-6 py-3 text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-6 py-3 text-right text-gray-900">
                              SSP {item.balance?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-green-100 font-bold">
                          <td className="px-6 py-3 text-gray-900">
                            Total Equity
                          </td>
                          <td className="px-6 py-3 text-right text-gray-900">
                            SSP {report.total_equity?.toLocaleString()}
                          </td>
                        </tr>
                        <tr className="bg-purple-100 font-bold text-lg">
                          <td className="px-6 py-3 text-gray-900">
                            Total Liab. + Equity
                          </td>
                          <td className="px-6 py-3 text-right text-gray-900">
                            SSP {totalLiabilitiesAndEquity.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
