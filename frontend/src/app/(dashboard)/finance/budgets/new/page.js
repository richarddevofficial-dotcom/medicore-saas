"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBudget } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function CreateBudgetPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: "",
    fiscal_year: new Date().getFullYear().toString(),
    total_amount: "",
    status: "draft",
    description: "",
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
    if (!formData.name) newErrors.name = "Budget name is required";
    if (!formData.fiscal_year)
      newErrors.fiscal_year = "Fiscal year is required";
    if (!formData.total_amount)
      newErrors.total_amount = "Total amount is required";
    if (parseFloat(formData.total_amount) <= 0)
      newErrors.total_amount = "Amount must be greater than 0";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      const data = await createBudget({
        ...formData,
        total_amount: parseFloat(formData.total_amount),
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
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Budget Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., FY 2024-2025 Operations"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="text-red-600 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="fiscal_year"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Fiscal Year *
              </label>
              <input
                type="text"
                id="fiscal_year"
                name="fiscal_year"
                value={formData.fiscal_year}
                onChange={handleChange}
                placeholder="2024"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.fiscal_year ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.fiscal_year && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.fiscal_year}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="total_amount"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Total Amount *
              </label>
              <input
                type="number"
                id="total_amount"
                name="total_amount"
                value={formData.total_amount}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.total_amount ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.total_amount && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.total_amount}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Initial Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">Draft (Editable)</option>
              <option value="approved">Approved (Locked)</option>
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
              placeholder="Budget details and notes..."
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
