"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, AlertCircle, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  getAdmissionDetail,
  getIpdLookups,
  transferPatient,
} from "@/lib/api/ipd";
import toast from "react-hot-toast";

export default function TransferPatientPage() {
  const params = useParams();
  const router = useRouter();
  const admissionId = params.id;

  const [admission, setAdmission] = useState(null);
  const [lookups, setLookups] = useState({ wards: [], rooms: [], beds: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    to_ward: "",
    to_room: "",
    to_bed: "",
    reason: "",
  });

  const [filteredRooms, setFilteredRooms] = useState([]);
  const [filteredBeds, setFilteredBeds] = useState([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, [admissionId]);

  useEffect(() => {
    if (formData.to_ward && lookups.rooms) {
      const rooms = lookups.rooms.filter(
        (r) => r.ward.id === parseInt(formData.to_ward),
      );
      setFilteredRooms(rooms);
      setFormData((prev) => ({ ...prev, to_room: "", to_bed: "" }));
      setFilteredBeds([]);
    }
  }, [formData.to_ward, lookups.rooms]);

  useEffect(() => {
    if (formData.to_room && lookups.beds) {
      const beds = lookups.beds.filter(
        (b) =>
          b.room.id === parseInt(formData.to_room) && b.status === "available",
      );
      setFilteredBeds(beds);
      setFormData((prev) => ({ ...prev, to_bed: "" }));
    }
  }, [formData.to_room, lookups.beds]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [admissionData, lookupsData] = await Promise.all([
        getAdmissionDetail(admissionId),
        getIpdLookups(),
      ]);

      if (!["admitted", "transferred"].includes(admissionData.status)) {
        setError("Only admitted patients can be transferred");
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

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.to_bed || !formData.reason) {
      toast.error("Please select a bed and provide transfer reason");
      return;
    }

    try {
      setSubmitting(true);
      await transferPatient(admissionId, {
        to_bed: parseInt(formData.to_bed),
        reason: formData.reason,
      });
      toast.success("Patient transferred successfully");
      router.push(`/ipd/admissions/${admissionId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to transfer patient",
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
          <Send size={24} />
          Transfer Patient
        </h1>

        {/* Current Location */}
        <div className="mb-8 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-600">
            <span className="font-semibold">Patient:</span>{" "}
            {admission.patient?.full_name}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            <span className="font-semibold">Current Bed:</span>{" "}
            {admission.bed
              ? `${admission.ward?.name} - ${admission.room?.name} - ${admission.bed?.bed_number}`
              : "Not assigned"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transfer Reason */}
          <div>
            <label
              htmlFor="reason"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Reason for Transfer *
            </label>
            <select
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select reason</option>
              <option value="Patient request">Patient request</option>
              <option value="Medical requirement">Medical requirement</option>
              <option value="Better facilities needed">
                Better facilities needed
              </option>
              <option value="Bed unavailable">Current bed unavailable</option>
              <option value="Isolation required">Isolation required</option>
              <option value="Other">Other</option>
            </select>
            {!formData.reason && (
              <p className="text-gray-500 text-sm mt-1">* Required</p>
            )}
          </div>

          {/* New Ward */}
          <div>
            <label
              htmlFor="to_ward"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select New Ward *
            </label>
            <select
              id="to_ward"
              value={formData.to_ward}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, to_ward: e.target.value }))
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

          {/* New Room */}
          <div>
            <label
              htmlFor="to_room"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select Room *
            </label>
            <select
              id="to_room"
              value={formData.to_room}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, to_room: e.target.value }))
              }
              disabled={!formData.to_ward}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            >
              <option value="">
                {formData.to_ward ? "Select a room" : "Select a ward first"}
              </option>
              {filteredRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          {/* New Bed */}
          <div>
            <label
              htmlFor="to_bed"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select Bed *
            </label>
            <select
              id="to_bed"
              value={formData.to_bed}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, to_bed: e.target.value }))
              }
              disabled={!formData.to_room}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            >
              <option value="">
                {formData.to_room ? "Select a bed" : "Select a room first"}
              </option>
              {filteredBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.bed_number} {bed.bed_type ? `(${bed.bed_type})` : ""}
                </option>
              ))}
            </select>
            {filteredBeds.length === 0 && formData.to_room && (
              <p className="text-orange-600 text-sm mt-1">
                No available beds in this room
              </p>
            )}
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
              disabled={submitting || !formData.to_bed}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Transfer Patient
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
