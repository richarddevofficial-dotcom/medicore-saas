"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import {
  ArrowLeft,
  Search,
  User,
  Stethoscope,
  FlaskConical,
  Pill,
  Receipt,
  Printer,
} from "lucide-react";
import { printInvoice } from "@/lib/printInvoice";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function BillingSummary() {
  const router = useRouter();
  const [searchMRN, setSearchMRN] = useState("");
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchMRN.trim()) return toast.error("Enter MRN");
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await apiClient.get(
        `/patients/${searchMRN}/billing_summary/`,
      );
      setPatient(data);
    } catch (err) {
      setPatient(null);
      toast.error("Patient not found");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => router.push("/billing")}
          >
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Patient Billing Summary</h1>
            <p className="text-sm text-gray-500">
              View complete treatment details before billing
            </p>
          </div>
        </div>

        {/* Search */}
        <Card>
          <div className="flex gap-3">
            <Input
              placeholder="Enter Patient MRN..."
              value={searchMRN}
              onChange={(e) => setSearchMRN(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button icon={Search} onClick={handleSearch} isLoading={loading}>
              Search
            </Button>
          </div>
        </Card>

        {loading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {patient && (
          <div className="space-y-4">
            {/* Patient Info */}
            <Card className="border-l-4 border-blue-500">
              <div className="flex items-center gap-3 mb-4">
                <User className="h-6 w-6 text-blue-600" />
                <h2 className="text-lg font-bold">Patient Information</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="font-semibold">
                    {patient.patient?.first_name} {patient.patient?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">MRN</p>
                  <p className="font-mono">{patient.patient?.mrn}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Doctor</p>
                  <p>{patient.consultation?.doctor || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <Badge
                    variant={
                      patient.summary?.is_ready_for_billing
                        ? "success"
                        : "warning"
                    }
                  >
                    {patient.patient?.status_display}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Consultation */}
            <Card className="border-l-4 border-green-500">
              <div className="flex items-center gap-3 mb-4">
                <Stethoscope className="h-6 w-6 text-green-600" />
                <h2 className="text-lg font-bold">Consultation</h2>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Doctor</span>
                  <span className="font-medium">
                    {patient.consultation?.doctor || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Diagnosis</span>
                  <span className="font-medium">
                    {patient.consultation?.diagnosis || "Not recorded"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Treatment Plan</span>
                  <span className="font-medium">
                    {patient.consultation?.treatment_plan || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-semibold">
                    Consultation Fee
                  </span>
                  <span className="font-bold text-green-600">
                    ₹{patient.consultation?.fee || 500}
                  </span>
                </div>
              </div>
            </Card>

            {/* Lab Tests */}
            <Card className="border-l-4 border-purple-500">
              <div className="flex items-center gap-3 mb-4">
                <FlaskConical className="h-6 w-6 text-purple-600" />
                <h2 className="text-lg font-bold">Laboratory</h2>
              </div>
              {patient.lab?.requested ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Tests Requested</p>
                    <p className="font-medium">{patient.lab.requested}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Results</p>
                    <p className="font-medium whitespace-pre-wrap">
                      {patient.lab.results || "Pending"}
                    </p>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-semibold">Lab Fee</span>
                    <span className="font-bold text-purple-600">
                      ₹{patient.lab?.fee || 300}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No lab tests requested</p>
              )}
            </Card>

            {/* Prescription/Medicine */}
            <Card className="border-l-4 border-orange-500">
              <div className="flex items-center gap-3 mb-4">
                <Pill className="h-6 w-6 text-orange-600" />
                <h2 className="text-lg font-bold">Prescription & Medicine</h2>
              </div>
              {patient.medicine?.prescription ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Prescription</p>
                    <p className="font-medium whitespace-pre-wrap">
                      {patient.medicine.prescription}
                    </p>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-semibold">Medicine Fee</span>
                    <span className="font-bold text-orange-600">
                      ₹{patient.medicine?.fee || 200}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No prescription yet</p>
              )}
            </Card>

            {/* Total Summary */}
            <Card className="border-2 border-orange-500 bg-orange-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Total Amount</h2>
                  <p className="text-sm text-gray-500">
                    Consultation + Lab + Medicine
                  </p>
                </div>
                <p className="text-3xl font-bold text-orange-600">
                  ₹{patient.summary?.total || 1000}
                </p>
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  icon={Printer}
                  variant="outline"
                  onClick={() =>
                    printInvoice({
                      bill: `BILL-${patient.patient?.mrn}`,
                      patient: `${patient.patient?.first_name} ${patient.patient?.last_name}`,
                      consult: patient.consultation?.fee || 500,
                      lab: patient.lab?.fee || 300,
                      medicine: patient.medicine?.fee || 200,
                      total: patient.summary?.total || 1000,
                      status: "pending",
                      date: new Date().toISOString().split("T")[0],
                    })
                  }
                >
                  Print Preview
                </Button>
                <Button icon={Receipt} onClick={() => router.push("/billing")}>
                  Go to Billing
                </Button>
              </div>
            </Card>
          </div>
        )}

        {searched && !patient && !loading && (
          <Card>
            <div className="text-center py-8 text-gray-500">
              No patient found with that MRN
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
