"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bed,
  FileText,
  Heart,
  Pill,
  Send,
  Stethoscope,
  AlertCircle,
  Loader2,
  LogOut,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  getAdmissionDetail,
  getNursingObservations,
  getMedicationOrders,
} from "@/lib/api/ipd";
import toast from "react-hot-toast";

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function getStatusBadge(status) {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800",
    admitted: "bg-green-100 text-green-800",
    transferred: "bg-blue-100 text-blue-800",
    discharged: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export default function AdmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const admissionId = params.id;

  const [admission, setAdmission] = useState(null);
  const [observations, setObservations] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadData();
  }, [admissionId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [admissionData, obsData, medData] = await Promise.all([
        getAdmissionDetail(admissionId),
        getNursingObservations(admissionId),
        getMedicationOrders(admissionId),
      ]);

      setAdmission(admissionData);
      setObservations(
        Array.isArray(obsData)
          ? obsData
          : obsData.results || obsData.observations || [],
      );
      setMedications(
        Array.isArray(medData)
          ? medData
          : medData.results || medData.medication_orders || [],
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load admission details",
      );
    } finally {
      setLoading(false);
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/ipd/admissions"
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Admissions
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">
              {admission.admission_number}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(admission.status)}`}
            >
              {admission.status.charAt(0).toUpperCase() +
                admission.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 justify-end">
          {admission.status === "pending" && (
            <Link href={`/ipd/admissions/${admissionId}/admit`}>
              <button className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                <Bed size={18} />
                Admit Patient
              </button>
            </Link>
          )}
          {(admission.status === "admitted" ||
            admission.status === "transferred") && (
            <>
              <Link href={`/ipd/admissions/${admissionId}/transfer`}>
                <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                  <Send size={18} />
                  Transfer
                </button>
              </Link>
              <Link href={`/ipd/admissions/${admissionId}/discharge`}>
                <button className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700">
                  <LogOut size={18} />
                  Discharge
                </button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Patient & Admission Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Stethoscope size={18} />
            Patient Information
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600">Name</p>
              <p className="font-medium text-gray-900">
                {admission.patient?.full_name}
              </p>
            </div>
            <div>
              <p className="text-gray-600">MRN</p>
              <p className="font-medium text-gray-900">
                {admission.patient?.mrn}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Age / Gender</p>
              <p className="font-medium text-gray-900">
                {admission.patient?.age || "—"} years /{" "}
                {admission.patient?.gender || "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Blood Group</p>
              <p className="font-medium text-gray-900">
                {admission.patient?.blood_group || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bed size={18} />
            Admission Details
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600">Admission Type</p>
              <p className="font-medium text-gray-900 capitalize">
                {admission.admission_type}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Admitted By</p>
              <p className="font-medium text-gray-900">
                {admission.admitting_doctor?.user?.first_name}{" "}
                {admission.admitting_doctor?.user?.last_name}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Current Bed</p>
              <p className="font-medium text-gray-900">
                {admission.bed
                  ? `${admission.ward?.name} - ${admission.room?.name} - ${admission.bed?.bed_number}`
                  : "Not assigned"}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Admitted At</p>
              <p className="font-medium text-gray-900">
                {formatDate(admission.admitted_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Info */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          Clinical Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-2">Provisional Diagnosis</p>
            <p className="text-gray-900">
              {admission.provisional_diagnosis || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Reason for Admission</p>
            <p className="text-gray-900">
              {admission.reason_for_admission || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Presenting Complaint</p>
            <p className="text-gray-900">
              {admission.presenting_complaint || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Expected Discharge Date
            </p>
            <p className="text-gray-900">
              {formatDate(admission.expected_discharge_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-lg border bg-white">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("observations")}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === "observations"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Heart className="inline mr-2" size={18} />
            Observations ({observations.length})
          </button>
          <button
            onClick={() => setActiveTab("medications")}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === "medications"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Pill className="inline mr-2" size={18} />
            Medications ({medications.length})
          </button>
        </div>

        {/* Observations Tab */}
        {activeTab === "observations" && (
          <div className="p-6">
            {observations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Heart size={32} className="mx-auto mb-2 opacity-50" />
                <p>No observations recorded</p>
                <Link href={`/ipd/admissions/${admissionId}/observations`}>
                  <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
                    Record Observations
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {observations.map((obs, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <p className="font-medium text-gray-900">
                        {formatDate(obs.recorded_at)}
                      </p>
                      <p className="text-sm text-gray-600">
                        by {obs.recorded_by?.user?.first_name}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {obs.temperature && (
                        <div>
                          <p className="text-gray-600">Temperature</p>
                          <p className="font-medium">{obs.temperature}°C</p>
                        </div>
                      )}
                      {obs.blood_pressure && (
                        <div>
                          <p className="text-gray-600">BP</p>
                          <p className="font-medium">{obs.blood_pressure}</p>
                        </div>
                      )}
                      {obs.heart_rate && (
                        <div>
                          <p className="text-gray-600">Heart Rate</p>
                          <p className="font-medium">{obs.heart_rate} bpm</p>
                        </div>
                      )}
                      {obs.respiratory_rate && (
                        <div>
                          <p className="text-gray-600">RR</p>
                          <p className="font-medium">{obs.respiratory_rate}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Medications Tab */}
        {activeTab === "medications" && (
          <div className="p-6">
            {medications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Pill size={32} className="mx-auto mb-2 opacity-50" />
                <p>No medications prescribed</p>
                <Link href={`/ipd/admissions/${admissionId}/medications`}>
                  <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
                    Add Medication Order
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {medications.map((med, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-gray-900">
                        {med.medicine?.name}
                      </p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          med.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {med.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {med.dose} {med.unit} - {med.frequency}
                    </p>
                    <p className="text-sm text-gray-600">
                      Route: {med.route || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
