"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  createSalaryStructure,
  getAllowanceTypes,
  getDeductionTypes,
} from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function NewSalaryStructurePage() {
  const router = useRouter();
  const [allowances, setAllowances] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    allowances: [],
    deductions: [],
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [allowancesData, deductionsData] = await Promise.all([
        getAllowanceTypes(),
        getDeductionTypes(),
      ]);
      setAllowances(
        Array.isArray(allowancesData)
          ? allowancesData
          : allowancesData.results || [],
      );
      setDeductions(
        Array.isArray(deductionsData)
          ? deductionsData
          : deductionsData.results || [],
      );
    } catch (err) {
      toast.error("Failed to load allowance and deduction types");
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
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }

  function addAllowance(allowanceId) {
    if (!formData.allowances.includes(allowanceId)) {
      setFormData((prev) => ({
        ...prev,
        allowances: [...prev.allowances, allowanceId],
      }));
    }
  }

  function removeAllowance(allowanceId) {
    setFormData((prev) => ({
      ...prev,
      allowances: prev.allowances.filter((id) => id !== allowanceId),
    }));
  }

  function addDeduction(deductionId) {
    if (!formData.deductions.includes(deductionId)) {
      setFormData((prev) => ({
        ...prev,
        deductions: [...prev.deductions, deductionId],
      }));
    }
  }

  function removeDeduction(deductionId) {
    setFormData((prev) => ({
      ...prev,
      deductions: prev.deductions.filter((id) => id !== deductionId),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Validation
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Structure name is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      await createSalaryStructure({
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        allowances: formData.allowances,
        deductions: formData.deductions,
      });
      toast.success("Salary structure created successfully");
      router.push("/finance/payroll-config/structures");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to create salary structure",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <Link
        href="/finance/payroll-config/structures"
        className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Salary Structures
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          New Salary Structure
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Structure Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Structure Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Staff Grade 1"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="text-red-600 text-sm mt-1">{errors.name}</p>
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
              placeholder="Structure details..."
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label
              htmlFor="is_active"
              className="text-sm font-medium text-gray-700"
            >
              Active
            </label>
          </div>

          {/* Allowances Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Select Allowances
            </h3>
            {allowances.length > 0 ? (
              <div className="border rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
                {allowances.map((allowance) => (
                  <div
                    key={allowance.id}
                    className={`p-3 border rounded flex items-center justify-between cursor-pointer ${
                      formData.allowances.includes(allowance.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() =>
                      formData.allowances.includes(allowance.id)
                        ? removeAllowance(allowance.id)
                        : addAllowance(allowance.id)
                    }
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={formData.allowances.includes(allowance.id)}
                        onChange={() => {}}
                        className="w-4 h-4 rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {allowance.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {allowance.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No allowance types available
              </p>
            )}
            <div className="mt-3">
              <p className="text-sm text-gray-600">
                Selected: {formData.allowances.length} allowance(s)
              </p>
            </div>
          </div>

          {/* Deductions Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Select Deductions
            </h3>
            {deductions.length > 0 ? (
              <div className="border rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
                {deductions.map((deduction) => (
                  <div
                    key={deduction.id}
                    className={`p-3 border rounded flex items-center justify-between cursor-pointer ${
                      formData.deductions.includes(deduction.id)
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() =>
                      formData.deductions.includes(deduction.id)
                        ? removeDeduction(deduction.id)
                        : addDeduction(deduction.id)
                    }
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={formData.deductions.includes(deduction.id)}
                        onChange={() => {}}
                        className="w-4 h-4 rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {deduction.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {deduction.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No deduction types available
              </p>
            )}
            <div className="mt-3">
              <p className="text-sm text-gray-600">
                Selected: {formData.deductions.length} deduction(s)
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t">
            <Link href="/finance/payroll-config/structures">
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Structure"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
