"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import ReportGenerator from "@/components/reports/ReportGenerator";
import {
  Search,
  Camera,
  Stethoscope,
  FlaskConical,
  Eye,
  Clock,
  CheckCircle,
  Pill,
  FileText,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

const statusConfig = {
  waiting: { label: "Waiting", color: "#F97316", bg: "#FFF7ED" },
  in_consultation: {
    label: "In Consultation",
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  lab_requested: { label: "Lab Requested", color: "#8B5CF6", bg: "#F5F3FF" },
  lab_in_progress: {
    label: "Lab In Progress",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  lab_completed: { label: "Results Ready", color: "#10B981", bg: "#ECFDF5" },
  imaging_requested: {
    label: "Imaging Requested",
    color: "#EC4899",
    bg: "#FDF2F8",
  },
  imaging_completed: { label: "Imaging Done", color: "#10B981", bg: "#ECFDF5" },
  treated: { label: "Treated", color: "#059669", bg: "#D1FAE5" },
};

export default function DoctorQueuePage() {
  const router = useRouter();
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showTreatModal, setShowTreatModal] = useState(false);
  const [showLabModal, setShowLabModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showImagingModal, setShowImagingModal] = useState(false);
  const [labServices, setLabServices] = useState([]);
  const [loadingLabServices, setLoadingLabServices] = useState(false);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [medicineResults, setMedicineResults] = useState([]);
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [imagingForm, setImagingForm] = useState({
    test_type: "xray",
    body_part: "",
    imaging_requested: "",
  });
  const [treatment, setTreatment] = useState({
    diagnosis: "",
    treatment_plan: "",
    prescription: "",
    doctor_notes: "",
  });
  const [labTest, setLabTest] = useState({
    lab_service_ids: [],
    manual_lab_test_requested: "",
    lab_fee: "0",
  });

  const getWorkflowBadgeVariant = (patient) => {
    const workflow = (patient.workflow_status || "").toLowerCase();
    if (workflow === "treated") return "success";
    if (workflow === "awaiting payment") return "warning";
    return "info";
  };

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get("/patients/doctor_queue/");
      setPatients(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      toast.error("Failed to load queue");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchLabServices = async () => {
    if (labServices.length) return;
    setLoadingLabServices(true);
    try {
      const { data } = await apiClient.get("/services/");
      const allServices = Array.isArray(data) ? data : data?.results || [];
      const labOnly = allServices.filter(
        (service) => service?.service_type === "lab" && service?.is_active,
      );
      setLabServices(labOnly);
    } catch (err) {
      toast.error("Failed to load lab services");
    } finally {
      setLoadingLabServices(false);
    }
  };

  const openLabModal = (patient) => {
    setSelectedPatient(patient);
    setShowLabModal(true);
    setLabTest({
      lab_service_ids: [],
      manual_lab_test_requested: "",
      lab_fee: "0",
    });
    fetchLabServices();
  };

  const closeLabModal = () => {
    setShowLabModal(false);
    setSelectedPatient(null);
    setLabTest({
      lab_service_ids: [],
      manual_lab_test_requested: "",
      lab_fee: "0",
    });
  };

  const getLabServiceLabel = (service) =>
    `${service.name}${service.code ? ` (${service.code})` : ""}`;

  const getSelectedLabServices = () =>
    labServices.filter((service) =>
      labTest.lab_service_ids.includes(String(service.id)),
    );

  const toggleLabService = (serviceId) => {
    const id = String(serviceId);
    setLabTest((previous) => {
      const isSelected = previous.lab_service_ids.includes(id);
      const nextIds = isSelected
        ? previous.lab_service_ids.filter((value) => value !== id)
        : [...previous.lab_service_ids, id];

      const totalFee = labServices
        .filter((service) => nextIds.includes(String(service.id)))
        .reduce((sum, service) => sum + Number(service.price || 0), 0);

      return {
        ...previous,
        lab_service_ids: nextIds,
        lab_fee: String(totalFee),
      };
    });
  };

  const handleStartConsultation = async (patient) => {
    try {
      await apiClient.post(`/patients/${patient.mrn}/update_status/`, {
        status: "in_consultation",
      });
      toast.success("Consultation started");
      fetchQueue();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Payment required before consultation",
      );
    }
  };

  const handleTreatPatient = async () => {
    if (!selectedPatient) return;
    if (!treatment.diagnosis.trim())
      return toast.error("Please enter a diagnosis");
    try {
      if (selectedMedicines.length > 0) {
        for (const med of selectedMedicines) {
          await apiClient.post("/prescriptions/", {
            patient: selectedPatient.id,
            medicine_name: med.name,
            dosage: `${med.dosage} ${med.frequency} x ${med.duration}`,
            quantity_prescribed: parseInt(med.quantity) || 1,
            status: "pending",
            notes: `Patient: ${selectedPatient.first_name} ${selectedPatient.last_name} | MRN: ${selectedPatient.mrn}`,
          });
        }
      }
      await apiClient.post(`/patients/${selectedPatient.mrn}/update_status/`, {
        status: "treated",
        diagnosis: treatment.diagnosis,
        treatment_plan: treatment.treatment_plan,
        prescription: treatment.prescription,
        doctor_notes: treatment.doctor_notes,
      });
      toast.success("Treatment completed");
      setShowTreatModal(false);
      setSelectedPatient(null);
      setTreatment({
        diagnosis: "",
        treatment_plan: "",
        prescription: "",
        doctor_notes: "",
      });
      setSelectedMedicines([]);
      fetchQueue();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const handleRequestLab = async () => {
    const selectedTests = getSelectedLabServices().map((service) =>
      getLabServiceLabel(service),
    );
    const manualTests = (labTest.manual_lab_test_requested || "").trim();
    const requestedTests = [selectedTests.join("\n"), manualTests]
      .filter((value) => value && value.trim())
      .join("\n");

    if (!requestedTests) return toast.error("Select or specify lab tests");

    try {
      await apiClient.post(
        `/patients/${selectedPatient.mrn}/request_lab_test/`,
        {
          lab_test_requested: requestedTests,
          lab_fee: parseFloat(labTest.lab_fee || 0),
        },
      );
      const targetMrn = selectedPatient.mrn;
      toast.success("Lab test requested and sent to cashier for payment");
      closeLabModal();
      fetchQueue();
      router.push(
        `/billing?focus=pending&mrn=${encodeURIComponent(targetMrn)}`,
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.error ||
          "Unable to send to cashier. Please verify billing setup.",
      );
    }
  };

  const handleRequestImaging = async () => {
    if (!imagingForm.body_part) return toast.error("Specify body part");
    try {
      await apiClient.post(
        `/patients/${selectedPatient.mrn}/request_imaging/`,
        {
          test_type: imagingForm.test_type,
          body_part: imagingForm.body_part,
          imaging_requested: `${imagingForm.test_type.toUpperCase()} - ${imagingForm.body_part}: ${imagingForm.imaging_requested}`,
        },
      );
      toast.success("Imaging requested!");
      setShowImagingModal(false);
      setSelectedPatient(null);
      setImagingForm({
        test_type: "xray",
        body_part: "",
        imaging_requested: "",
      });
      fetchQueue();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Payment required before imaging request",
      );
    }
  };

  const searchMedicines = async (term) => {
    if (term.length < 2) {
      setMedicineResults([]);
      return;
    }
    try {
      const { data } = await apiClient.get(`/medicines/?search=${term}`);
      setMedicineResults(data.results || data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const addMedicineToPrescription = (medicine) => {
    const entry = {
      name: medicine.name,
      strength: medicine.strength || "",
      dosage: "",
      frequency: "",
      duration: "",
      quantity: 1,
      stock_quantity: medicine.quantity || 0,
    };
    const updated = [...selectedMedicines, entry];
    setSelectedMedicines(updated);
    setMedicineSearch("");
    setMedicineResults([]);
    setTreatment({
      ...treatment,
      prescription: updated
        .map(
          (m) =>
            `${m.name} ${m.strength} - ${m.dosage} ${m.frequency} x ${m.duration} (Pharmacy ${m.quantity})`,
        )
        .join("\n"),
    });
  };

  const updateMedicineQuantity = (index, quantity) => {
    const safeQuantity = Math.max(1, parseInt(quantity || 1, 10) || 1);
    const updated = selectedMedicines.map((item, itemIndex) =>
      itemIndex === index ? { ...item, quantity: safeQuantity } : item,
    );
    setSelectedMedicines(updated);
    setTreatment({
      ...treatment,
      prescription: updated
        .map(
          (m) =>
            `${m.name} ${m.strength} - ${m.dosage} ${m.frequency} x ${m.duration} (Pharmacy ${m.quantity})`,
        )
        .join("\n"),
    });
  };

  const waitingPatients = patients.filter((p) => p.status === "waiting");
  const consultationPatients = patients.filter(
    (p) => p.status === "in_consultation",
  );
  const labPendingPatients = patients.filter((p) =>
    ["lab_requested", "lab_in_progress"].includes(p.status),
  );
  const resultsReadyPatients = patients.filter(
    (p) => p.status === "lab_completed",
  );
  const imagingReadyPatients = patients.filter(
    (p) => p.status === "imaging_completed",
  );
  const imagingPendingPatients = patients.filter(
    (p) => p.status === "imaging_requested",
  );

  if (isLoading)
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Patients</h1>
            <p className="text-sm text-gray-500 mt-1">
              {waitingPatients.length} waiting • {consultationPatients.length}{" "}
              in consultation •{" "}
              {resultsReadyPatients.length + imagingReadyPatients.length}{" "}
              results ready
            </p>
          </div>
          <Button onClick={fetchQueue} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        <Card>
          <h3 className="font-semibold mb-3">📊 My Shift Report</h3>
          <ReportGenerator
            role="doctor"
            endpoint="/reports/staff/"
            title="Doctor Shift Report"
          />
        </Card>

        <div className="grid grid-cols-5 gap-4">
          <Card className="text-center">
            <Clock className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-600">
              {waitingPatients.length}
            </p>
            <p className="text-xs text-gray-500">Waiting</p>
          </Card>
          <Card className="text-center">
            <Stethoscope className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-600">
              {consultationPatients.length}
            </p>
            <p className="text-xs text-gray-500">In Consultation</p>
          </Card>
          <Card className="text-center">
            <FlaskConical className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-purple-600">
              {labPendingPatients.length}
            </p>
            <p className="text-xs text-gray-500">Lab Pending</p>
          </Card>
          <Card className="text-center">
            <Camera className="h-6 w-6 text-pink-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-pink-600">
              {imagingPendingPatients.length}
            </p>
            <p className="text-xs text-gray-500">Imaging Pending</p>
          </Card>
          <Card className="text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">
              {resultsReadyPatients.length + imagingReadyPatients.length}
            </p>
            <p className="text-xs text-gray-500">Results Ready</p>
          </Card>
        </div>

        {resultsReadyPatients.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-green-100 rounded-xl border-2 border-green-400">
              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-green-800">
                  Lab Results Ready!
                </h2>
                <p className="text-sm text-green-600">
                  {resultsReadyPatients.length} patient(s)
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {resultsReadyPatients.map((patient) => (
                <Card
                  key={patient.mrn}
                  className="border-2 border-green-400 bg-green-50/50 shadow-lg"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-green-300 flex items-center justify-center">
                        <span className="text-xl font-bold text-green-800">
                          {patient.first_name?.[0]}
                          {patient.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-lg">
                          {patient.first_name} {patient.last_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          MRN: {patient.mrn} • {patient.age} yrs
                        </p>
                        {patient.lab_test_results && (
                          <div className="mt-2 p-3 bg-white rounded-lg border-2 border-green-300">
                            <p className="text-xs font-bold text-green-600">
                              📋 RESULTS:
                            </p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                              {patient.lab_test_results}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white font-bold"
                      onClick={() => {
                        setSelectedPatient(patient);
                        setTreatment({
                          diagnosis: "",
                          treatment_plan: "",
                          prescription: "",
                          doctor_notes: `Lab Results:\n${patient.lab_test_results || ""}`,
                        });
                        setShowTreatModal(true);
                      }}
                    >
                      🩺 Review & Treat
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {imagingReadyPatients.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-pink-100 rounded-xl border-2 border-pink-400">
              <div className="h-10 w-10 rounded-full bg-pink-500 flex items-center justify-center">
                <Camera className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-pink-800">
                  Imaging Results Ready!
                </h2>
                <p className="text-sm text-pink-600">
                  {imagingReadyPatients.length} patient(s)
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {imagingReadyPatients.map((patient) => (
                <Card
                  key={patient.mrn}
                  className="border-2 border-pink-400 bg-pink-50/50 shadow-lg"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-pink-300 flex items-center justify-center">
                        <Camera className="h-8 w-8 text-pink-700" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-lg">
                          {patient.first_name} {patient.last_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          MRN: {patient.mrn} • {patient.age} yrs
                        </p>
                        {patient.imaging_results && (
                          <div className="mt-2 p-3 bg-white rounded-lg border-2 border-pink-300">
                            <p className="text-xs font-bold text-pink-600">
                              📋 RESULTS:
                            </p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                              {patient.imaging_results}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="lg"
                      className="bg-pink-600 hover:bg-pink-700 text-white font-bold"
                      onClick={() => {
                        setSelectedPatient(patient);
                        setTreatment({
                          diagnosis: "",
                          treatment_plan: "",
                          prescription: "",
                          doctor_notes: `Imaging Results:\n${patient.imaging_results || ""}`,
                        });
                        setShowTreatModal(true);
                      }}
                    >
                      🩺 Review & Treat
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {patients.filter((p) =>
          ["waiting", "in_consultation"].includes(p.status),
        ).length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Patient Queue
            </h2>
            <div className="space-y-3">
              {patients
                .filter((p) =>
                  ["waiting", "in_consultation"].includes(p.status),
                )
                .map((patient) => {
                  const status =
                    statusConfig[patient.status] || statusConfig.waiting;
                  return (
                    <Card
                      key={patient.mrn}
                      className="flex items-center justify-between flex-wrap gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                          <span className="text-lg font-semibold text-orange-700">
                            {patient.first_name?.[0]}
                            {patient.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            MRN: {patient.mrn} • {patient.age} yrs
                          </p>
                          {patient.symptoms && (
                            <p className="text-sm text-gray-600 mt-1">
                              🩺 {patient.symptoms}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={getWorkflowBadgeVariant(patient)}>
                          {patient.workflow_status || status.label}
                        </Badge>
                        {patient.status === "waiting" && (
                          <Button
                            size="sm"
                            icon={Stethoscope}
                            onClick={() => handleStartConsultation(patient)}
                          >
                            Start
                          </Button>
                        )}
                        {patient.status === "in_consultation" && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={FlaskConical}
                              onClick={() => openLabModal(patient)}
                            >
                              Lab Test
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={Camera}
                              onClick={() => {
                                setSelectedPatient(patient);
                                setShowImagingModal(true);
                              }}
                            >
                              Imaging
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedPatient(patient);
                                setShowTreatModal(true);
                              }}
                            >
                              Treat
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() =>
                            router.push(`/patients/${patient.mrn}`)
                          }
                        >
                          View
                        </Button>
                      </div>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}

        {labPendingPatients.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-purple-700 mb-3 flex items-center gap-2">
              <FlaskConical className="h-5 w-5" /> Lab Tests Pending (
              {labPendingPatients.length})
            </h2>
            <div className="space-y-3">
              {labPendingPatients.map((patient) => (
                <Card key={patient.mrn} className="opacity-70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-purple-700">
                          {patient.first_name?.[0]}
                          {patient.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">
                          {patient.first_name} {patient.last_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          MRN: {patient.mrn}
                        </p>
                      </div>
                    </div>
                    <Badge variant="default">
                      {patient.workflow_status ||
                        patient.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {imagingPendingPatients.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-pink-700 mb-3 flex items-center gap-2">
              <Camera className="h-5 w-5" /> Imaging Pending (
              {imagingPendingPatients.length})
            </h2>
            <div className="space-y-3">
              {imagingPendingPatients.map((patient) => (
                <Card key={patient.mrn} className="opacity-70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-pink-700">
                          {patient.first_name?.[0]}
                          {patient.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">
                          {patient.first_name} {patient.last_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          MRN: {patient.mrn}
                        </p>
                      </div>
                    </div>
                    <Badge variant="default">
                      {patient.workflow_status ||
                        patient.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {patients.length === 0 && (
          <Card>
            <EmptyState
              imageSrc="/images/empty-states/patients-empty.svg"
              imageAlt="No patients"
              title="No Patients Yet"
              description="Patients assigned to you will appear here"
              titleClassName="text-xl font-semibold text-gray-900 mb-2"
              descriptionClassName="text-gray-500 mb-0"
            />
          </Card>
        )}

        {/* Treatment Modal */}
        <Modal
          isOpen={showTreatModal}
          onClose={() => setShowTreatModal(false)}
          title={`Treat: ${selectedPatient?.first_name} ${selectedPatient?.last_name}`}
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowTreatModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleTreatPatient}>Complete Treatment</Button>
            </>
          }
        >
          <div className="space-y-4">
            {selectedPatient?.lab_test_results && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs font-medium text-green-600 mb-1">
                  📋 Lab Results:
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedPatient.lab_test_results}
                </p>
              </div>
            )}
            {selectedPatient?.imaging_results && (
              <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                <p className="text-xs font-medium text-pink-600 mb-1">
                  📸 Imaging Results:
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedPatient.imaging_results}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Diagnosis *
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={treatment.diagnosis}
                onChange={(e) =>
                  setTreatment({ ...treatment, diagnosis: e.target.value })
                }
                placeholder="Enter diagnosis..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prescription *
              </label>
              {selectedMedicines.length > 0 && (
                <div className="mb-3 space-y-2">
                  {selectedMedicines.map((med, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200"
                    >
                      <Pill className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-sm">
                        {med.name} {med.strength}
                      </span>
                      <span className="text-xs text-gray-500">
                        {med.dosage} {med.frequency} x {med.duration}
                      </span>
                      <label className="flex items-center gap-2 text-xs text-gray-600 ml-2">
                        <span>Pharmacy</span>
                        <input
                          type="number"
                          min="1"
                          max={med.stock_quantity || 999}
                          value={med.quantity}
                          onChange={(e) =>
                            updateMedicineQuantity(i, e.target.value)
                          }
                          className="w-16 rounded border px-2 py-1 text-xs"
                        />
                      </label>
                      <button
                        onClick={() => {
                          const updated = selectedMedicines.filter(
                            (_, idx) => idx !== i,
                          );
                          setSelectedMedicines(updated);
                          setTreatment({
                            ...treatment,
                            prescription: updated
                              .map(
                                (m) =>
                                  `${m.name} ${m.strength} - ${m.dosage} ${m.frequency} x ${m.duration} (Pharmacy ${m.quantity})`,
                              )
                              .join("\n"),
                          });
                        }}
                        className="ml-auto text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Medicine Search */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search medicine from inventory..."
                  value={medicineSearch}
                  onChange={(e) => {
                    setMedicineSearch(e.target.value);
                    searchMedicines(e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                />
                {medicineResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {medicineResults.map((med) => (
                      <button
                        key={med.id}
                        type="button"
                        onClick={() => addMedicineToPrescription(med)}
                        className="w-full text-left px-4 py-2.5 hover:bg-orange-50 border-b last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {med.name} {med.strength || ""}
                          </span>
                          <span className="text-xs text-gray-400">
                            Stock: {med.quantity || 0}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {med.form || "N/A"} | SSP {med.selling_price || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual Prescription */}
              <textarea
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={treatment.prescription}
                onChange={(e) =>
                  setTreatment({ ...treatment, prescription: e.target.value })
                }
                placeholder="Or type prescription manually..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Treatment Plan
              </label>
              <textarea
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={treatment.treatment_plan}
                onChange={(e) =>
                  setTreatment({ ...treatment, treatment_plan: e.target.value })
                }
                placeholder="Follow-up, rest, diet advice..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={treatment.doctor_notes}
                onChange={(e) =>
                  setTreatment({ ...treatment, doctor_notes: e.target.value })
                }
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showLabModal}
          onClose={closeLabModal}
          title={`Request Lab: ${selectedPatient?.first_name} ${selectedPatient?.last_name}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={closeLabModal}>
                Cancel
              </Button>
              <Button onClick={handleRequestLab}>Send to Lab</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Lab Tests
              </label>
              <div className="max-h-48 overflow-y-auto rounded-lg border p-2 space-y-1">
                {loadingLabServices && (
                  <p className="text-sm text-gray-500 px-2 py-1">
                    Loading lab services...
                  </p>
                )}
                {!loadingLabServices && !labServices.length && (
                  <p className="text-sm text-gray-500 px-2 py-1">
                    No lab services configured
                  </p>
                )}
                {labServices.map((service) => {
                  const id = String(service.id);
                  const checked = labTest.lab_service_ids.includes(id);
                  return (
                    <label
                      key={service.id}
                      className="flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLabService(service.id)}
                        />
                        <span>{getLabServiceLabel(service)}</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        SSP {Number(service.price || 0).toLocaleString()}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <Input
              label="Lab Fee (SSP)"
              type="number"
              value={labTest.lab_fee}
              onChange={(e) =>
                setLabTest((previous) => ({
                  ...previous,
                  lab_fee: e.target.value,
                }))
              }
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extra Lab Test Notes (optional)
            </label>
            <textarea
              rows={5}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={labTest.manual_lab_test_requested}
              onChange={(e) =>
                setLabTest((previous) => ({
                  ...previous,
                  manual_lab_test_requested: e.target.value,
                }))
              }
              placeholder="Optional extra details or custom tests..."
            />
            {labTest.lab_service_ids.length > 0 && (
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Selected Tests Preview
                </p>
                <p className="text-sm whitespace-pre-wrap text-gray-700">
                  {getSelectedLabServices()
                    .map((service) => getLabServiceLabel(service))
                    .join("\n")}
                </p>
              </div>
            )}
          </div>
        </Modal>

        <Modal
          isOpen={showImagingModal}
          onClose={() => setShowImagingModal(false)}
          title={`Request Imaging: ${selectedPatient?.first_name} ${selectedPatient?.last_name}`}
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowImagingModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleRequestImaging}>Send to Imaging</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="Imaging Type *"
              value={imagingForm.test_type}
              onChange={(e) =>
                setImagingForm({ ...imagingForm, test_type: e.target.value })
              }
              options={[
                { value: "xray", label: "X-Ray" },
                { value: "mri", label: "MRI" },
                { value: "ct", label: "CT Scan" },
                { value: "ultrasound", label: "Ultrasound" },
                { value: "mammogram", label: "Mammogram" },
              ]}
            />
            <Input
              label="Body Part *"
              value={imagingForm.body_part}
              onChange={(e) =>
                setImagingForm({ ...imagingForm, body_part: e.target.value })
              }
              placeholder="e.g., Chest, Head, Abdomen"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clinical Notes
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={imagingForm.imaging_requested}
                onChange={(e) =>
                  setImagingForm({
                    ...imagingForm,
                    imaging_requested: e.target.value,
                  })
                }
                placeholder="Reason for imaging..."
              />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showResultsModal}
          onClose={() => setShowResultsModal(false)}
          title={`Review Results: ${selectedPatient?.first_name} ${selectedPatient?.last_name}`}
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowResultsModal(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowResultsModal(false);
                  setShowTreatModal(true);
                }}
              >
                Proceed to Treat
              </Button>
            </>
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
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs font-medium text-green-600">📋 Results:</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedPatient?.lab_test_results || "No results yet"}
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
