"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, AlertCircle, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  getAdmissionDetail,
  getNursingObservations,
  createNursingObservation,
} from "@/lib/api/ipd";
import toast from "react-hot-toast";

export default function NursingObservationsPage() {
  const params = useParams();
  const router = useRouter();
  const admissionId = params.id;

  const [admission, setAdmission] = useState(null);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    temperature: "",
    blood_pressure: "",
    heart_rate: "",
    respiratory_rate: "",
    oxygen_saturation: "",
    notes: "",
  });

  const [errors, setErrors] = useState({});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, [admissionId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [admissionData, obsData] = await Promise.all([
        getAdmissionDetail(admissionId),
        getNursingObservations(admissionId),
      ]);

      setAdmission(admissionData);
      setObservations(
        Array.isArray(obsData)
          ? obsData
          : obsData.results || obsData.observations || [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
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
    if (!formData.temperature)
      newErrors.temperature = "Temperature is required";
    if (!formData.blood_pressure) newErrors.blood_pressure = "BP is required";
    if (!formData.heart_rate) newErrors.heart_rate = "Heart rate is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      const result = await createNursingObservation(admissionId, formData);
      toast.success("Observation recorded successfully");

      // Add to observations list
      setObservations((prev) => [result, ...prev]);

      // Reset form
      setFormData({
        temperature: "",
        blood_pressure: "",
        heart_rate: "",
        respiratory_rate: "",
        oxygen_saturation: "",
        notes: "",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to record observation",
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
    <div className="space-y-6">
      <Link
        href={`/ipd/admissions/${admissionId}`}
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Admission
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Heart size={24} />
          Nursing Observations
        </h1>
        <p className="text-gray-600 mb-6">
          {admission.patient?.full_name} - {admission.admission_number}
        </p>

        <form onSubmit={handleSubmit} className="mb-8 pb-8 border-b">
          <h3 className="font-semibold text-gray-900 mb-4">
            Record New Observation
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Temperature */}
            <div>
              <label
                htmlFor="temperature"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Temperature (°C) *
              </label>
              <input
                type="number"
                id="temperature"
                name="temperature"
                value={formData.temperature}
                onChange={handleChange}
                placeholder="36.5"
                step="0.1"
                min="35"
                max="42"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.temperature ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.temperature && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.temperature}
                </p>
              )}
            </div>

            {/* Blood Pressure */}
            <div>
              <label
                htmlFor="blood_pressure"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Blood Pressure (mmHg) *
              </label>
              <input
                type="text"
                id="blood_pressure"
                name="blood_pressure"
                value={formData.blood_pressure}
                onChange={handleChange}
                placeholder="120/80"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.blood_pressure ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.blood_pressure && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.blood_pressure}
                </p>
              )}
            </div>

            {/* Heart Rate */}
            <div>
              <label
                htmlFor="heart_rate"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Heart Rate (bpm) *
              </label>
              <input
                type="number"
                id="heart_rate"
                name="heart_rate"
                value={formData.heart_rate}
                onChange={handleChange}
                placeholder="72"
                min="30"
                max="200"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.heart_rate ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.heart_rate && (
                <p className="text-red-600 text-sm mt-1">{errors.heart_rate}</p>
              )}
            </div>

            {/* Respiratory Rate */}
            <div>
              <label
                htmlFor="respiratory_rate"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Respiratory Rate (breaths/min)
              </label>
              <input
                type="number"
                id="respiratory_rate"
                name="respiratory_rate"
                value={formData.respiratory_rate}
                onChange={handleChange}
                placeholder="16"
                min="10"
                max="50"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Oxygen Saturation */}
            <div>
              <label
                htmlFor="oxygen_saturation"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Oxygen Saturation (%) / SPO2
              </label>
              <input
                type="number"
                id="oxygen_saturation"
                name="oxygen_saturation"
                value={formData.oxygen_saturation}
                onChange={handleChange}
                placeholder="98"
                min="80"
                max="100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional observations..."
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Heart size={18} />
                Record Observation
              </>
            )}
          </button>
        </form>

        {/* Previous Observations */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">
            Previous Observations ({observations.length})
          </h3>

          {observations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Heart size={32} className="mx-auto mb-2 opacity-50" />
              <p>No observations recorded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {observations.map((obs, idx) => (
                <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-medium text-gray-900">
                      {new Date(obs.recorded_at).toLocaleString("en-GB")}
                    </p>
                    <p className="text-sm text-gray-600">
                      by {obs.recorded_by?.user?.first_name || "System"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Temperature</p>
                      <p className="font-semibold text-gray-900">
                        {obs.temperature}°C
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">BP</p>
                      <p className="font-semibold text-gray-900">
                        {obs.blood_pressure}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Heart Rate</p>
                      <p className="font-semibold text-gray-900">
                        {obs.heart_rate} bpm
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">RR</p>
                      <p className="font-semibold text-gray-900">
                        {obs.respiratory_rate || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">SPO2</p>
                      <p className="font-semibold text-gray-900">
                        {obs.oxygen_saturation
                          ? `${obs.oxygen_saturation}%`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {obs.notes && (
                    <p className="text-sm text-gray-600 mt-3 pt-3 border-t">
                      {obs.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
