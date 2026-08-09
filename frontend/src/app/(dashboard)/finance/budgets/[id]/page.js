"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit2, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { getBudget, updateBudget, deleteBudget } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const budgetId = params.id;

  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    fiscal_year: "",
    total_amount: "",
    status: "draft",
    description: "",
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadBudget();
  }, [budgetId]);

  async function loadBudget() {
    try {
      setLoading(true);
      setError("");
      const data = await getBudget(budgetId);
      setBudget(data);
      setFormData({
        name: data.name || "",
        fiscal_year: data.fiscal_year || "",
        total_amount: data.total_amount || "",
        status: data.status || "draft",
        description: data.description || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budget");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      await updateBudget(budgetId, formData);
      toast.success("Budget updated successfully");
      setIsEditing(false);
      loadBudget();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update budget",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this budget?")) return;
    try {
      setSubmitting(true);
      await deleteBudget(budgetId);
      toast.success("Budget deleted successfully");
      router.push("/finance/budgets");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete budget",
      );
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

  if (error || !budget) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 text-red-600" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">
              Unable to load budget
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
        href="/finance/budgets"
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Budgets
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              FY {budget.year}
            </h1>
            <p className="text-gray-600 text-sm mt-1">ID: {budget.id}</p>
          </div>
          {!isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/finance/budgets/${budgetId}/edit`)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Edit budget year"
              >
                <Edit2 size={20} />
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
              >
                <Trash2 size={20} />
              </button>
            </div>
          )}
        </div>

        {!isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Fiscal Year</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {budget.year}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {budget.formatted_total_budget ||
                    `SSP ${budget.total_budget}`}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">State</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      budget.is_locked
                        ? "bg-amber-100 text-amber-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {budget.is_locked ? "Locked" : "Open"}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {new Date(budget.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            {budget.start_date && budget.end_date && (
              <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <p className="text-sm text-blue-600 font-semibold">
                  Budget Period
                </p>
                <p className="text-gray-700 mt-1">
                  {new Date(budget.start_date).toLocaleDateString()} -{" "}
                  {new Date(budget.end_date).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Budget Name
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="fiscal_year"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Fiscal Year
                </label>
                <input
                  type="text"
                  id="fiscal_year"
                  name="fiscal_year"
                  value={formData.fiscal_year}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="total_amount"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Total Amount
                </label>
                <input
                  type="number"
                  id="total_amount"
                  name="total_amount"
                  value={formData.total_amount}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
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
