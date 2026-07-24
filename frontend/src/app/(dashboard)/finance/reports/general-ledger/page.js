"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Download } from "lucide-react";
import { getGeneralLedger, getChartOfAccounts } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function GeneralLedgerPage() {
  const [ledgerData, setLedgerData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedAccount) {
      loadLedger();
    }
  }, [selectedAccount]);

  async function loadAccounts() {
    try {
      const data = await getChartOfAccounts({ is_active: true });
      const accountsList = Array.isArray(data) ? data : data.results || [];
      setAccounts(accountsList);
      if (accountsList.length > 0) {
        setSelectedAccount(accountsList[0].id);
      }
    } catch (err) {
      toast.error("Failed to load accounts");
    }
  }

  async function loadLedger() {
    try {
      setLoading(true);
      setError("");

      const params = { account_id: selectedAccount };
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const data = await getGeneralLedger(params);
      setLedgerData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load general ledger",
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
    loadLedger();
  }

  function handleExportPDF() {
    const content = generateReportContent();
    const printWindow = window.open("", "", "width=900,height=600");
    printWindow.document.write(content);
    printWindow.print();
  }

  function generateReportContent() {
    const selectedAccountData = accounts.find(
      (a) => a.id === parseInt(selectedAccount),
    );
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>General Ledger</title>
          <style>
            body { font-family: Arial; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; }
            .header p { margin: 5px 0; color: #666; }
            .account-info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px; border-bottom: 1px solid #ddd; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; border-top: 2px solid #000; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>General Ledger</h1>
            <p>For the Period: ${filters.start_date || "Start"} to ${filters.end_date || "End"}</p>
          </div>
          <div class="account-info">
            <p><strong>Account:</strong> ${selectedAccountData?.name} (${selectedAccountData?.account_number})</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th class="text-right">Debit (SSP)</th>
                <th class="text-right">Credit (SSP)</th>
                <th class="text-right">Balance (SSP)</th>
              </tr>
            </thead>
            <tbody>
              ${ledgerData?.transactions
                ?.map(
                  (trans) => `
                <tr>
                  <td>${new Date(trans.date).toLocaleDateString()}</td>
                  <td>${trans.reference}</td>
                  <td>${trans.description}</td>
                  <td class="text-right">${trans.debit?.toLocaleString() || "-"}</td>
                  <td class="text-right">${trans.credit?.toLocaleString() || "-"}</td>
                  <td class="text-right"><strong>${trans.balance?.toLocaleString()}</strong></td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
  }

  if (loading && accounts.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading general ledger...
      </div>
    );
  }

  const selectedAccountData = accounts.find(
    (a) => a.id === parseInt(selectedAccount),
  );
  const openingBalance = ledgerData?.opening_balance || 0;
  const closingBalance = ledgerData?.closing_balance || 0;
  const totalDebit =
    ledgerData?.transactions?.reduce((sum, t) => sum + (t.debit || 0), 0) || 0;
  const totalCredit =
    ledgerData?.transactions?.reduce((sum, t) => sum + (t.credit || 0), 0) || 0;

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
            <h1 className="text-3xl font-bold text-gray-900">General Ledger</h1>
            <p className="mt-2 text-gray-600">
              Detailed transactions for selected account
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

        {/* Filters */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Account *
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_number} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

        {ledgerData && (
          <>
            {/* Account Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600">Opening Balance</p>
                <p className="text-2xl font-bold text-blue-600">
                  SSP{" "}
                  {openingBalance.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600">Closing Balance</p>
                <p className="text-2xl font-bold text-green-600">
                  SSP{" "}
                  {closingBalance.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-gray-600">Period Change</p>
                <p
                  className={`text-2xl font-bold ${closingBalance - openingBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  SSP{" "}
                  {(closingBalance - openingBalance).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Debit (SSP)
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Credit (SSP)
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Balance (SSP)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledgerData.transactions &&
                  ledgerData.transactions.length > 0 ? (
                    <>
                      {ledgerData.transactions.map((trans, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(trans.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-gray-900">
                            {trans.reference}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {trans.description}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-900">
                            {trans.debit
                              ? `SSP ${trans.debit.toLocaleString()}`
                              : "—"}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-900">
                            {trans.credit
                              ? `SSP ${trans.credit.toLocaleString()}`
                              : "—"}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                            SSP {trans.balance?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan="3" className="px-6 py-4">
                          TOTAL
                        </td>
                        <td className="px-6 py-4 text-right text-gray-900">
                          SSP {totalDebit.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-900">
                          SSP {totalCredit.toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No transactions found for this account
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
