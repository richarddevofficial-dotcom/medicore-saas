"use client";

import { useEffect, useState } from "react";

const initialForm = {
  employee_number: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  phone: "",
  gender: "",
  date_of_birth: "",
  hire_date: "",
  department: "",
  position: "",
  employment_type: "full_time",
  status: "active",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

export default function EmployeeForm({
  initialData,
  onSubmit,
  submitLabel = "Save Employee",
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialData) {
      return;
    }

    setForm({
      ...initialForm,
      ...initialData,
      department:
        initialData.department?.id ??
        initialData.department ??
        "",
      position:
        initialData.position?.id ??
        initialData.position ??
        "",
    });
  }, [initialData]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [
          key,
          value === "" ? null : value,
        ])
      );

      await onSubmit(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save employee."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100";

  const labelClass = "text-sm font-medium text-gray-700";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Personal Information
        </h2>

        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <label className={labelClass}>
            Employee Number
            <input
              name="employee_number"
              value={form.employee_number || ""}
              onChange={handleChange}
              className={inputClass}
              placeholder="EMP-001"
            />
          </label>

          <label className={labelClass}>
            First Name
            <input
              name="first_name"
              value={form.first_name || ""}
              onChange={handleChange}
              className={inputClass}
              required
            />
          </label>

          <label className={labelClass}>
            Middle Name
            <input
              name="middle_name"
              value={form.middle_name || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Last Name
            <input
              name="last_name"
              value={form.last_name || ""}
              onChange={handleChange}
              className={inputClass}
              required
            />
          </label>

          <label className={labelClass}>
            Gender
            <select
              name="gender"
              value={form.gender || ""}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className={labelClass}>
            Date of Birth
            <input
              type="date"
              name="date_of_birth"
              value={form.date_of_birth || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Contact Information
        </h2>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <label className={labelClass}>
            Email Address
            <input
              type="email"
              name="email"
              value={form.email || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Phone Number
            <input
              name="phone"
              value={form.phone || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </label>

          <label className={`${labelClass} md:col-span-2`}>
            Address
            <textarea
              name="address"
              value={form.address || ""}
              onChange={handleChange}
              className={inputClass}
              rows={3}
            />
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Employment Information
        </h2>

        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <label className={labelClass}>
            Hire Date
            <input
              type="date"
              name="hire_date"
              value={form.hire_date || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Department ID
            <input
              name="department"
              value={form.department || ""}
              onChange={handleChange}
              className={inputClass}
              placeholder="Department ID"
            />
          </label>

          <label className={labelClass}>
            Position ID
            <input
              name="position"
              value={form.position || ""}
              onChange={handleChange}
              className={inputClass}
              placeholder="Position ID"
            />
          </label>

          <label className={labelClass}>
            Employment Type
            <select
              name="employment_type"
              value={form.employment_type || "full_time"}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="temporary">Temporary</option>
              <option value="intern">Intern</option>
            </select>
          </label>

          <label className={labelClass}>
            Status
            <select
              name="status"
              value={form.status || "active"}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </select>
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Emergency Contact
        </h2>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <label className={labelClass}>
            Contact Name
            <input
              name="emergency_contact_name"
              value={form.emergency_contact_name || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Contact Phone
            <input
              name="emergency_contact_phone"
              value={form.emergency_contact_phone || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
