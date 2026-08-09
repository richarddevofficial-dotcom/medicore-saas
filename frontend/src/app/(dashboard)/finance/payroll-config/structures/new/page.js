"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  createSalaryStructure,
  getAllowanceTypes,
  getDeductionTypes,
  getSalaryStructure,
  updateSalaryStructure,
} from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useParams, useRouter } from "next/navigation";

export default function NewSalaryStructurePage() {
  const router = useRouter();
  const params = useParams();
  const structureId = params?.id;
  const isEditing = Boolean(structureId);
  const [allowances, setAllowances] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    base_salary: "",
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
      if (isEditing) {
        const structure = await getSalaryStructure(structureId);
        setFormData({
          name: structure.name || "",
          description: structure.description || "",
          base_salary: structure.base_salary || "",
          is_active: structure.is_active ?? true,
          allowances: (structure.allowances || []).map((item) => ({
            allowance_type_id: item.allowance_type.id,
            amount: item.amount,
            is_percentage: item.is_percentage,
          })),
          deductions: (structure.deductions || []).map((item) => ({
            deduction_type_id: item.deduction_type.id,
            amount: item.amount,
            is_percentage: item.is_percentage,
          })),
        });
      }
    } catch (err) {
      toast.error(
        isEditing
          ? "Failed to load salary structure"
          : "Failed to load allowance and deduction types",
      );
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
    if (
      !formData.allowances.some(
        (item) => item.allowance_type_id === allowanceId,
      )
    ) {
      setFormData((prev) => ({
        ...prev,
        allowances: [
          ...prev.allowances,
          { allowance_type_id: allowanceId, amount: "", is_percentage: false },
        ],
      }));
    }
  }

  function removeAllowance(allowanceId) {
    setFormData((prev) => ({
      ...prev,
      allowances: prev.allowances.filter(
        (item) => item.allowance_type_id !== allowanceId,
      ),
    }));
  }

  function addDeduction(deductionId) {
    if (
      !formData.deductions.some(
        (item) => item.deduction_type_id === deductionId,
      )
    ) {
      setFormData((prev) => ({
        ...prev,
        deductions: [
          ...prev.deductions,
          { deduction_type_id: deductionId, amount: "", is_percentage: false },
        ],
      }));
    }
  }

  function removeDeduction(deductionId) {
    setFormData((prev) => ({
      ...prev,
      deductions: prev.deductions.filter(
        (item) => item.deduction_type_id !== deductionId,
      ),
    }));
  }

  function updateComponent(collection, typeId, field, value) {
    const idField =
      collection === "allowances" ? "allowance_type_id" : "deduction_type_id";
    setFormData((previous) => ({
      ...previous,
      [collection]: previous[collection].map((item) =>
        item[idField] === typeId ? { ...item, [field]: value } : item,
      ),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Validation
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Structure name is required";
    if (!formData.base_salary || parseFloat(formData.base_salary) < 0)
      newErrors.base_salary = "Enter a valid base salary";
    if (
      [...formData.allowances, ...formData.deductions].some(
        (item) => item.amount === "" || parseFloat(item.amount) < 0,
      )
    )
      newErrors.components = "Enter an amount for every selected component";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: formData.name,
        description: formData.description,
        base_salary: parseFloat(formData.base_salary),
        is_active: formData.is_active,
        allowances: formData.allowances.map((item) => ({
          ...item,
          amount: parseFloat(item.amount),
        })),
        deductions: formData.deductions.map((item) => ({
          ...item,
          amount: parseFloat(item.amount),
        })),
      };
      if (isEditing) {
        await updateSalaryStructure(structureId, payload);
      } else {
        await createSalaryStructure(payload);
      }
      toast.success(
        `Salary structure ${isEditing ? "updated" : "created"} successfully`,
      );
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
          {isEditing ? "Edit" : "New"} Salary Structure
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

          <div>
            <label
              htmlFor="base_salary"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Base Salary *
            </label>
            <input
              type="number"
              id="base_salary"
              name="base_salary"
              value={formData.base_salary}
              onChange={handleChange}
              min="0"
              step="0.01"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.base_salary ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.base_salary && (
              <p className="text-red-600 text-sm mt-1">{errors.base_salary}</p>
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
                      formData.allowances.some(
                        (item) => item.allowance_type_id === allowance.id,
                      )
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() =>
                      formData.allowances.some(
                        (item) => item.allowance_type_id === allowance.id,
                      )
                        ? removeAllowance(allowance.id)
                        : addAllowance(allowance.id)
                    }
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={formData.allowances.some(
                          (item) => item.allowance_type_id === allowance.id,
                        )}
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
                    {formData.allowances.some(
                      (item) => item.allowance_type_id === allowance.id,
                    ) && (
                      <div
                        className="flex items-center gap-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="number"
                          min="0"
                          max={
                            formData.allowances.find(
                              (item) => item.allowance_type_id === allowance.id,
                            )?.is_percentage
                              ? "100"
                              : undefined
                          }
                          step="0.01"
                          value={
                            formData.allowances.find(
                              (item) => item.allowance_type_id === allowance.id,
                            )?.amount || ""
                          }
                          onChange={(event) =>
                            updateComponent(
                              "allowances",
                              allowance.id,
                              "amount",
                              event.target.value,
                            )
                          }
                          className="w-28 rounded border border-gray-300 px-3 py-2"
                          placeholder="Amount"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={
                              formData.allowances.find(
                                (item) =>
                                  item.allowance_type_id === allowance.id,
                              )?.is_percentage || false
                            }
                            onChange={(event) =>
                              updateComponent(
                                "allowances",
                                allowance.id,
                                "is_percentage",
                                event.target.checked,
                              )
                            }
                          />
                          Percentage
                        </label>
                      </div>
                    )}
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
                      formData.deductions.some(
                        (item) => item.deduction_type_id === deduction.id,
                      )
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() =>
                      formData.deductions.some(
                        (item) => item.deduction_type_id === deduction.id,
                      )
                        ? removeDeduction(deduction.id)
                        : addDeduction(deduction.id)
                    }
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={formData.deductions.some(
                          (item) => item.deduction_type_id === deduction.id,
                        )}
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
                    {formData.deductions.some(
                      (item) => item.deduction_type_id === deduction.id,
                    ) && (
                      <div
                        className="flex items-center gap-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="number"
                          min="0"
                          max={
                            formData.deductions.find(
                              (item) => item.deduction_type_id === deduction.id,
                            )?.is_percentage
                              ? "100"
                              : undefined
                          }
                          step="0.01"
                          value={
                            formData.deductions.find(
                              (item) => item.deduction_type_id === deduction.id,
                            )?.amount || ""
                          }
                          onChange={(event) =>
                            updateComponent(
                              "deductions",
                              deduction.id,
                              "amount",
                              event.target.value,
                            )
                          }
                          className="w-28 rounded border border-gray-300 px-3 py-2"
                          placeholder="Amount"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={
                              formData.deductions.find(
                                (item) =>
                                  item.deduction_type_id === deduction.id,
                              )?.is_percentage || false
                            }
                            onChange={(event) =>
                              updateComponent(
                                "deductions",
                                deduction.id,
                                "is_percentage",
                                event.target.checked,
                              )
                            }
                          />
                          Percentage
                        </label>
                      </div>
                    )}
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

          {errors.components && (
            <p className="text-red-600 text-sm">{errors.components}</p>
          )}

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
              {submitting
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                  ? "Update Structure"
                  : "Create Structure"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
