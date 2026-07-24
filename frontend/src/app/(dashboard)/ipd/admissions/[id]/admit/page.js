"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bed, AlertCircle, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { getAdmissionDetail, getIpdLookups, admitPatient } from "@/lib/api/ipd";
import toast from "react-hot-toast";

export default function AdmitPatientPage() {
  const params = useParams();
  const router = useRouter();
  const admissionId = params.id;

  const [admission, setAdmission] = useState(null);
  const [lookups, setLookups] = useState({ wards: [], rooms: [], beds: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    ward: "",
    room: "",
    bed: "",
  });

  const [filteredRooms, setFilteredRooms] = useState([]);
  const [filteredBeds, setFilteredBeds] = useState([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, [admissionId]);

  useEffect(() => {
    if (formData.ward && lookups.rooms) {
      const rooms = lookups.rooms.filter(
        (r) => r.ward.id === parseInt(formData.ward),
      );
      setFilteredRooms(rooms);
      setFormData((prev) => ({ ...prev, room: "", bed: "" }));
      setFilteredBeds([]);
    }
  }, [formData.ward, lookups.rooms]);

  useEffect(() => {
    if (formData.room && lookups.beds) {
      const beds = lookups.beds.filter(
        (b) => b.room.id === parseInt(formData.room),
      );
      setFilteredBeds(beds);
      setFormData((prev) => ({ ...prev, bed: "" }));
    }
  }, [formData.room, lookups.beds]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [admissionData, lookupsData] = await Promise.all([
        getAdmissionDetail(admissionId),
        getIpdLookups(),
      ]);

      if (admissionData.status !== "pending") {
        setError("Only pending admissions can be admitted");
        return;
      }

      setAdmission(admissionData);
      setLookups(lookupsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load admission details",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.ward || !formData.room || !formData.bed) {
      toast.error("Please select ward, room, and bed");
      return;
    }

    try {
      setSubmitting(true);
      await admitPatient(admissionId, {
        bed: parseInt(formData.bed),
      });
      toast.success("Patient admitted successfully");
      router.push(`/ipd/admissions/${admissionId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to admit patient",
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
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/ipd/admissions/${admissionId}`}
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Admission
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Bed size={24} />
          Admit Patient
        </h1>

        {/* Patient Info */}
        <div className="mb-8 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-600">
            <span className="font-semibold">Patient:</span>{" "}
            {admission.patient?.full_name} ({admission.patient?.mrn})
          </p>
          <p className="text-sm text-blue-600 mt-1">
            <span className="font-semibold">Admission #:</span>{" "}
            {admission.admission_number}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Ward Selection */}
          <div>
            <label
              htmlFor="ward"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Ward *
            </label>
            <select
              id="ward"
              value={formData.ward}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, ward: e.target.value }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a ward</option>
              {lookups.wards?.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room Selection */}
          <div>
            <label
              htmlFor="room"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Room *
            </label>
            <select
              id="room"
              value={formData.room}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, room: e.target.value }))
              }
              disabled={!formData.ward}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            >
              <option value="">
                {formData.ward ? "Select a room" : "Select a ward first"}
              </option>
              {filteredRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          {/* Bed Selection */}
          <div>
            <label
              htmlFor="bed"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Bed *
            </label>
            <select
              id="bed"
              value={formData.bed}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, bed: e.target.value }))
              }
              disabled={!formData.room}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            >
              <option value="">
                {formData.room ? "Select a bed" : "Select a room first"}
              </option>
              {filteredBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.bed_number} {bed.bed_type ? `(${bed.bed_type})` : ""}
                  {bed.status === "occupied" ? " - OCCUPIED" : ""}
                </option>
              ))}
            </select>
            {filteredBeds.some((b) => b.status === "occupied") && (
              <p className="text-xs text-gray-500 mt-1">
                Occupied beds are shown for reference only
              </p>
            )}
          </div>

          {/* Admission Notes */}
          <div>
            <label
              htmlFor="admission_notes"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Additional Notes
            </label>
            <textarea
              id="admission_notes"
              value={admission.admission_notes || ""}
              disabled
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
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
              disabled={submitting || !formData.bed}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Admitting...
                </>
              ) : (
                <>
                  <Bed size={18} />
                  Admit Patient
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
