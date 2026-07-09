"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import ReportGenerator from "@/components/reports/ReportGenerator";
import { useHospitalSettings } from "@/hooks/useSettings";
import {
  Plus,
  Search,
  Printer,
  DollarSign,
  Receipt,
  Banknote,
  CreditCard,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: hospitalSettings } = useHospitalSettings();
  const hospitalName = hospitalSettings?.name || "Medical Centre";

  const [patients, setPatients] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [showModal, setShowModal] = useState(false);
  const [showPayment, setShowPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [highlightedMrn, setHighlightedMrn] = useState("");

  const [form, setForm] = useState({
    patient_name: "",
    patient_mrn: "",
    payment_type: "cash",
    consultation_fee: "",
    lab_fee: "0",
    medicine_fee: "0",
    other_fee: "0",
    insurance_company: "",
    insurance_policy: "",
  });

  const getSymbol = () => "SSP";

  const fetchData = async () => {
    try {
      const [patientRes, billRes] = await Promise.all([
        apiClient.get("/patients/?page_size=100"),
        apiClient.get("/bills/"),
      ]);
      setPatients(patientRes.data.results || patientRes.data || []);
      setBills(billRes.data.results || billRes.data || []);
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const focus = searchParams.get("focus");
    const mrn = searchParams.get("mrn") || "";
    if (focus === "pending") {
      setActiveTab("pending");
    } else if (focus === "billed") {
      setActiveTab("billed");
    } else if (focus === "unbilled") {
      setActiveTab("unbilled");
    }
    setHighlightedMrn(mrn);
    if (mrn) {
      setSearchTerm(mrn);
      setActiveTab("pending");
    }
  }, [searchParams]);

  const billedMRNs = bills.map((b) => b.patient_mrn).filter(Boolean);
  const unbilledPatients = patients.filter((p) => !billedMRNs.includes(p.mrn));

  const handleQuickBill = (patient) => {
    setSelectedPatient(patient);
    setForm({
      patient_name:
        `${patient.first_name || ""} ${patient.last_name || ""}`.trim(),
      patient_mrn: patient.mrn || "",
      payment_type: "cash",
      consultation_fee: "50",
      lab_fee: patient.lab_test_requested ? "30" : "0",
      medicine_fee: String(
        patient.medicine_fee_calculated ?? (patient.prescription ? 20 : 0),
      ),
      other_fee: "0",
      insurance_company: "",
      insurance_policy: "",
    });
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!form.patient_name) return toast.error("Enter patient name");
    try {
      await apiClient.post("/bills/", {
        patient_name: form.patient_name,
        patient_mrn: form.patient_mrn,
        payment_method:
          form.payment_type === "insurance" ? "insurance" : "cash",
        consultation_fee: parseFloat(form.consultation_fee || 0),
        lab_fee: parseFloat(form.lab_fee || 0),
        medicine_fee: parseFloat(form.medicine_fee || 0),
        room_fee: 0,
        other_fee: parseFloat(form.other_fee || 0),
        insurance_company:
          form.payment_type === "insurance" ? form.insurance_company : "",
        insurance_policy:
          form.payment_type === "insurance" ? form.insurance_policy : "",
        status: form.payment_type === "insurance" ? "insurance" : "pending",
        notes: "",
      });
      toast.success("Bill created!");
      setShowModal(false);
      setSelectedPatient(null);
      setForm({
        patient_name: "",
        patient_mrn: "",
        payment_type: "cash",
        consultation_fee: "",
        lab_fee: "0",
        medicine_fee: "0",
        other_fee: "0",
        insurance_company: "",
        insurance_policy: "",
      });
      fetchData();
    } catch (err) {
      toast.error("Failed to create bill");
    }
  };

  const handlePayment = async (bill) => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) return toast.error("Enter amount");
    const outstanding = parseFloat(bill?.balance || bill?.total_amount || 0);
    if (amount > outstanding) {
      return toast.error(
        `Amount cannot exceed outstanding balance (${getSymbol()} ${outstanding.toLocaleString()})`,
      );
    }
    try {
      await apiClient.post(`/bills/${bill.id}/make_payment/`, {
        amount: amount,
        method: "cash",
      });
      const { data: updatedBill } = await apiClient.get(`/bills/${bill.id}/`);
      if (updatedBill.status === "paid" && updatedBill.patient_mrn) {
        try {
          await apiClient.post("/prescriptions/mark_paid_by_patient/", {
            mrn: updatedBill.patient_mrn,
          });
          toast.success("Payment recorded! Pharmacy notified ✅");
        } catch (err) {
          toast.success("Payment recorded!");
        }
      } else {
        toast.success("Payment recorded!");
      }
      setShowPayment(null);
      setPaymentAmount("");
      fetchData();
    } catch (err) {
      toast.error("Failed to record payment");
    }
  };

  const handlePrint = (bill) => {
    const sym = getSymbol();
    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const total = parseFloat(bill.total_amount || bill.total || 0);
    const paid = parseFloat(bill.amount_paid || bill.paid || 0);
    const paidApplied = Math.min(paid, total);
    const overpayment = Math.max(paid - total, 0);
    const balance = Math.max(total - paidApplied, 0);
    const consult = parseFloat(bill.consultation_fee || bill.consult || 0);
    const lab = parseFloat(bill.lab_fee || bill.lab || 0);
    const medicine = parseFloat(bill.medicine_fee || bill.medicine || 0);

    const printWindow = window.open("", "_blank", "width=400,height=600");
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Receipt ${bill.bill_number || bill.id}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',monospace;padding:15px;color:#333;max-width:350px;margin:auto;font-size:12px}
        .header{text-align:center;border-bottom:2px dashed #000;padding-bottom:10px;margin-bottom:10px}
        .header h1{font-size:16px;margin-bottom:2px}.header p{font-size:10px;color:#666}
        .row{display:flex;justify-content:space-between;padding:3px 0}
        .total-row{border-top:2px solid #000;border-bottom:2px solid #000;padding:8px 0;margin:8px 0;font-size:16px;font-weight:bold}
        .divider{border-top:1px dashed #ccc;margin:8px 0}
        .center{text-align:center}
        .paid{color:#10B981;font-weight:bold;font-size:14px}
        .pending{color:#EF4444;font-weight:bold;font-size:14px}
        .footer{text-align:center;margin-top:15px;font-size:9px;color:#999;border-top:1px solid #eee;padding-top:10px}
        @media print{body{padding:5px}@page{margin:2mm}}
      </style></head><body>
      <div class="header"><h1>${hospitalName}</h1><p>Juba, South Sudan</p><p>MediCore HMS</p></div>
      <div class="row"><span>Receipt #:</span><span><strong>${bill.bill_number || bill.id}</strong></span></div>
      <div class="row"><span>Date:</span><span>${today} ${time}</span></div>
      <div class="row"><span>Patient:</span><span><strong>${bill.patient_name || bill.patient || "N/A"}</strong></span></div>
      ${bill.patient_mrn || bill.mrn ? `<div class="row"><span>MRN:</span><span>${bill.patient_mrn || bill.mrn}</span></div>` : ""}
      <div class="divider"></div>
      ${consult > 0 ? `<div class="row"><span>Consultation</span><span>${sym} ${consult.toLocaleString()}</span></div>` : ""}
      ${lab > 0 ? `<div class="row"><span>Laboratory</span><span>${sym} ${lab.toLocaleString()}</span></div>` : ""}
      ${medicine > 0 ? `<div class="row"><span>Medicine</span><span>${sym} ${medicine.toLocaleString()}</span></div>` : ""}
      <div class="total-row"><div class="row"><span>TOTAL</span><span>${sym} ${total.toLocaleString()}</span></div></div>
      ${paidApplied > 0 ? `<div class="row"><span>Amount Paid</span><span style="color:#10B981">${sym} ${paidApplied.toLocaleString()}</span></div>` : ""}
      ${overpayment > 0 ? `<div class="row"><span>Excess Payment</span><span style="color:#F59E0B;font-weight:bold">${sym} ${overpayment.toLocaleString()}</span></div>` : ""}
      ${balance > 0 ? `<div class="row"><span>Balance Due</span><span style="color:#EF4444;font-weight:bold">${sym} ${balance.toLocaleString()}</span></div>` : ""}
      <div class="divider"></div>
      <div class="center">${balance <= 0 ? '<span class="paid">✅ PAID</span>' : '<span class="pending">⏳ PENDING</span>'}</div>
      <div class="center" style="margin:10px 0"><img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`Receipt:${bill.bill_number || bill.id}|Amount:${total}|Date:${today}`)}" width="80" height="80" /></div>
      <div class="center" style="font-weight:bold;margin:10px 0">Thank You For Choosing Us!</div>
      <div class="footer"><p>${hospitalName} - MediCore HMS</p><p>Printed: ${today} ${time}</p></div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const filteredUnbilled = unbilledPatients.filter(
    (p) =>
      `${p.first_name} ${p.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      p.mrn?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalRevenue = bills
    .filter((b) => b.status === "paid")
    .reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
  const pendingBills = bills.filter(
    (b) => parseFloat(b.balance || 0) > 0 || b.status !== "paid",
  );
  const billsToShow = activeTab === "pending" ? pendingBills : bills;
  const filteredBills = billsToShow.filter((b) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(b.bill_number || "")
        .toLowerCase()
        .includes(term) ||
      String(b.patient_name || "")
        .toLowerCase()
        .includes(term) ||
      String(b.patient_mrn || "")
        .toLowerCase()
        .includes(term)
    );
  });
  const pendingAmount = bills
    .filter((b) => b.status !== "paid")
    .reduce((s, b) => s + parseFloat(b.balance || b.total_amount || 0), 0);
  const symbol = getSymbol();

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">💵 Cashier Dashboard</h1>
            <p className="text-sm text-gray-500">
              {unbilledPatients.length} patients pending
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
              🇸🇸 SSP
            </span>
            <Button icon={Plus} onClick={() => setShowModal(true)}>
              Create Bill
            </Button>
          </div>
        </div>

        <Card>
          <h3 className="font-semibold mb-3">📊 My Shift Report</h3>
          <ReportGenerator
            role="cashier"
            endpoint="/reports/cashier/"
            title="Cashier Shift Report"
          />
        </Card>

        <div className="grid grid-cols-4 gap-4">
          <Card className="text-center">
            <Receipt className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{unbilledPatients.length}</p>
            <p className="text-xs text-gray-500">Patients</p>
          </Card>
          <Card className="text-center">
            <Banknote className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {symbol} {totalRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Revenue</p>
          </Card>
          <Card className="text-center">
            <Banknote className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {symbol} {pendingAmount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Outstanding</p>
          </Card>
          <Card className="text-center">
            <CreditCard className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{bills.length}</p>
            <p className="text-xs text-gray-500">Bills</p>
          </Card>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "pending" ? "bg-white shadow-sm" : "text-gray-500"}`}
          >
            ⏳ Pending ({pendingBills.length})
          </button>
          <button
            onClick={() => setActiveTab("unbilled")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "unbilled" ? "bg-white shadow-sm" : "text-gray-500"}`}
          >
            👥 Patients ({unbilledPatients.length})
          </button>
          <button
            onClick={() => setActiveTab("billed")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "billed" ? "bg-white shadow-sm" : "text-gray-500"}`}
          >
            📋 Bills ({bills.length})
          </button>
        </div>

        {activeTab === "unbilled" && (
          <div>
            <div className="relative mb-4 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              />
            </div>
            {filteredUnbilled.length === 0 ? (
              <Card>
                <EmptyState
                  imageSrc="/images/empty-states/patients-empty.svg"
                  imageAlt="No patients"
                  title="No patients found"
                  className="py-12"
                  titleClassName="text-base font-medium text-gray-500 mb-0"
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredUnbilled.map((p) => (
                  <Card
                    key={p.mrn}
                    className="border-l-4 border-orange-500 cursor-pointer hover:shadow-md"
                    onClick={() => handleQuickBill(p)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-semibold">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          MRN: {p.mrn} | {p.doctor_name || "N/A"}
                        </p>
                        <Badge
                          variant={
                            (p.workflow_status || "").toLowerCase() ===
                            "awaiting payment"
                              ? "warning"
                              : p.status === "treated"
                                ? "success"
                                : "info"
                          }
                          className="mt-1"
                        >
                          {p.workflow_status || p.status_display || p.status}
                        </Badge>
                        {p.diagnosis && (
                          <p className="text-xs mt-1">📋 {p.diagnosis}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Medicine charge: SSP {p.medicine_fee_calculated || 0}
                        </p>
                        <p className="text-xs text-orange-600 mt-2 font-medium">
                          Click to Bill →
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {["pending", "billed"].includes(activeTab) &&
          (filteredBills.length === 0 ? (
            <Card>
              <EmptyState
                imageSrc="/images/empty-states/billing-empty.svg"
                imageAlt="No bills"
                title={
                  activeTab === "pending" ? "No pending bills" : "No bills yet"
                }
                description={
                  searchTerm ? "No bills match your search." : undefined
                }
                className="py-12"
                titleClassName="text-base font-medium text-gray-500 mb-0"
              />
            </Card>
          ) : (
            <Card padding={false}>
              <div className="px-3 pt-3">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search bills by MRN, name, or bill #..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Bill #
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Patient
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Paid
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Balance
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredBills.map((b) => {
                      const isHighlighted =
                        highlightedMrn &&
                        String(b.patient_mrn || "").toLowerCase() ===
                          highlightedMrn.toLowerCase();
                      return (
                        <tr
                          key={b.id}
                          className={
                            isHighlighted
                              ? "bg-amber-50 hover:bg-amber-100"
                              : "hover:bg-gray-50"
                          }
                        >
                          <td className="px-2 py-3 text-xs font-mono">
                            {b.bill_number || `#${b.id}`}
                          </td>
                          <td className="px-2 py-3 text-sm font-medium">
                            {b.patient_name}
                            {isHighlighted && (
                              <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                Target
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-sm">
                            {symbol} {b.total_amount || 0}
                          </td>
                          <td className="px-2 py-3 text-sm text-green-600">
                            {symbol} {b.amount_paid || 0}
                          </td>
                          <td className="px-2 py-3 text-sm font-bold text-red-600">
                            {symbol} {b.balance || 0}
                          </td>
                          <td className="px-2 py-3">
                            <Badge
                              variant={
                                b.status === "paid"
                                  ? "success"
                                  : b.status === "partial"
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              {b.status}
                            </Badge>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => handlePrint(b)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              {(b.balance > 0 || !b.amount_paid) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setShowPayment(b);
                                    setPaymentAmount("");
                                  }}
                                >
                                  Pay
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Create Bill"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Bill</Button>
            </>
          }
        >
          <div className="space-y-4">
            {selectedPatient && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-1">
                <p className="font-bold text-blue-700">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </p>
                <p className="text-xs">
                  MRN: {selectedPatient.mrn} | {selectedPatient.doctor_name}
                </p>
                {selectedPatient.diagnosis && (
                  <p>📋 {selectedPatient.diagnosis}</p>
                )}
                <p className="text-xs text-gray-600">
                  Medicine charge: SSP{" "}
                  {selectedPatient.medicine_fee_calculated || 0}
                </p>
              </div>
            )}
            <Input
              label="Patient Name *"
              value={form.patient_name}
              onChange={(e) =>
                setForm({ ...form, patient_name: e.target.value })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Consultation (SSP)"
                type="number"
                value={form.consultation_fee}
                onChange={(e) =>
                  setForm({ ...form, consultation_fee: e.target.value })
                }
              />
              <Input
                label="Lab Fee (SSP)"
                type="number"
                value={form.lab_fee}
                onChange={(e) => setForm({ ...form, lab_fee: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Medicine (SSP)"
                type="number"
                value={form.medicine_fee}
                onChange={(e) =>
                  setForm({ ...form, medicine_fee: e.target.value })
                }
              />
              <Input
                label="Other (SSP)"
                type="number"
                value={form.other_fee}
                onChange={(e) =>
                  setForm({ ...form, other_fee: e.target.value })
                }
              />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={!!showPayment}
          onClose={() => setShowPayment(null)}
          title="Record Payment"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowPayment(null)}>
                Cancel
              </Button>
              <Button onClick={() => handlePayment(showPayment)}>
                Confirm
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p>
              Patient: <strong>{showPayment?.patient_name}</strong>
            </p>
            <p>
              Total: {symbol} {showPayment?.total_amount || 0}
            </p>
            <p>
              Balance:{" "}
              <strong className="text-red-600">
                {symbol}{" "}
                {showPayment?.balance || showPayment?.total_amount || 0}
              </strong>
            </p>
            <Input
              label={`Amount (${symbol})`}
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              max={showPayment?.balance || showPayment?.total_amount || 0}
            />
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
