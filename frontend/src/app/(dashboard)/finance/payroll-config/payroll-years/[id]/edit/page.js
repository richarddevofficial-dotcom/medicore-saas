"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPayrollYear, updatePayrollYear } from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useRouter, useParams } from "next/navigation";

export default function EditPayrollYearPage() {
  const router = useRouter();
  const params = useParams();
  const yearId = params.id;

  const [formData, setFormData] = useState({
    year: "",
    start_date: "",
    end_date: "",
    is_active: true,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadPayrollYear();
  }, [yearId]);

  async function loadPayrollYear() {
    try {
      setLoading(true);
      setError("");
      const year = await getPayrollYear(yearId);

      if (year) {
        setFormData({
          year: year.year?.toString() || "",
          start_date: year.start_date || "",
          end_date: year.end_date || "",
          is_active: year.is_active ?? true,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load payroll year",
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

  async function handleSubmit(e) {
    e.preventDefault();

    // Validation
    const newErrors = {};
    if (!formData.year.trim()) newErrors.year = "Year is required";
    if (!formData.start_date) newErrors.start_date = "Start date is required";
    if (!formData.end_date) newErrors.end_date = "End date is required";

    if (new Date(formData.start_date) >= new Date(formData.end_date)) {
      newErrors.end_date = "End date must be after start date";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      await updatePayrollYear(yearId, formData);
      toast.success("Payroll year updated successfully");
      router.push("/finance/payroll-config/payroll-years");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update payroll year",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading payroll year...
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/finance/payroll-config/payroll-years"
        className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Payroll Years
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Edit Payroll Year
        </h1>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Year */}
          <div>
            <label
              htmlFor="year"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Year *
            </label>
            <input
              type="number"
              id="year"
              name="year"
              value={formData.year}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.year ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.year && (
              <p className="text-red-600 text-sm mt-1">{errors.year}</p>
            )}
          </div>

          {/* Start Date */}
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

          {/* End Date */}
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
              Active (Current payroll year)
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t">
            <Link href="/finance/payroll-config/payroll-years">
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
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
