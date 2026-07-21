"use client";

import { useEffect, useState } from "react";
import {
  getDepartments,
  getPositions,
  normalizeResults,
} from "@/lib/api/hr";
import type {
  Department,
  EmployeePayload,
  JobPosition,
} from "@/types/hr";

interface Props {
  initialData?: Partial<EmployeePayload>;
  submitLabel?: string;
  onSubmit: (payload: EmployeePayload) => Promise<void>;
}

const initialForm: EmployeePayload = {
  employee_number: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  gender: "",
  date_of_birth: null,
  national_id: "",
  passport_number: "",
  email: "",
  phone: "",
  alternative_phone: "",
  address: "",
  department: null,
  position: null,
  reports_to: null,
  employment_type: "PERMANENT",
  employment_status: "ACTIVE",
  hire_date: new Date().toISOString().slice(0, 10),
  confirmation_date: null,
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  tax_number: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
  notes: "",
  is_active: true,
};

export default function EmployeeForm({
  initialData,
  submitLabel = "Save Employee",
  onSubmit,
}: Props) {
  const [form, setForm] = useState<EmployeePayload>({
    ...initialForm,
    ...initialData,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOptions() {
      try {
        const [departmentResponse, positionResponse] = await Promise.all([
          getDepartments(),
          getPositions(),
        ]);

        setDepartments(normalizeResults(departmentResponse));
        setPositions(normalizeResults(positionResponse));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load form options.",
        );
      }
    }

    void loadOptions();
  }, []);

  function updateField<K extends keyof EmployeePayload>(
    key: K,
    value: EmployeePayload[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      const payload: EmployeePayload = {
        ...form,
        date_of_birth: form.date_of_birth || null,
        confirmation_date: form.confirmation_date || null,
        department: form.department || null,
        position: form.position || null,
        reports_to: form.reports_to || null,
      };

      await onSubmit(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save employee.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">
          Personal Information
        </h3>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">
            Employee Number *
            <input
              required
              value={form.employee_number}
              onChange={(event) =>
                updateField("employee_number", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            First Name *
            <input
              required
              value={form.first_name}
              onChange={(event) =>
                updateField("first_name", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Middle Name
            <input
              value={form.middle_name}
              onChange={(event) =>
                updateField("middle_name", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Last Name *
            <input
              required
              value={form.last_name}
              onChange={(event) =>
                updateField("last_name", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Gender
            <select
              value={form.gender}
              onChange={(event) =>
                updateField(
                  "gender",
                  event.target.value as EmployeePayload["gender"],
                )
              }
              className={inputClass}
            >
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">
                Prefer not to say
              </option>
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Date of Birth
            <input
              type="date"
              value={form.date_of_birth || ""}
              onChange={(event) =>
                updateField("date_of_birth", event.target.value || null)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                updateField("email", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Phone
            <input
              value={form.phone}
              onChange={(event) =>
                updateField("phone", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            National ID
            <input
              value={form.national_id}
              onChange={(event) =>
                updateField("national_id", event.target.value)
              }
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">
          Employment Information
        </h3>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">
            Department
            <select
              value={form.department || ""}
              onChange={(event) =>
                updateField(
                  "department",
                  event.target.value
                    ? Number(event.target.value)
                    : null,
                )
              }
              className={inputClass}
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Position
            <select
              value={form.position || ""}
              onChange={(event) =>
                updateField(
                  "position",
                  event.target.value
                    ? Number(event.target.value)
                    : null,
                )
              }
              className={inputClass}
            >
              <option value="">Select position</option>
              {positions
                .filter(
                  (position) =>
                    !form.department ||
                    !position.department ||
                    position.department === form.department,
                )
                .map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Employment Type *
            <select
              required
              value={form.employment_type}
              onChange={(event) =>
                updateField(
                  "employment_type",
                  event.target
                    .value as EmployeePayload["employment_type"],
                )
              }
              className={inputClass}
            >
              <option value="PERMANENT">Permanent</option>
              <option value="CONTRACT">Contract</option>
              <option value="PART_TIME">Part-time</option>
              <option value="TEMPORARY">Temporary</option>
              <option value="INTERN">Intern</option>
              <option value="VOLUNTEER">Volunteer</option>
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Employment Status *
            <select
              required
              value={form.employment_status}
              onChange={(event) =>
                updateField(
                  "employment_status",
                  event.target
                    .value as EmployeePayload["employment_status"],
                )
              }
              className={inputClass}
            >
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="RESIGNED">Resigned</option>
              <option value="TERMINATED">Terminated</option>
              <option value="RETIRED">Retired</option>
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Hire Date *
            <input
              required
              type="date"
              value={form.hire_date}
              onChange={(event) =>
                updateField("hire_date", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Confirmation Date
            <input
              type="date"
              value={form.confirmation_date || ""}
              onChange={(event) =>
                updateField(
                  "confirmation_date",
                  event.target.value || null,
                )
              }
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">
          Emergency Contact
        </h3>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">
            Contact Name
            <input
              value={form.emergency_contact_name}
              onChange={(event) =>
                updateField(
                  "emergency_contact_name",
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Contact Phone
            <input
              value={form.emergency_contact_phone}
              onChange={(event) =>
                updateField(
                  "emergency_contact_phone",
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Relationship
            <input
              value={form.emergency_contact_relationship}
              onChange={(event) =>
                updateField(
                  "emergency_contact_relationship",
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <label className="text-sm font-medium text-gray-700">
          Notes
          <textarea
            rows={4}
            value={form.notes}
            onChange={(event) =>
              updateField("notes", event.target.value)
            }
            className={inputClass}
          />
        </label>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
