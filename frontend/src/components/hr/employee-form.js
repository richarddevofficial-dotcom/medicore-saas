"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { getDepartments, getPositions, normalizeResults } from "@/lib/api/hr";

const initialForm = {
  user: "",
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
  employment_type: "PERMANENT",
  employment_status: "ACTIVE",
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
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    async function loadFormOptions() {
      try {
        const [staffResponse, departmentData, positionData] = await Promise.all(
          [
            apiClient.get("/staff/?is_active=true"),
            getDepartments({ ordering: "name" }),
            getPositions({ ordering: "title" }),
          ],
        );
        const data = staffResponse.data;
        setStaffAccounts(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
              ? data.results
              : [],
        );
        setDepartments(normalizeResults(departmentData));
        setPositions(normalizeResults(positionData));
      } catch {
        setStaffAccounts([]);
        setDepartments([]);
        setPositions([]);
      }
    }

    loadFormOptions();
  }, []);

  useEffect(() => {
    if (!initialData) {
      return;
    }

    setForm({
      ...Object.fromEntries(
        Object.keys(initialForm).map((key) => [key, initialData[key]]),
      ),
      department: initialData.department?.id ?? initialData.department ?? "",
      position: initialData.position?.id ?? initialData.position ?? "",
      user: initialData.user?.id ?? initialData.user ?? "",
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

      const nullableFields = new Set([
        "user",
        "date_of_birth",
        "department",
        "position",
      ]);
      const payload = Object.fromEntries(
        Object.entries(form)
          .filter(([key, value]) => key !== "hire_date" || value !== "")
          .map(([key, value]) => [
            key,
            value === "" && nullableFields.has(key) ? null : value,
          ]),
      );

      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save employee.");
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
              required
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
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
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
            Linked Staff Account
            <select
              name="user"
              value={form.user || ""}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">No linked account</option>
              {staffAccounts.map((staff) => {
                const account = staff.user;
                const name = [account?.first_name, account?.last_name]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <option
                    key={staff.id}
                    value={account?.id || ""}
                    disabled={!account?.id}
                  >
                    {name || account?.email || "Unnamed staff"}
                    {staff.role ? ` (${staff.role})` : ""}
                  </option>
                );
              })}
            </select>
          </label>

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
            Department
            <select
              name="department"
              value={form.department || ""}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Position
            <select
              name="position"
              value={form.position || ""}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">No position</option>
              {positions
                .filter(
                  (position) =>
                    !form.department ||
                    !position.department ||
                    String(position.department) === String(form.department),
                )
                .map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
            </select>
          </label>

          <label className={labelClass}>
            Employment Type
            <select
              name="employment_type"
              value={form.employment_type || "PERMANENT"}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="PERMANENT">Permanent</option>
              <option value="CONTRACT">Contract</option>
              <option value="PART_TIME">Part Time</option>
              <option value="TEMPORARY">Temporary</option>
              <option value="INTERN">Intern</option>
              <option value="VOLUNTEER">Volunteer</option>
            </select>
          </label>

          <label className={labelClass}>
            Status
            <select
              name="employment_status"
              value={form.employment_status || "ACTIVE"}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="RESIGNED">Resigned</option>
              <option value="TERMINATED">Terminated</option>
              <option value="RETIRED">Retired</option>
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
