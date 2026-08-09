"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createExpense,
  createExpenseCategory,
  getExpenseCategories,
} from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function CreateExpensePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ code: "", name: "" });
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    category: "",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    vendor_name: "",
    invoice_number: "",
    notes: "",
  });

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getExpenseCategories({ is_active: true });
        const rows = Array.isArray(data) ? data : data.results || [];
        setCategories(rows);
        setShowCategoryForm(rows.length === 0);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load categories",
        );
      }
    }

    loadCategories();
  }, []);

  async function handleCreateCategory() {
    const code = newCategory.code.trim().toUpperCase();
    const name = newCategory.name.trim();
    if (!code || !name) {
      toast.error("Category code and name are required");
      return;
    }

    try {
      setCreatingCategory(true);
      const category = await createExpenseCategory({
        code,
        name,
        is_active: true,
      });
      setCategories((previous) => [...previous, category]);
      setFormData((previous) => ({
        ...previous,
        category: String(category.id),
      }));
      setErrors((previous) => {
        const nextErrors = { ...previous };
        delete nextErrors.category;
        return nextErrors;
      });
      setNewCategory({ code: "", name: "" });
      setShowCategoryForm(false);
      toast.success("Expense category created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create category",
      );
    } finally {
      setCreatingCategory(false);
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
    if (!formData.description)
      newErrors.description = "Description is required";
    if (!formData.amount) newErrors.amount = "Amount is required";
    if (parseFloat(formData.amount) <= 0)
      newErrors.amount = "Amount must be greater than 0";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      const data = await createExpense({
        ...formData,
        amount: parseFloat(formData.amount),
        category: parseInt(formData.category, 10),
      });
      toast.success("Expense created successfully");
      router.push(`/finance/expenses/${data.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create expense",
      );
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Plus size={24} />
          Create New Expense
        </h1>
        <p className="text-gray-600 mb-6">Record a new expense entry</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700"
              >
                Category *
              </label>
              {!showCategoryForm && (
                <button
                  type="button"
                  onClick={() => setShowCategoryForm(true)}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <Plus size={15} />
                  New category
                </button>
              )}
            </div>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.category ? "border-red-500" : "border-gray-300"}`}
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code} - {category.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="text-red-600 text-sm mt-1">{errors.category}</p>
            )}
            {showCategoryForm && (
              <div className="mt-3 border-l-2 border-blue-500 pl-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="new_category_code"
                      className="mb-1 block text-xs font-medium text-gray-600"
                    >
                      Category code
                    </label>
                    <input
                      id="new_category_code"
                      value={newCategory.code}
                      onChange={(event) =>
                        setNewCategory((previous) => ({
                          ...previous,
                          code: event.target.value,
                        }))
                      }
                      placeholder="e.g., UTILITIES"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new_category_name"
                      className="mb-1 block text-xs font-medium text-gray-600"
                    >
                      Category name
                    </label>
                    <input
                      id="new_category_name"
                      value={newCategory.name}
                      onChange={(event) =>
                        setNewCategory((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g., Utilities"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={creatingCategory}
                    className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {creatingCategory && (
                      <Loader2 size={15} className="animate-spin" />
                    )}
                    Create category
                  </button>
                  {categories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCategoryForm(false)}
                      className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Description *
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="e.g., Office supplies purchase"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="vendor_name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Vendor
              </label>
              <input
                id="vendor_name"
                name="vendor_name"
                value={formData.vendor_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="invoice_number"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Invoice Number
              </label>
              <input
                id="invoice_number"
                name="invoice_number"
                value={formData.invoice_number}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional expense details..."
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-6 border-t">
            <Link href="/finance/expenses">
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
                  Create Expense
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
