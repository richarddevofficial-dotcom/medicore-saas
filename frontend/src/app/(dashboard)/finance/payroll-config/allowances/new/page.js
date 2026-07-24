"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAllowanceType } from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const ALLOWANCE_TYPES = [
  { value: "BASIC", label: "Basic Salary" },
  { value: "DEARNESS", label: "Dearness Allowance" },
  { value: "HOUSE_RENT", label: "House Rent Allowance" },
  { value: "CONVEYANCE", label: "Conveyance Allowance" },
  { value: "SPECIAL", label: "Special Allowance" },
  { value: "OTHER", label: "Other Allowance" },
];

export default function NewAllowanceTypePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    allowance_type: "OTHER",
    is_taxable: false,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
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
    if (!formData.name.trim()) newErrors.name = "Allowance name is required";
    if (!formData.allowance_type)
      newErrors.allowance_type = "Allowance type is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      await createAllowanceType(formData);
      toast.success("Allowance type created successfully");
      router.push("/finance/payroll-config/allowances");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create allowance type",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/finance/payroll-config/allowances"
        className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Allowance Types
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          New Allowance Type
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Allowance Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Allowance Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Dearness Allowance"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="text-red-600 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Allowance Type */}
          <div>
            <label
              htmlFor="allowance_type"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Allowance Type *
            </label>
            <select
              id="allowance_type"
              name="allowance_type"
              value={formData.allowance_type}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.allowance_type ? "border-red-500" : "border-gray-300"
              }`}
            >
              {ALLOWANCE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.allowance_type && (
              <p className="text-red-600 text-sm mt-1">
                {errors.allowance_type}
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

          {/* Taxable Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_taxable"
              name="is_taxable"
              checked={formData.is_taxable}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label
              htmlFor="is_taxable"
              className="text-sm font-medium text-gray-700"
            >
              Is Taxable (Subject to income tax)
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t">
            <Link href="/finance/payroll-config/allowances">
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
              {loading ? "Creating..." : "Create Allowance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
