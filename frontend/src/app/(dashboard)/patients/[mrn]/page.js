"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { usePatient } from "@/hooks/usePatients";
import { ArrowLeft } from "lucide-react";
import { formatDate, calculateAge } from "@/lib/utils";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Printer } from "lucide-react";

export default function PatientDetailPage({ params }) {
  const router = useRouter();
  const { data: patient, isLoading, isError } = usePatient(params.mrn);
  const [reactivating, setReactivating] = useState(false);

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      await apiClient.post(`/patients/${patient.mrn}/reactivate/`);
      toast.success("Patient reactivated for new visit!");
      router.push("/reception");
    } catch (err) {
      toast.error("Failed to reactivate");
    } finally {
      setReactivating(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !patient) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h2 className="text-xl font-bold text-gray-900">Patient not found</h2>
          <Button className="mt-4" onClick={() => router.push("/patients")}>
            Back to Patients
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              onClick={() => router.push("/patients")}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {patient.first_name} {patient.last_name}
              </h1>
              <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
            </div>
          </div>

          {/* Status & Reactivate Button */}
          <div className="flex items-center gap-3">
            <Badge variant={patient.is_active ? "success" : "warning"}>
              {patient.status_display || patient.status}
            </Badge>

            {patient.status === "treated" && (
              <Button onClick={handleReactivate} isLoading={reactivating}>
                🔄 Re-activate Patient
              </Button>
            )}
          </div>
        </div>
        {/* Personal Info */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Personal Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoItem
              label="Full Name"
              value={`${patient.first_name} ${patient.last_name}`}
            />
            <InfoItem
              label="Date of Birth"
              value={formatDate(patient.date_of_birth)}
            />
            <InfoItem
              label="Age"
              value={`${calculateAge(patient.date_of_birth)} years`}
            />
            <InfoItem
              label="Gender"
              value={
                patient.gender === "M"
                  ? "Male"
                  : patient.gender === "F"
                    ? "Female"
                    : "Other"
              }
            />
            <InfoItem
              label="Blood Group"
              value={patient.blood_group || "Not specified"}
            />
            <InfoItem label="MRN" value={patient.mrn} />
          </div>
        </Card>
        {/* Contact Info */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Contact Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoItem label="Phone" value={patient.phone} />
            <InfoItem
              label="Alternate Phone"
              value={patient.alternate_phone || "N/A"}
            />
            <InfoItem label="Email" value={patient.email || "N/A"} />
            <InfoItem label="Address" value={patient.address || "N/A"} />
          </div>
        </Card>
        {/* Emergency Contact */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Emergency Contact
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoItem
              label="Name"
              value={patient.emergency_contact_name || "N/A"}
            />
            <InfoItem
              label="Phone"
              value={patient.emergency_contact_phone || "N/A"}
            />
            <InfoItem
              label="Relation"
              value={patient.emergency_contact_relation || "N/A"}
            />
          </div>
        </Card>
        {/* Medical Info */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Medical Information
          </h2>
          <InfoItem label="Allergies" value={patient.allergies || "None"} />
          <InfoItem
            label="Chronic Conditions"
            value={patient.chronic_conditions || "None"}
          />
        </Card>
        {/* QR Code Section */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              📱 Patient QR Code
            </h2>
            <Button
              size="sm"
              variant="outline"
              icon={Printer}
              onClick={() => {
                const printWindow = window.open(
                  "",
                  "_blank",
                  "width=400,height=500",
                );
                printWindow.document.write(`
          <html><head><title>Patient QR - ${patient.mrn}</title>
          <style>
            body{font-family:Arial;text-align:center;padding:30px}
            .name{font-size:20px;font-weight:bold;color:#1E3A5F}
            .mrn{font-size:16px;color:#F97316;font-weight:bold;margin:10px 0}
            .info{font-size:12px;color:#666;margin:5px 0}
          </style></head><body>
          <h2>MediCore Patient QR</h2>
          <div id="qrcode"></div>
          <p class="name">${patient.first_name} ${patient.last_name}</p>
          <p class="mrn">${patient.mrn}</p>
          <p class="info">Scan for medical records</p>
          <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
          <script>new QRCode(document.getElementById("qrcode"),{text:"${window.location.origin}/patients/${patient.mrn}",width:200,height:200});</script>
          </body></html>
        `);
                printWindow.document.close();
                setTimeout(() => printWindow.print(), 500);
              }}
            >
              Print QR
            </Button>
          </div>
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
              <QRCodeSVG
                value={`${window.location.origin}/patients/${patient.mrn}`}
                size={150}
                level="M"
                fgColor="#1E3A5F"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Scan to view patient records
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-1">{value || "N/A"}</p>
    </div>
  );
}
