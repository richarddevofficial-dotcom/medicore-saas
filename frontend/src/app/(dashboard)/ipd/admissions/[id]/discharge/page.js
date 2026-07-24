"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  LogOut,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { getAdmissionDetail, dischargePatient } from "@/lib/api/ipd";
import toast from "react-hot-toast";

export default function DischargePage() {
  const params = useParams();
  const router = useRouter();
  const admissionId = params.id;

  const [admission, setAdmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    discharge_summary: "",
    discharge_diagnosis: "",
    treatment_given: "",
    medications_prescribed: "",
    follow_up_instructions: "",
    next_bed_status: "cleaning",
    bed_release_reason: "Patient discharged",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadData();
  }, [admissionId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const admissionData = await getAdmissionDetail(admissionId);

      if (!["admitted", "transferred"].includes(admissionData.status)) {
        setError("Only admitted patients can be discharged");
        return;
      }

      setAdmission(admissionData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load admission details",
      );
    } finally {
      setLoading(false);
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
    if (!formData.discharge_summary)
      newErrors.discharge_summary = "Discharge summary is required";
    if (!formData.discharge_diagnosis)
      newErrors.discharge_diagnosis = "Discharge diagnosis is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      await dischargePatient(admissionId, formData);
      toast.success("Patient discharged successfully");
      router.push(`/ipd/admissions/${admissionId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to discharge patient",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error || !admission) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 text-red-600" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">
              Unable to load admission
            </h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/ipd/admissions/${admissionId}`}
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Admission
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <LogOut size={24} />
          Discharge Patient
        </h1>
        <p className="text-gray-600 mb-6">
          {admission.patient?.full_name} - {admission.admission_number}
        </p>

        {/* Warning */}
        <div className="mb-8 rounded-lg bg-orange-50 border border-orange-200 p-4">
          <p className="text-sm text-orange-800">
            <span className="font-semibold">⚠️ Important:</span> This action
            will mark the admission as discharged and release the patient bed.
            Please ensure all information is complete.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Discharge Summary */}
          <div>
            <label
              htmlFor="discharge_summary"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Discharge Summary *
            </label>
            <textarea
              id="discharge_summary"
              name="discharge_summary"
              value={formData.discharge_summary}
              onChange={handleChange}
              placeholder="Summary of patient's hospital stay..."
              rows="4"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.discharge_summary ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.discharge_summary && (
              <p className="text-red-600 text-sm mt-1">
                {errors.discharge_summary}
              </p>
            )}
          </div>

          {/* Discharge Diagnosis */}
          <div>
            <label
              htmlFor="discharge_diagnosis"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Final Diagnosis *
            </label>
            <textarea
              id="discharge_diagnosis"
              name="discharge_diagnosis"
              value={formData.discharge_diagnosis}
              onChange={handleChange}
              placeholder="Final diagnosis at discharge..."
              rows="3"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.discharge_diagnosis
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            />
            {errors.discharge_diagnosis && (
              <p className="text-red-600 text-sm mt-1">
                {errors.discharge_diagnosis}
              </p>
            )}
          </div>

          {/* Treatment Given */}
          <div>
            <label
              htmlFor="treatment_given"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Treatment Given
            </label>
            <textarea
              id="treatment_given"
              name="treatment_given"
              value={formData.treatment_given}
              onChange={handleChange}
              placeholder="Procedures, surgeries, therapies performed..."
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Medications Prescribed */}
          <div>
            <label
              htmlFor="medications_prescribed"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Medications at Discharge
            </label>
            <textarea
              id="medications_prescribed"
              name="medications_prescribed"
              value={formData.medications_prescribed}
              onChange={handleChange}
              placeholder="List of medications prescribed at discharge..."
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Follow-up Instructions */}
          <div>
            <label
              htmlFor="follow_up_instructions"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Follow-up Instructions
            </label>
            <textarea
              id="follow_up_instructions"
              name="follow_up_instructions"
              value={formData.follow_up_instructions}
              onChange={handleChange}
              placeholder="Post-discharge care instructions, lifestyle modifications, when to follow-up..."
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Bed Status */}
          <div>
            <label
              htmlFor="next_bed_status"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Next Bed Status
            </label>
            <select
              id="next_bed_status"
              name="next_bed_status"
              value={formData.next_bed_status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cleaning">Cleaning & Sanitization</option>
              <option value="maintenance">Maintenance Required</option>
              <option value="available">Available for New Patient</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Status to set for the bed after discharge
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-6 border-t">
            <Link href={`/ipd/admissions/${admissionId}`}>
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
              className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Discharging...
                </>
              ) : (
                <>
                  <LogOut size={18} />
                  Discharge Patient
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
