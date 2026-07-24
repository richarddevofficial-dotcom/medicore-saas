"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pill,
  Plus,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  getAdmissionDetail,
  getIpdLookups,
  getMedicationOrders,
  createMedicationOrder,
  administerMedication,
} from "@/lib/api/ipd";
import toast from "react-hot-toast";

export default function MedicationsPage() {
  const params = useParams();
  const admissionId = params.id;

  const [admission, setAdmission] = useState(null);
  const [medications, setMedications] = useState([]);
  const [lookups, setLookups] = useState({ medicines: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    medicine: "",
    dose: "",
    unit: "",
    frequency: "",
    route: "oral",
    instructions: "",
  });

  const [errors, setErrors] = useState({});
  const [administering, setAdministering] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, [admissionId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [admissionData, lookupsData, medsData] = await Promise.all([
        getAdmissionDetail(admissionId),
        getIpdLookups(),
        getMedicationOrders(admissionId),
      ]);

      setAdmission(admissionData);
      setLookups(lookupsData);
      setMedications(
        Array.isArray(medsData)
          ? medsData
          : medsData.results || medsData.medication_orders || [],
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

    const newErrors = {};
    if (!formData.medicine) newErrors.medicine = "Medicine is required";
    if (!formData.dose) newErrors.dose = "Dose is required";
    if (!formData.unit) newErrors.unit = "Unit is required";
    if (!formData.frequency) newErrors.frequency = "Frequency is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      const result = await createMedicationOrder(admissionId, formData);
      toast.success("Medication order created successfully");
      setMedications((prev) => [result, ...prev]);
      setFormData({
        medicine: "",
        dose: "",
        unit: "",
        frequency: "",
        route: "oral",
        instructions: "",
      });
      setShowForm(false);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to create medication order",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminister(medicationId) {
    try {
      setAdministering(medicationId);
      const result = await administerMedication(medicationId, {
        administered_at: new Date().toISOString(),
      });
      toast.success("Medication administration recorded");

      // Update medication in list
      setMedications((prev) =>
        prev.map((med) => (med.id === medicationId ? result : med)),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to administer medication",
      );
    } finally {
      setAdministering(null);
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Pill size={24} />
            Medication Management
          </h1>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Medication
            </button>
          )}
        </div>

        <p className="text-gray-600 mb-6">
          {admission.patient?.full_name} - {admission.admission_number}
        </p>

        {/* Add Medication Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 pb-8 border-b">
            <h3 className="font-semibold text-gray-900 mb-4">
              Prescribe New Medication
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Medicine */}
              <div>
                <label
                  htmlFor="medicine"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Medicine *
                </label>
                <select
                  id="medicine"
                  name="medicine"
                  value={formData.medicine}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.medicine ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  <option value="">Select medicine</option>
                  {lookups.medicines?.map((med) => (
                    <option key={med.id} value={med.id}>
                      {med.name} ({med.strength})
                    </option>
                  ))}
                </select>
                {errors.medicine && (
                  <p className="text-red-600 text-sm mt-1">{errors.medicine}</p>
                )}
              </div>

              {/* Route */}
              <div>
                <label
                  htmlFor="route"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Route of Administration
                </label>
                <select
                  id="route"
                  name="route"
                  value={formData.route}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="oral">Oral</option>
                  <option value="injection">Injection</option>
                  <option value="intravenous">Intravenous (IV)</option>
                  <option value="topical">Topical</option>
                  <option value="inhalation">Inhalation</option>
                </select>
              </div>

              {/* Dose */}
              <div>
                <label
                  htmlFor="dose"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Dose *
                </label>
                <input
                  type="number"
                  id="dose"
                  name="dose"
                  value={formData.dose}
                  onChange={handleChange}
                  placeholder="e.g., 500"
                  step="0.01"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.dose ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {errors.dose && (
                  <p className="text-red-600 text-sm mt-1">{errors.dose}</p>
                )}
              </div>

              {/* Unit */}
              <div>
                <label
                  htmlFor="unit"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Unit *
                </label>
                <select
                  id="unit"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.unit ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  <option value="">Select unit</option>
                  <option value="mg">mg (Milligram)</option>
                  <option value="g">g (Gram)</option>
                  <option value="mcg">mcg (Microgram)</option>
                  <option value="ml">ml (Milliliter)</option>
                  <option value="unit">Unit</option>
                  <option value="IU">IU (International Unit)</option>
                </select>
                {errors.unit && (
                  <p className="text-red-600 text-sm mt-1">{errors.unit}</p>
                )}
              </div>

              {/* Frequency */}
              <div>
                <label
                  htmlFor="frequency"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Frequency *
                </label>
                <select
                  id="frequency"
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.frequency ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  <option value="">Select frequency</option>
                  <option value="Once daily">Once daily</option>
                  <option value="Twice daily">Twice daily</option>
                  <option value="Three times daily">Three times daily</option>
                  <option value="Four times daily">Four times daily</option>
                  <option value="Every 4 hours">Every 4 hours</option>
                  <option value="Every 6 hours">Every 6 hours</option>
                  <option value="Every 8 hours">Every 8 hours</option>
                  <option value="Every 12 hours">Every 12 hours</option>
                  <option value="As needed">As needed</option>
                </select>
                {errors.frequency && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.frequency}
                  </p>
                )}
              </div>

              {/* Instructions */}
              <div className="md:col-span-2">
                <label
                  htmlFor="instructions"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Special Instructions
                </label>
                <textarea
                  id="instructions"
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleChange}
                  placeholder="e.g., Take with food, Avoid dairy products..."
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Add Medication
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Medications List */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">
            Prescribed Medications ({medications.length})
          </h3>

          {medications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Pill size={32} className="mx-auto mb-2 opacity-50" />
              <p>No medications prescribed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {medications.map((med) => (
                <div
                  key={med.id}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {med.medicine?.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {med.dose} {med.unit} - {med.frequency}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        med.status === "active"
                          ? "bg-green-100 text-green-800"
                          : med.status === "completed"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {med.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <span>Route: {med.route}</span>
                    {med.instructions && (
                      <span className="italic">{med.instructions}</span>
                    )}
                  </div>

                  {med.status === "active" && (
                    <button
                      onClick={() => handleAdminister(med.id)}
                      disabled={administering === med.id}
                      className="w-full px-4 py-2 border border-green-600 text-green-600 rounded-lg font-medium hover:bg-green-50 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {administering === med.id ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Recording...
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          Record Administration
                        </>
                      )}
                    </button>
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
