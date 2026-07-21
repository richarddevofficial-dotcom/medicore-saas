"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bed,
  Building2,
  CalendarDays,
  Loader2,
  Save,
  Search,
  Stethoscope,
  User,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";

import apiClient from "@/lib/api-client";


const initialForm = {
  patient: "",
  admitting_doctor: "",
  ward: "",
  room: "",
  bed: "",
  admission_type: "elective",
  provisional_diagnosis: "",
  reason_for_admission: "",
  presenting_complaint: "",
  admission_notes: "",
  expected_discharge_date: "",
};


export default function NewAdmissionPage() {
  const router = useRouter();

  const [form, setForm] = useState(
    initialForm,
  );

  const [lookups, setLookups] =
    useState({
      patients: [],
      doctors: [],
      wards: [],
      rooms: [],
      beds: [],
    });

  const [
    patientSearch,
    setPatientSearch,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const [fieldErrors, setFieldErrors] =
    useState({});

  async function loadLookups() {
    try {
      setLoading(true);
      setError("");

      const response = await apiClient.get(
        "/ipd/lookups/",
      );

      setLookups(response.data);
    } catch (requestError) {
      const responseData =
        requestError.response?.data;

      setError(
        responseData?.error ||
          responseData?.detail ||
          (
            typeof responseData === "string"
              ? responseData
              : JSON.stringify(responseData)
          ) ||
          requestError.message ||
          "Unable to load admission form data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  const filteredPatients = useMemo(
    () => {
      const query = patientSearch
        .trim()
        .toLowerCase();

      if (!query) {
        return lookups.patients;
      }

      return lookups.patients.filter(
        (patient) =>
          patient.name
            ?.toLowerCase()
            .includes(query) ||
          String(
            patient.patient_number || "",
          )
            .toLowerCase()
            .includes(query) ||
          String(patient.phone || "")
            .toLowerCase()
            .includes(query),
      );
    },
    [
      patientSearch,
      lookups.patients,
    ],
  );

  const filteredRooms = useMemo(
    () =>
      lookups.rooms.filter(
        (room) =>
          !form.ward ||
          String(room.ward_id) ===
            String(form.ward),
      ),
    [
      lookups.rooms,
      form.ward,
    ],
  );

  const filteredBeds = useMemo(
    () =>
      lookups.beds.filter((bed) => {
        if (
          form.ward &&
          String(bed.ward_id) !==
            String(form.ward)
        ) {
          return false;
        }

        if (
          form.room &&
          String(bed.room_id) !==
            String(form.room)
        ) {
          return false;
        }

        return bed.status === "available";
      }),
    [
      lookups.beds,
      form.ward,
      form.room,
    ],
  );

  function updateField(
    field,
    value,
  ) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === "ward") {
        next.room = "";
        next.bed = "";
      }

      if (field === "room") {
        next.bed = "";
      }

      return next;
    });

    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      const payload = {
        ...form,
        patient: Number(form.patient),
        admitting_doctor:
          form.admitting_doctor
            ? Number(
                form.admitting_doctor,
              )
            : null,
        ward: form.ward
          ? Number(form.ward)
          : null,
        room: form.room
          ? Number(form.room)
          : null,
        bed: form.bed
          ? Number(form.bed)
          : null,
        expected_discharge_date:
          form.expected_discharge_date ||
          null,
      };

      const response = await apiClient.post(
        "/ipd/admissions/",
        payload,
      );

      const admission =
        response.data.admission;

      router.push(
        `/ipd/admissions/${admission.id}`,
      );
    } catch (requestError) {
      const responseData =
        requestError.response?.data;

      if (
        responseData &&
        typeof responseData === "object"
      ) {
        setFieldErrors(responseData);
      }

      setError(
        responseData?.error ||
          responseData?.detail ||
          "Unable to create the admission.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={42}
            className="mx-auto animate-spin text-orange-500"
          />

          <p className="mt-4 text-sm text-slate-500">
            Loading admission form...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <Link
          href="/ipd/admissions"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600"
        >
          <ArrowLeft size={18} />
          Back to Admissions
        </Link>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
          Inpatient Department
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          New Admission
        </h1>

        <p className="mt-2 text-slate-600">
          Create a pending inpatient admission
          and reserve the intended ward, room,
          and bed.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <FormSection
          title="Patient Information"
          icon={User}
        >
          <div className="md:col-span-2">
            <FormLabel>
              Search Patient
            </FormLabel>

            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={patientSearch}
                onChange={(event) =>
                  setPatientSearch(
                    event.target.value,
                  )
                }
                placeholder="Search by patient name, number, or phone..."
                className="form-input pl-10"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <FormLabel required>
              Patient
            </FormLabel>

            <select
              required
              value={form.patient}
              onChange={(event) =>
                updateField(
                  "patient",
                  event.target.value,
                )
              }
              className="form-input"
            >
              <option value="">
                Select patient
              </option>

              {filteredPatients.map(
                (patient) => (
                  <option
                    key={patient.id}
                    value={patient.id}
                  >
                    {patient.name}
                    {" — "}
                    {patient.patient_number}
                    {patient.phone
                      ? ` — ${patient.phone}`
                      : ""}
                  </option>
                ),
              )}
            </select>

            <FieldError
              value={fieldErrors.patient}
            />
          </div>
        </FormSection>

        <FormSection
          title="Clinical Admission"
          icon={Stethoscope}
        >
          <FormField
            label="Admission Type"
            required
          >
            <select
              required
              value={form.admission_type}
              onChange={(event) =>
                updateField(
                  "admission_type",
                  event.target.value,
                )
              }
              className="form-input"
            >
              <option value="elective">
                Elective
              </option>
              <option value="emergency">
                Emergency
              </option>
              <option value="transfer">
                Transfer
              </option>
              <option value="observation">
                Observation
              </option>
            </select>
          </FormField>

          <FormField label="Admitting Doctor">
            <select
              value={
                form.admitting_doctor
              }
              onChange={(event) =>
                updateField(
                  "admitting_doctor",
                  event.target.value,
                )
              }
              className="form-input"
            >
              <option value="">
                Select doctor
              </option>

              {lookups.doctors.map(
                (doctor) => (
                  <option
                    key={doctor.id}
                    value={doctor.id}
                  >
                    {doctor.name}
                    {doctor.specialization
                      ? ` — ${doctor.specialization}`
                      : ""}
                  </option>
                ),
              )}
            </select>
          </FormField>

          <div className="md:col-span-2">
            <FormLabel required>
              Provisional Diagnosis
            </FormLabel>

            <textarea
              required
              rows={3}
              value={
                form.provisional_diagnosis
              }
              onChange={(event) =>
                updateField(
                  "provisional_diagnosis",
                  event.target.value,
                )
              }
              className="form-input"
              placeholder="Enter the initial diagnosis..."
            />

            <FieldError
              value={
                fieldErrors.provisional_diagnosis
              }
            />
          </div>

          <div className="md:col-span-2">
            <FormLabel required>
              Reason for Admission
            </FormLabel>

            <textarea
              required
              rows={3}
              value={
                form.reason_for_admission
              }
              onChange={(event) =>
                updateField(
                  "reason_for_admission",
                  event.target.value,
                )
              }
              className="form-input"
              placeholder="Explain why inpatient care is required..."
            />

            <FieldError
              value={
                fieldErrors.reason_for_admission
              }
            />
          </div>

          <div className="md:col-span-2">
            <FormLabel>
              Presenting Complaint
            </FormLabel>

            <textarea
              rows={3}
              value={
                form.presenting_complaint
              }
              onChange={(event) =>
                updateField(
                  "presenting_complaint",
                  event.target.value,
                )
              }
              className="form-input"
              placeholder="Describe the patient's presenting complaint..."
            />
          </div>
        </FormSection>

        <FormSection
          title="Bed Allocation"
          icon={Bed}
        >
          <FormField label="Ward">
            <select
              value={form.ward}
              onChange={(event) =>
                updateField(
                  "ward",
                  event.target.value,
                )
              }
              className="form-input"
            >
              <option value="">
                Select ward
              </option>

              {lookups.wards.map(
                (ward) => (
                  <option
                    key={ward.id}
                    value={ward.id}
                  >
                    {ward.name}
                    {" — "}
                    {ward.ward_type}
                  </option>
                ),
              )}
            </select>
          </FormField>

          <FormField label="Room">
            <select
              value={form.room}
              onChange={(event) =>
                updateField(
                  "room",
                  event.target.value,
                )
              }
              className="form-input"
              disabled={!form.ward}
            >
              <option value="">
                Select room
              </option>

              {filteredRooms.map(
                (room) => (
                  <option
                    key={room.id}
                    value={room.id}
                  >
                    Room {room.room_number}
                    {" — "}
                    {room.room_type}
                  </option>
                ),
              )}
            </select>
          </FormField>

          <FormField label="Available Bed">
            <select
              value={form.bed}
              onChange={(event) =>
                updateField(
                  "bed",
                  event.target.value,
                )
              }
              className="form-input"
              disabled={!form.room}
            >
              <option value="">
                Select bed
              </option>

              {filteredBeds.map(
                (bed) => (
                  <option
                    key={bed.id}
                    value={bed.id}
                  >
                    Bed {bed.bed_number}
                    {" — "}
                    {bed.bed_type}
                    {" — "}
                    {bed.price_per_day}
                  </option>
                ),
              )}
            </select>
          </FormField>

          <FormField
            label="Expected Discharge Date"
          >
            <div className="relative">
              <CalendarDays
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="date"
                value={
                  form.expected_discharge_date
                }
                onChange={(event) =>
                  updateField(
                    "expected_discharge_date",
                    event.target.value,
                  )
                }
                className="form-input pl-10"
              />
            </div>
          </FormField>
        </FormSection>

        <FormSection
          title="Admission Notes"
          icon={Building2}
        >
          <div className="md:col-span-2">
            <FormLabel>
              Additional Notes
            </FormLabel>

            <textarea
              rows={4}
              value={form.admission_notes}
              onChange={(event) =>
                updateField(
                  "admission_notes",
                  event.target.value,
                )
              }
              className="form-input"
              placeholder="Enter additional admission instructions or notes..."
            />
          </div>
        </FormSection>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/ipd/admissions"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2
                size={18}
                className="animate-spin"
              />
            ) : (
              <Save size={18} />
            )}

            Create Admission
          </button>
        </div>
      </form>

      <style jsx global>{`
        .form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          outline: none;
        }

        .form-input:focus {
          border-color: rgb(249 115 22);
          box-shadow: 0 0 0 3px
            rgb(255 237 213);
        }

        .form-input:disabled {
          cursor: not-allowed;
          background: rgb(248 250 252);
          color: rgb(148 163 184);
        }
      `}</style>
    </div>
  );
}


function FormSection({
  title,
  icon: Icon,
  children,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
          <Icon size={22} />
        </div>

        <h2 className="text-lg font-bold text-slate-900">
          {title}
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}


function FormField({
  label,
  required = false,
  children,
}) {
  return (
    <div>
      <FormLabel required={required}>
        {label}
      </FormLabel>

      {children}
    </div>
  );
}


function FormLabel({
  children,
  required = false,
}) {
  return (
    <label className="mb-2 block text-sm font-semibold text-slate-700">
      {children}

      {required && (
        <span className="ml-1 text-red-500">
          *
        </span>
      )}
    </label>
  );
}


function FieldError({ value }) {
  if (!value) {
    return null;
  }

  const message = Array.isArray(value)
    ? value.join(" ")
    : String(value);

  return (
    <p className="mt-2 text-sm text-red-600">
      {message}
    </p>
  );
}
