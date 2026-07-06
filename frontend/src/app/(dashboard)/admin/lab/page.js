"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { usePatients } from "@/hooks/usePatients";
import {
  FlaskConical,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Play,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function LabDashboard() {
  const router = useRouter();
  const [labPatients, setLabPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [testResult, setTestResult] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLabQueue = async () => {
    try {
      const { data } = await apiClient.get("/patients/lab_queue/");
      setLabPatients(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      toast.error("Failed to load lab queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabQueue();
    const interval = setInterval(fetchLabQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStartTest = async (patient) => {
    try {
      await apiClient.post(`/patients/${patient.mrn}/update_status/`, {
        status: "lab_in_progress",
      });
      toast.success("Test started!");
      fetchLabQueue();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const handleSubmitResults = async () => {
    if (!testResult.trim()) return toast.error("Enter results");
    setIsSubmitting(true);
    try {
      await apiClient.post(
        `/patients/${selectedPatient.mrn}/submit_lab_results/`,
        {
          lab_test_results: testResult,
        },
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

  const openResultModal = (patient) => {
    setSelectedPatient(patient);
    setTestResult(patient.lab_test_results || "");
    setShowResultModal(true);
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Laboratory Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {labPatients.length} patients in queue
          </p>
        </div>

        {/* Stats */}
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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or MRN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>

        {/* Patient List */}
        {filtered.length === 0 ? (
          <Card>
            <div className="text-center py-16">
              <FlaskConical className="h-16 w-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Lab Requests
              </h3>
              <p className="text-gray-500">
                Lab queue is empty. Waiting for doctor requests.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((patient) => {
              const isRequested = patient.status === "lab_requested";
              const isInProgress = patient.status === "lab_in_progress";
              const isCompleted = patient.status === "lab_completed";

              return (
                <Card
                  key={patient.mrn}
                  className="flex items-center justify-between flex-wrap gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isRequested
                          ? "bg-orange-100"
                          : isInProgress
                            ? "bg-purple-100"
                            : "bg-green-100"
                      }`}
                    >
                      <span
                        className={`text-lg font-semibold ${
                          isRequested
                            ? "text-orange-700"
                            : isInProgress
                              ? "text-purple-700"
                              : "text-green-700"
                        }`}
                      >
                        {patient.first_name?.[0]}
                        {patient.last_name?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-lg">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="font-mono">{patient.mrn}</span>
                        <span>•</span>
                        <span>{patient.age} yrs</span>
                        <span>•</span>
                        <span>
                          {patient.gender === "M" ? "Male" : "Female"}
                        </span>
                      </div>
                      {patient.lab_test_requested && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                          <p className="text-xs font-medium text-gray-500">
                            Tests Requested:
                          </p>
                          <p className="text-sm text-gray-700">
                            {patient.lab_test_requested}
                          </p>
                        </div>
                      )}
                      {patient.lab_test_results && (
                        <div className="mt-2 p-2 bg-green-50 rounded-lg">
                          <p className="text-xs font-medium text-green-600">
                            Results:
                          </p>
                          <p className="text-sm text-green-700">
                            {patient.lab_test_results}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        isRequested
                          ? "warning"
                          : isInProgress
                            ? "info"
                            : "success"
                      }
                    >
                      {patient.status.replace(/_/g, " ")}
                    </Badge>

                    {isRequested && (
                      <Button
                        size="sm"
                        icon={Play}
                        onClick={() => handleStartTest(patient)}
                      >
                        Start Test
                      </Button>
                    )}

                    {isInProgress && (
                      <Button
                        size="sm"
                        icon={FileText}
                        onClick={() => openResultModal(patient)}
                      >
                        Enter Results
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/patients/${patient.mrn}`)}
                    >
                      View
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Results Modal */}
        <Modal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          title={`Lab Results: ${selectedPatient?.first_name} ${selectedPatient?.last_name}`}
          size="md"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowResultModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitResults} isLoading={isSubmitting}>
                Submit Results
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500">
                Tests Requested:
              </p>
              <p className="text-sm">
                {selectedPatient?.lab_test_requested || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Results *
              </label>
              <textarea
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                value={testResult}
                onChange={(e) => setTestResult(e.target.value)}
                placeholder="Enter lab test results here..."
              />
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
