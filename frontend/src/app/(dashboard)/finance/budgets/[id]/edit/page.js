"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getBudget, updateBudget } from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useRouter, useParams } from "next/navigation";

export default function EditBudgetPage() {
  const router = useRouter();
  const params = useParams();
  const budgetId = params.id;

  const [formData, setFormData] = useState({
    year: "",
    start_date: "",
    end_date: "",
    total_budget: "",
    is_active: true,
    is_locked: false,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    loadBudget();
  }, [budgetId]);

  async function loadBudget() {
    try {
      setLoading(true);
      setError("");
      const data = await getBudget(budgetId);
      setFormData({
        year: String(data.year || ""),
        start_date: data.start_date || "",
        end_date: data.end_date || "",
        total_budget: data.total_budget || "",
        is_active: data.is_active ?? true,
        is_locked: data.is_locked ?? false,
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
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Validation
    const newErrors = {};
    if (!formData.year) newErrors.year = "Budget year is required";
    if (!formData.start_date) newErrors.start_date = "Start date is required";
    if (!formData.end_date) newErrors.end_date = "End date is required";
    if (formData.start_date > formData.end_date)
      newErrors.end_date = "End date must be on or after the start date";
    if (!formData.total_budget)
      newErrors.total_budget = "Total budget is required";
    if (parseFloat(formData.total_budget) <= 0)
      newErrors.total_budget = "Amount must be greater than 0";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      await updateBudget(budgetId, {
        year: parseInt(formData.year, 10),
        start_date: formData.start_date,
        end_date: formData.end_date,
        total_budget: parseFloat(formData.total_budget),
        is_active: formData.is_active,
      });
      toast.success("Budget updated successfully");
      router.push("/finance/budgets");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update budget",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading budget...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/finance/budgets"
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Budgets
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Budget</h1>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="year"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Budget Year *
            </label>
            <input
              type="number"
              id="year"
              name="year"
              value={formData.year}
              onChange={handleChange}
              disabled={formData.is_locked}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.year ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.year && (
              <p className="text-red-600 text-sm mt-1">{errors.year}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="start_date"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Start Date *
              </label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                disabled={formData.is_locked}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.start_date ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.start_date && (
                <p className="text-red-600 text-sm mt-1">{errors.start_date}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="end_date"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                End Date *
              </label>
              <input
                type="date"
                id="end_date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                disabled={formData.is_locked}
                placeholder="0"
                step="0.01"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.end_date ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.end_date && (
                <p className="text-red-600 text-sm mt-1">{errors.end_date}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="total_budget"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Total Budget *
            </label>
            <input
              type="number"
              id="total_budget"
              name="total_budget"
              value={formData.total_budget}
              onChange={handleChange}
              disabled={formData.is_locked}
              min="0"
              step="0.01"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.total_budget ? "border-red-500" : "border-gray-300"}`}
            />
          </div>

          <div>
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formData.is_active}
                disabled={formData.is_locked}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    is_active: event.target.checked,
                  }))
                }
              />
              Active budget year
            </label>
            {formData.is_locked && (
              <p className="mt-2 text-sm text-amber-700">
                Unlock this budget year before editing its details.
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting || formData.is_locked}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {submitting ? "Updating..." : "Update Budget"}
            </button>
            <Link href="/finance/budgets">
              <button
                type="button"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
