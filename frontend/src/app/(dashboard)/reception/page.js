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
import { useDoctors } from "@/hooks/useStaff";
import { useHospitalSettings } from "@/hooks/useSettings";
import {
  UserPlus,
  Search,
  Users,
  Clock,
  Printer,
  QrCode,
  UserCheck,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import ReportGenerator from "@/components/reports/ReportGenerator";
import { QRCodeSVG } from "qrcode.react";

export default function ReceptionDashboard() {
  const router = useRouter();
  const { data: doctors } = useDoctors();
  const { data: hospitalSettings } = useHospitalSettings();
  const hospitalName = hospitalSettings?.name || "Medical Centre";

  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [quickLookupMrn, setQuickLookupMrn] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consultationServices, setConsultationServices] = useState([]);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    gender: "M",
    date_of_birth: "",
    address: "",
    symptoms: "",
    blood_group: "",
    consultation_service_id: "",
  });

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [patRes, statsRes, serviceRes] = await Promise.all([
        apiClient.get("/patients/?page_size=100"),
        apiClient.get("/patients/stats/"),
        apiClient.get("/services/"),
      ]);

      const patientsData = Array.isArray(patRes?.data?.results)
        ? patRes.data.results
        : Array.isArray(patRes?.data)
          ? patRes.data
          : [];
      const statsData =
        statsRes?.data && typeof statsRes.data === "object"
          ? statsRes.data
          : {};
      const allServices = Array.isArray(serviceRes?.data?.results)
        ? serviceRes.data.results
        : Array.isArray(serviceRes?.data)
          ? serviceRes.data
          : [];

      setPatients(patientsData);
      setStats(statsData);
      const activeConsultations = allServices.filter(
        (service) =>
          service?.service_type === "consultation" && service?.is_active,
      );
      setConsultationServices(activeConsultations);

      if (activeConsultations.length) {
        setForm((previous) => ({
          ...previous,
          consultation_service_id:
            previous.consultation_service_id ||
            String(activeConsultations[0].id),
        }));
      }
    } catch (err) {
      toast.error("Failed to load reception data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.phone)
      return toast.error("Name and phone required");
    if (!form.consultation_service_id)
      return toast.error("Please select consultation type");
    setIsSubmitting(true);
    try {
      const selectedConsultation = consultationServices.find(
        (service) =>
          String(service.id) === String(form.consultation_service_id),
      );
      const { consultation_service_id, ...patientPayload } = form;
      const { data: patient } = await apiClient.post("/patients/", {
        ...patientPayload,
        date_of_birth: form.date_of_birth || "2000-01-01",
      });

      await apiClient.post("/bills/", {
        patient_name:
          `${patient.first_name || ""} ${patient.last_name || ""}`.trim(),
        patient_mrn: patient.mrn,
        payment_method: "cash",
        consultation_fee: parseFloat(selectedConsultation?.price || 0),
        lab_fee: 0,
        medicine_fee: 0,
        room_fee: 0,
        other_fee: 0,
        insurance_company: "",
        insurance_policy: "",
        status: "pending",
        notes: selectedConsultation
          ? `Consultation type: ${selectedConsultation.name}${selectedConsultation.code ? ` (${selectedConsultation.code})` : ""}`
          : "",
      });

      toast.success(`Registered! MRN: ${patient.mrn}`);
      setShowRegister(false);
      setSelectedPatient(patient);
      setShowAssign(true);
      setForm({
        first_name: "",
        last_name: "",
        phone: "",
        gender: "M",
        date_of_birth: "",
        address: "",
        symptoms: "",
        blood_group: "",
        consultation_service_id: consultationServices[0]
          ? String(consultationServices[0].id)
          : "",
      });
      fetchData();
    } catch (err) {
      toast.error("Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignDoctor = async () => {
    if (!selectedDoctor || !selectedPatient) return;
    try {
      await apiClient.post(`/patients/${selectedPatient.mrn}/assign_doctor/`, {
        assigned_doctor: selectedDoctor,
      });
      toast.success("Sent to doctor!");
      setShowAssign(false);
      setSelectedPatient(null);
      setSelectedDoctor("");
      fetchData();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const handlePrintReport = (patient) => {
    const printWindow = window.open("", "_blank", "width=500,height=700");
    printWindow.document.write(`
      <html><head><title>Medical Report - ${patient.first_name} ${patient.last_name}</title>
      <style>
        body{font-family:Arial;padding:30px;color:#333;max-width:800px;margin:auto}
        .header{text-align:center;border-bottom:3px solid #1E3A5F;padding-bottom:15px;margin-bottom:20px}
        .header h1{color:#1E3A5F;margin:0;font-size:22px}.header h2{color:#F97316;margin:5px 0;font-size:16px}
        .section{border:1px solid #ddd;border-radius:8px;padding:15px;margin:15px 0}
        .section h3{color:#1E3A5F;margin:0 0 10px 0;font-size:14px;border-bottom:1px solid #eee;padding-bottom:5px}
        .row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
        .label{color:#666}.value{font-weight:bold;color:#333}
        .diagnosis{background:#FFF3CD;padding:10px;border-radius:5px;margin:5px 0}
        .prescription{background:#D4EDDA;padding:10px;border-radius:5px;margin:5px 0}
        .lab{background:#E2E3F1;padding:10px;border-radius:5px;margin:5px 0}
        .footer{text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:11px;color:#888}
        @media print{body{padding:10px}}
      </style></head><body>
      <div class="header"><h1>${hospitalName}</h1><h2>Patient Medical Report</h2><p>Juba, South Sudan</p></div>
      <div class="section"><h3>📋 Patient Information</h3>
        <div class="row"><span class="label">Name:</span><span class="value">${patient.first_name} ${patient.last_name}</span></div>
        <div class="row"><span class="label">MRN:</span><span class="value">${patient.mrn}</span></div>
        <div class="row"><span class="label">Gender:</span><span class="value">${patient.gender === "M" ? "Male" : "Female"}</span></div>
        <div class="row"><span class="label">Age:</span><span class="value">${patient.age || "N/A"} years</span></div>
        <div class="row"><span class="label">Blood Group:</span><span class="value">${patient.blood_group || "N/A"}</span></div>
        <div class="row"><span class="label">Phone:</span><span class="value">${patient.phone || "N/A"}</span></div>
      </div>
      <div class="section"><h3>👨‍⚕️ Doctor Consultation</h3>
        <div class="row"><span class="label">Doctor:</span><span class="value">${patient.doctor_name || "N/A"}</span></div>
        <div class="row"><span class="label">Status:</span><span class="value">${patient.status_display || patient.status}</span></div>
        ${patient.diagnosis ? `<div class="diagnosis"><strong>📋 Diagnosis:</strong><br/>${patient.diagnosis}</div>` : ""}
      </div>
      <div class="section"><h3>💊 Prescription</h3>
        ${patient.prescription ? `<div class="prescription"><strong>Prescribed:</strong><br/>${patient.prescription}</div>` : '<p style="color:#999">No prescription</p>'}
      </div>
      <div class="section"><h3>🔬 Laboratory</h3>
        ${patient.lab_test_requested ? `<p><strong>Tests:</strong> ${patient.lab_test_requested}</p>` : '<p style="color:#999">No lab tests</p>'}
        ${patient.lab_test_results ? `<div class="lab"><strong>Results:</strong><br/>${patient.lab_test_results}</div>` : ""}
      </div>
      <div class="footer"><p>${hospitalName} - MediCore HMS</p><p>Printed: ${new Date().toLocaleString()}</p></div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const doctorOptions = (doctors || []).map((doc) => ({
    value: doc.id,
    label: `Dr. ${doc.user?.first_name} ${doc.user?.last_name}`,
  }));

  const getStatusBadgeVariant = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "waiting") return "warning";
    if (normalized === "in_consultation" || normalized === "in consultation")
      return "info";
    if (normalized === "treated" || normalized === "completed")
      return "success";
    return "default";
  };

  const handleQuickLookup = () => {
    const mrn = quickLookupMrn.trim();
    if (!mrn) {
      toast.error("Enter MRN to find patient");
      return;
    }
    router.push(`/patients/${mrn}`);
  };

  const handleAssignDoctorForPatient = (patient) => {
    setSelectedPatient(patient);
    setSelectedDoctor("");
    setShowAssign(true);
  };

  const todayPatients = patients.filter(
    (p) => new Date(p.created_at).toDateString() === new Date().toDateString(),
  );
  const filtered = patients
    .filter(
      (p) =>
        `${p.first_name} ${p.last_name}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        p.phone?.includes(searchTerm) ||
        p.mrn?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
  const visiblePatients = filtered.slice(0, 20);

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
        <Card>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <QrCode className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                Quick Patient Lookup
              </h3>
              <p className="text-sm text-gray-500">
                Enter MRN or scan patient QR code
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter MRN..."
                value={quickLookupMrn}
                onChange={(e) => setQuickLookupMrn(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.value) {
                    router.push(`/patients/${e.target.value}`);
                  }
                }}
              />
            </div>
            <Button onClick={handleQuickLookup}>Find Patient</Button>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reception Desk</h1>
            <p className="text-sm text-gray-500">
              {todayPatients.length} patients today
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchData}
              isLoading={refreshing}
            >
              Refresh
            </Button>
            <Button icon={UserPlus} onClick={() => setShowRegister(true)}>
              Register Patient
            </Button>
          </div>
        </div>

        <Card>
          <h3 className="font-semibold mb-3">📊 My Shift Report</h3>
          <ReportGenerator
            role="receptionist"
            endpoint="/reports/reception/"
            title="Receptionist Shift Report"
          />
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="text-center">
            <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats?.total_patients || 0}</p>
            <p className="text-xs text-gray-500">Total</p>
          </Card>
          <Card className="text-center">
            <Clock className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{todayPatients.length}</p>
            <p className="text-xs text-gray-500">Today</p>
          </Card>
          <Card className="text-center">
            <Clock className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats?.waiting || 0}</p>
            <p className="text-xs text-gray-500">Waiting</p>
          </Card>
          <Card className="text-center">
            <Users className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{doctors?.length || 0}</p>
            <p className="text-xs text-gray-500">Doctors</p>
          </Card>
        </div>

        <Card>
          <h3 className="font-semibold mb-4">Patient Registrations</h3>
          <div className="space-y-3">
            {[
              {
                label: "Total",
                value: stats?.total_patients || 0,
                max: stats?.total_patients || 1,
              },
              {
                label: "Active",
                value: stats?.active_patients || 0,
                max: stats?.total_patients || 1,
              },
              {
                label: "Today",
                value: stats?.today_new || 0,
                max: Math.max(stats?.today_new || 1, 10),
              },
              {
                label: "Waiting",
                value: stats?.waiting || 0,
                max: Math.max(stats?.waiting || 1, 10),
              },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16">{item.label}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{
                      width: `${Math.min((item.value / item.max) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium w-8 text-right">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold mb-4">Gender Distribution</h3>
            <div className="flex items-center justify-center gap-8">
              {[
                {
                  label: "Male",
                  value: patients.filter((p) => p.gender === "M").length,
                  color: "bg-blue-500",
                },
                {
                  label: "Female",
                  value: patients.filter((p) => p.gender === "F").length,
                  color: "bg-pink-500",
                },
              ].map((item) => {
                const total = patients.length || 1;
                const pct = Math.round((item.value / total) * 100);
                return (
                  <div key={item.label} className="text-center">
                    <div
                      className={`h-20 w-20 rounded-full ${item.color} flex items-center justify-center mb-2`}
                    >
                      <span className="text-xl font-bold text-white">
                        {pct}%
                      </span>
                    </div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-gray-500">
                      {item.value} patients
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-4">Hospital Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-500">Total Patients</span>
                <span className="text-sm font-medium">
                  {stats?.total_patients || 0}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-500">Active</span>
                <span className="text-sm font-medium">
                  {stats?.active_patients || 0}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-500">New Today</span>
                <span className="text-sm font-medium text-green-600">
                  +{stats?.today_new || 0}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-500">In Consultation</span>
                <span className="text-sm font-medium text-blue-600">
                  {stats?.in_consultation || 0}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Treated Today</span>
                <span className="text-sm font-medium text-green-600">
                  {stats?.treated_today || 0}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <Card padding={false}>
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Showing {Math.min(filtered.length, 20)} of {filtered.length}{" "}
              patients
            </p>
          </div>
          <div className="md:hidden p-4 space-y-3">
            {visiblePatients.map((p) => (
              <div
                key={p.mrn}
                className="border border-gray-200 rounded-xl p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">
                      {p.mrn}
                    </p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(p.status)}>
                    {p.status}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="text-gray-800">{p.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Doctor</p>
                    <p className="text-gray-800">{p.doctor_name || "-"}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ExternalLink}
                    onClick={() => router.push(`/patients/${p.mrn}`)}
                    title="Open patient"
                    aria-label="Open patient"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={UserCheck}
                    onClick={() => handleAssignDoctorForPatient(p)}
                    title="Assign doctor"
                    aria-label="Assign doctor"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Printer}
                    onClick={() => handlePrintReport(p)}
                    title="Print medical report"
                    aria-label="Print medical report"
                  />
                </div>
              </div>
            ))}
            {!visiblePatients.length && (
              <p className="text-sm text-gray-500 text-center py-6">
                No patients found.
              </p>
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Patient
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    MRN
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Phone
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Doctor
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visiblePatients.map((p) => (
                  <tr key={p.mrn} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm font-medium">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-3 py-3 text-sm font-mono">{p.mrn}</td>
                    <td className="px-3 py-3 text-sm">{p.phone}</td>
                    <td className="px-3 py-3 text-sm">
                      {p.doctor_name || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={getStatusBadgeVariant(p.status)}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={ExternalLink}
                          onClick={() => router.push(`/patients/${p.mrn}`)}
                          title="Open patient"
                          aria-label="Open patient"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={UserCheck}
                          onClick={() => handleAssignDoctorForPatient(p)}
                          title="Assign doctor"
                          aria-label="Assign doctor"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Printer}
                          onClick={() => handlePrintReport(p)}
                          title="Print medical report"
                          aria-label="Print medical report"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {!visiblePatients.length && (
                  <tr>
                    <td
                      className="px-3 py-6 text-sm text-gray-500 text-center"
                      colSpan={6}
                    >
                      No patients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Modal
          isOpen={showRegister}
          onClose={() => setShowRegister(false)}
          title="Register New Patient"
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowRegister(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleRegister} isLoading={isSubmitting}>
                Register
              </Button>
            </>
          }
        >
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name *"
                value={form.first_name}
                onChange={(e) =>
                  setForm({ ...form, first_name: e.target.value })
                }
                required
              />
              <Input
                label="Last Name *"
                value={form.last_name}
                onChange={(e) =>
                  setForm({ ...form, last_name: e.target.value })
                }
                required
              />
            </div>
            <Input
              label="Phone *"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="09XX XXX XXX"
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Gender"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                options={[
                  { value: "M", label: "Male" },
                  { value: "F", label: "Female" },
                ]}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={form.date_of_birth}
                onChange={(e) =>
                  setForm({ ...form, date_of_birth: e.target.value })
                }
              />
            </div>
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <Input
              label="Symptoms"
              value={form.symptoms}
              onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
            />
            <Select
              label="Consultation Type *"
              value={form.consultation_service_id}
              onChange={(e) =>
                setForm({ ...form, consultation_service_id: e.target.value })
              }
              options={consultationServices.map((service) => ({
                value: String(service.id),
                label: `${service.name} - SSP ${Number(service.price || 0).toLocaleString()}`,
              }))}
              placeholder={
                consultationServices.length
                  ? "Select consultation type"
                  : "No consultation services configured"
              }
              required
            />
          </form>
        </Modal>

        <Modal
          isOpen={showAssign}
          onClose={() => setShowAssign(false)}
          title="Assign Doctor"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowAssign(false)}>
                Skip
              </Button>
              <Button onClick={handleAssignDoctor} disabled={!selectedDoctor}>
                Send to Doctor
              </Button>
            </>
          }
        >
          <p className="text-sm mb-4">
            Patient:{" "}
            <strong>
              {selectedPatient?.first_name} {selectedPatient?.last_name}
            </strong>{" "}
            (MRN: {selectedPatient?.mrn})
          </p>
          <Select
            label="Select Doctor"
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
            options={[{ value: "", label: "Choose..." }, ...doctorOptions]}
          />
        </Modal>
      </div>
    </DashboardLayout>
  );
}
