"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  ToggleLeft,
} from "lucide-react";
import {
  getChartOfAccounts,
  deleteAccount,
  activateAccount,
  deactivateAccount,
} from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      setError("");

      const data = await getChartOfAccounts();
      setAccounts(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load chart of accounts.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this account?")) return;

    try {
      setUpdating(id);
      await deleteAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      toast.success("Account deleted successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete account",
      );
    } finally {
      setUpdating(null);
    }
  }

  async function handleToggleStatus(id, isActive) {
    try {
      setUpdating(id);
      if (isActive) {
        await deactivateAccount(id);
      } else {
        await activateAccount(id);
      }

      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !isActive } : a)),
      );
      toast.success(
        `Account ${isActive ? "deactivated" : "activated"} successfully`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update account status",
      );
    } finally {
      setUpdating(null);
    }
  }

  const filteredAccounts =
    filterStatus === "all"
      ? accounts
      : filterStatus === "active"
        ? accounts.filter((a) => a.is_active)
        : accounts.filter((a) => !a.is_active);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading chart of accounts...
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
          <h1 className="text-3xl font-bold text-gray-900">
            Chart of Accounts
          </h1>
          <p className="mt-2 text-gray-600">
            Manage general ledger accounts and account structure
          </p>
        </div>
        <Link href="/finance/accounting/accounts/new">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <Plus size={18} />
            New Account
          </button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Unable to load accounts</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-4 py-2 font-medium transition-colors ${
            filterStatus === "all"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          All ({accounts.length})
        </button>
        <button
          onClick={() => setFilterStatus("active")}
          className={`px-4 py-2 font-medium transition-colors ${
            filterStatus === "active"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Active ({accounts.filter((a) => a.is_active).length})
        </button>
        <button
          onClick={() => setFilterStatus("inactive")}
          className={`px-4 py-2 font-medium transition-colors ${
            filterStatus === "inactive"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Inactive ({accounts.filter((a) => !a.is_active).length})
        </button>
      </div>

      {filteredAccounts.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
          <p className="text-gray-600">No accounts found</p>
          <Link href="/finance/accounting/accounts/new">
            <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
              Create your first account
            </button>
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Account Number
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Balance
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
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">
                    {account.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {account.name}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                      {account.account_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {account.category_details?.name || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {account.current_balance
                      ? `SSP ${Number(account.current_balance).toLocaleString()}`
                      : "SSP 0"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        account.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {account.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/finance/accounting/accounts/${account.id}/edit`}
                      >
                        <button
                          disabled={updating === account.id}
                          className="p-1.5 text-gray-600 hover:text-blue-600 disabled:opacity-50"
                        >
                          <Edit size={18} />
                        </button>
                      </Link>
                      <button
                        onClick={() =>
                          handleToggleStatus(account.id, account.is_active)
                        }
                        disabled={updating === account.id}
                        className="p-1.5 text-gray-600 hover:text-green-600 disabled:opacity-50"
                      >
                        <ToggleLeft size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        disabled={updating === account.id}
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
