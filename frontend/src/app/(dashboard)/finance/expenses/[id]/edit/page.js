"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getExpense, updateExpense } from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useRouter, useParams } from "next/navigation";

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const expenseId = params.id;

  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    description: "",
    expense_date: new Date().toISOString().split("T")[0],
    payment_method: "bank_transfer",
    status: "pending",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    loadExpense();
  }, [expenseId]);

  async function loadExpense() {
    try {
      setLoading(true);
      setError("");
      const data = await getExpense(expenseId);
      setFormData({
        category: data.category || "",
        amount: data.amount || "",
        description: data.description || "",
        expense_date:
          data.expense_date || new Date().toISOString().split("T")[0],
        payment_method: data.payment_method || "bank_transfer",
        status: data.status || "pending",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expense");
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
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.amount) newErrors.amount = "Amount is required";
    if (parseFloat(formData.amount) <= 0)
      newErrors.amount = "Amount must be greater than 0";
    if (!formData.description)
      newErrors.description = "Description is required";
    if (!formData.expense_date)
      newErrors.expense_date = "Expense date is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      await updateExpense(expenseId, {
        ...formData,
        amount: parseFloat(formData.amount),
      });
      toast.success("Expense updated successfully");
      router.push("/finance/expenses");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update expense",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading expense...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/finance/expenses"
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Expenses
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Expense</h1>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Category *
            </label>
            <input
              type="text"
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="e.g., Office Supplies, Travel"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.category ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.category && (
              <p className="text-red-600 text-sm mt-1">{errors.category}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Amount *
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.amount ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.amount && (
                <p className="text-red-600 text-sm mt-1">{errors.amount}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="expense_date"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Expense Date *
              </label>
              <input
                type="date"
                id="expense_date"
                name="expense_date"
                value={formData.expense_date}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.expense_date ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.expense_date && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.expense_date}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter expense description..."
              rows="3"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.description && (
              <p className="text-red-600 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="payment_method"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Payment Method
              </label>
              <select
                id="payment_method"
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="credit_card">Credit Card</option>
                <option value="check">Check</option>
              </select>
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
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {submitting ? "Updating..." : "Update Expense"}
            </button>
            <Link href="/finance/expenses">
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
