"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit2, AlertCircle, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { getAccount, updateAccount } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id;

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    normal_balance: "",
    is_active: true,
  });

  useEffect(() => {
    loadAccount();
  }, [accountId]);

  async function loadAccount() {
    try {
      setLoading(true);
      setError("");
      const data = await getAccount(accountId);
      setAccount(data);
      setFormData({
        name: data.name || "",
        code: data.code || "",
        description: data.description || "",
        normal_balance: data.normal_balance || "debit",
        is_active: data.is_active !== false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      await updateAccount(accountId, formData);
      toast.success("Account updated successfully");
      setIsEditing(false);
      loadAccount();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update account",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 text-red-600" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">
              Unable to load account
            </h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/finance/accounting/accounts"
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Accounts
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{account.code}</h1>
            <p className="text-gray-600 text-sm mt-1">{account.name}</p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Edit2 size={20} />
            </button>
          )}
        </div>

        {!isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Account Code</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {account.code}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Normal Balance</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {account.normal_balance?.toUpperCase()}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      account.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {account.is_active ? "Active" : "Inactive"}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  ₹{(account.current_balance || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {account.description && (
              <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <p className="text-sm text-blue-600 font-semibold">
                  Description
                </p>
                <p className="text-gray-700 mt-1">{account.description}</p>
              </div>
            )}

            {account.category && (
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Category</p>
                <p className="text-gray-900 mt-1">{account.category?.name}</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Account Code
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Account Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="normal_balance"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Normal Balance
              </label>
              <select
                id="normal_balance"
                name="normal_balance"
                value={formData.normal_balance}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label
                htmlFor="is_active"
                className="ml-2 block text-sm font-medium text-gray-700"
              >
                Active Account
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
