"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import ReportGenerator from "@/components/reports/ReportGenerator";
import { QRCodeSVG } from "qrcode.react";
import {
  FlaskConical,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Play,
  FileText,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

const statusConfig = {
  lab_requested: {
    label: "Requested",
    color: "#F97316",
    bg: "#FFF7ED",
    variant: "warning",
  },
  lab_in_progress: {
    label: "In Progress",
    color: "#8B5CF6",
    bg: "#F5F3FF",
    variant: "info",
  },
  lab_completed: {
    label: "Completed",
    color: "#10B981",
    bg: "#ECFDF5",
    variant: "success",
  },
};

export default function LabDashboard() {
  const router = useRouter();
  const [labPatients, setLabPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [testResult, setTestResult] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const getWorkflowBadgeVariant = (patient, fallbackVariant = "info") => {
    const workflow = (patient.workflow_status || "").toLowerCase();
    if (workflow === "treated") return "success";
    if (workflow === "awaiting payment") return "warning";
    if (workflow === "awaiting service") return "info";
    return fallbackVariant;
  };

  const fetchLabQueue = async () => {
    try {
      const { data } = await apiClient.get("/patients/lab_queue/");
      console.log("Lab data:", data); // Debug
      const patients = Array.isArray(data) ? data : data.results || [];
      setLabPatients(patients);
    } catch (err) {
      console.error("Lab error:", err);
      toast.error("Failed to load lab queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabQueue();
  }, []);

  const handleStartTest = async (patient) => {
    try {
      await apiClient.post(`/patients/${patient.mrn}/start_lab_test/`, {});
      toast.success("Test started!");
      fetchLabQueue();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Payment required before lab starts",
      );
    }
  };

  const handleSubmitResults = async () => {
    if (!testResult.trim()) return toast.error("Enter results");
    setIsSubmitting(true);
    try {
      await apiClient.post(
        `/patients/${selectedPatient.mrn}/submit_lab_results/`,
        { lab_test_results: testResult },
      );
      toast.success("Results submitted!");
      setShowResultModal(false);
      setSelectedPatient(null);
      setTestResult("");
      fetchLabQueue();
    } catch (err) {
      toast.error("Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = labPatients.filter(
    (p) =>
      `${p.first_name} ${p.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      p.mrn?.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const requested = labPatients.filter(
    (p) => p.status === "lab_requested",
  ).length;
  const inProgress = labPatients.filter(
    (p) => p.status === "lab_in_progress",
  ).length;
  const completed = labPatients.filter(
    (p) => p.status === "lab_completed",
  ).length;

  if (loading)
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Laboratory Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {labPatients.length} patients in queue
          </p>
        </div>

        <Card>
          <h3 className="font-semibold mb-3">📊 My Shift Report</h3>
          <ReportGenerator
            endpoint="/reports/lab/"
            title="Lab Technician Shift Report"
          />
        </Card>

        <div className="grid grid-cols-4 gap-4">
          <Card className="text-center">
            <FlaskConical className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{labPatients.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </Card>
          <Card className="text-center">
            <AlertCircle className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-600">{requested}</p>
            <p className="text-xs text-gray-500">Requested</p>
          </Card>
          <Card className="text-center">
            <Clock className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-purple-600">{inProgress}</p>
            <p className="text-xs text-gray-500">In Progress</p>
          </Card>
          <Card className="text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">{completed}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </Card>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              imageSrc="/images/empty-states/lab-empty.svg"
              imageAlt="No lab requests"
              title="No Lab Requests"
              description="Lab queue is empty. Waiting for doctor requests."
              titleClassName="text-xl font-semibold text-gray-900 mb-2"
              descriptionClassName="text-gray-500 mb-0"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((patient) => {
              const status =
                statusConfig[patient.status] || statusConfig.lab_requested;
              return (
                <Card
                  key={patient.mrn}
                  className="flex items-center justify-between flex-wrap gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: status.bg }}
                    >
                      <span
                        className="text-lg font-semibold"
                        style={{ color: status.color }}
                      >
                        {patient.first_name?.[0]}
                        {patient.last_name?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        MRN: {patient.mrn} • {patient.age} yrs
                      </p>
                      {patient.lab_test_requested && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                          <p className="text-xs font-medium">Tests:</p>
                          <p className="text-sm">
                            {patient.lab_test_requested}
                          </p>
                        </div>
                      )}
                      {patient.lab_test_results && (
                        <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-xs font-medium text-green-600">
                            Results:
                          </p>
                          <p className="text-sm">{patient.lab_test_results}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={getWorkflowBadgeVariant(patient, status.variant)}
                    >
                      {patient.workflow_status || status.label}
                    </Badge>
                    {patient.status === "lab_requested" && (
                      <Button
                        size="sm"
                        icon={Play}
                        onClick={() => handleStartTest(patient)}
                      >
                        Start
                      </Button>
                    )}
                    {patient.status === "lab_in_progress" && (
                      <Button
                        size="sm"
                        icon={FileText}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setTestResult(patient.lab_test_results || "");
                          setShowResultModal(true);
                        }}
                      >
                        Results
                      </Button>
                    )}
                    {patient.status === "lab_completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Eye}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setTestResult(patient.lab_test_results || "");
                          setShowResultModal(true);
                        }}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Modal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          title="Lab Results"
          size="md"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowResultModal(false)}
              >
                Close
              </Button>
              {selectedPatient?.status !== "lab_completed" && (
                <Button onClick={handleSubmitResults} isLoading={isSubmitting}>
                  Submit
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            <p>
              <strong>Patient:</strong> {selectedPatient?.first_name}{" "}
              {selectedPatient?.last_name}
            </p>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-medium">Tests:</p>
              <p>{selectedPatient?.lab_test_requested || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Results</label>
              <textarea
                rows={5}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={testResult}
                onChange={(e) => setTestResult(e.target.value)}
                readOnly={selectedPatient?.status === "lab_completed"}
              />
            </div>
          </div>
          <div className="flex justify-center mt-4 pt-4 border-t">
            <div className="text-center">
              <QRCodeSVG
                value={`${window.location.origin}/patients/${selectedPatient?.mrn}`}
                size={80}
                level="M"
              />
              <p className="text-xs text-gray-400 mt-1">
                Sample: {selectedPatient?.mrn}
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
