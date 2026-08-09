"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBudget } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function CreateBudgetPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    year: currentYear.toString(),
    start_date: `${currentYear}-01-01`,
    end_date: `${currentYear}-12-31`,
    total_budget: "",
    is_active: true,
  });

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
      const data = await createBudget({
        ...formData,
        year: parseInt(formData.year, 10),
        total_budget: parseFloat(formData.total_budget),
      });
      toast.success("Budget created successfully");
      router.push(`/finance/budgets/${data.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create budget",
      );
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Plus size={24} />
          Create New Budget
        </h1>
        <p className="text-gray-600 mb-6">
          Set up a new budget for your organization
        </p>

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
              placeholder="2026"
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
              min="0"
              step="0.01"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.total_budget ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.total_budget && (
              <p className="text-red-600 text-sm mt-1">{errors.total_budget}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    is_active: event.target.checked,
                  }))
                }
              />
              Active budget year
            </label>
          </div>

          <div className="flex gap-3 pt-6 border-t">
            <Link href="/finance/budgets">
              <button
                type="button"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Create Budget
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
