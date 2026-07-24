"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createDeductionType } from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const DEDUCTION_TYPES = [
  { value: "PROVIDENT_FUND", label: "Provident Fund (PF)" },
  { value: "INCOME_TAX", label: "Income Tax (IT)" },
  { value: "ESI", label: "Employee State Insurance (ESI)" },
  { value: "PROFESSIONAL_TAX", label: "Professional Tax" },
  { value: "UNION_FUND", label: "Union Fund" },
  { value: "OTHER", label: "Other Deduction" },
];

export default function NewDeductionTypePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    deduction_type: "OTHER",
    limit_percentage: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

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
    if (!formData.name.trim()) newErrors.name = "Deduction name is required";
    if (!formData.deduction_type)
      newErrors.deduction_type = "Deduction type is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      await createDeductionType({
        ...formData,
        limit_percentage: formData.limit_percentage
          ? parseFloat(formData.limit_percentage)
          : null,
      });
      toast.success("Deduction type created successfully");
      router.push("/finance/payroll-config/deductions");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create deduction type",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/finance/payroll-config/deductions"
        className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Deduction Types
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          New Deduction Type
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Deduction Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Deduction Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Provident Fund"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="text-red-600 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Deduction Type */}
          <div>
            <label
              htmlFor="deduction_type"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Deduction Type *
            </label>
            <select
              id="deduction_type"
              name="deduction_type"
              value={formData.deduction_type}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.deduction_type ? "border-red-500" : "border-gray-300"
              }`}
            >
              {DEDUCTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.deduction_type && (
              <p className="text-red-600 text-sm mt-1">
                {errors.deduction_type}
              </p>
            )}
          </div>

          {/* Description */}
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
              placeholder="Detailed description..."
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Limit Percentage */}
          <div>
            <label
              htmlFor="limit_percentage"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Limit Percentage (Optional)
            </label>
            <input
              type="number"
              id="limit_percentage"
              name="limit_percentage"
              value={formData.limit_percentage}
              onChange={handleChange}
              placeholder="e.g., 10.5"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Maximum percentage of salary that can be deducted
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t">
            <Link href="/finance/payroll-config/deductions">
              <button
                type="button"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Deduction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
