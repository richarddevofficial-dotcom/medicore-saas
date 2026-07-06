"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import ReportGenerator from "@/components/reports/ReportGenerator";
import { useHospitalSettings } from "@/hooks/useSettings";
import {
  Pill,
  Clock,
  CheckCircle,
  User,
  DollarSign,
  Printer,
  Plus,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function PharmacyPage() {
  const router = useRouter();
  const { data: hospitalSettings } = useHospitalSettings();
  const hospitalName = hospitalSettings?.name || "Medical Centre";

  const [prescriptions, setPrescriptions] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDispense, setShowDispense] = useState(null);
  const [dispenseQty, setDispenseQty] = useState("");
  const [activeTab, setActiveTab] = useState("ready");
  const [showPOS, setShowPOS] = useState(false);
  const [posForm, setPosForm] = useState({
    medicine: "",
    quantity: "1",
    price: "",
    searchTerm: "",
    selectedName: "",
    stock: 0,
  });

  const fetchData = async () => {
    try {
      const [presRes, medRes] = await Promise.all([
        apiClient.get("/prescriptions/queue/"),
        apiClient.get("/medicines/"),
      ]);
      setPrescriptions(Array.isArray(presRes.data) ? presRes.data : []);
      setMedicines(medRes.data.results || medRes.data || []);
    } catch (err) {
      console.error("Pharmacy error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDispense = async () => {
    const qty = parseInt(dispenseQty);
    if (!qty || qty <= 0) return toast.error("Enter quantity");
    try {
      await apiClient.post(`/prescriptions/${showDispense.id}/dispense/`, {
        quantity: qty,
      });
      toast.success("Dispensed!");
      setShowDispense(null);
      setDispenseQty("");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  const handleQuickSale = async () => {
    if (!posForm.medicine || !posForm.quantity)
      return toast.error("Select medicine and quantity");
    const med = medicines.find((m) => m.id == posForm.medicine);
    if (!med) return toast.error("Medicine not found");
    const newQty = med.quantity - parseInt(posForm.quantity);
    if (newQty < 0) return toast.error("Not enough stock!");
    try {
      await apiClient.patch(`/medicines/${posForm.medicine}/`, {
        quantity: newQty,
      });
      const total =
        (parseFloat(posForm.price) || 0) * (parseInt(posForm.quantity) || 0);
      toast.success(`Sale completed! SSP ${total.toLocaleString()}`);
      setShowPOS(false);
      setPosForm({
        medicine: "",
        quantity: "1",
        price: "",
        searchTerm: "",
        selectedName: "",
        stock: 0,
      });
      fetchData();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const handlePrintPrescription = (group) => {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    printWindow.document.write(`
      <html><head><title>Prescription - ${group.patient_name}</title>
      <style>
        body{font-family:Arial;padding:25px;color:#333;max-width:400px;margin:auto}
        .header{text-align:center;border-bottom:2px solid #1E3A5F;padding-bottom:10px;margin-bottom:15px}
        .header h1{color:#1E3A5F;margin:0;font-size:20px}.header p{color:#666;margin:3px 0;font-size:12px}
        .patient-info{background:#EFF6FF;padding:10px;border-radius:5px;margin:10px 0}
        .medicine{border:1px solid #ddd;padding:10px;margin:8px 0;border-radius:5px}
        .medicine h3{color:#1E3A5F;margin:0 0 5px 0;font-size:14px}
        .medicine p{margin:3px 0;font-size:12px;color:#555}
        .footer{text-align:center;margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#888}
        @media print{body{padding:10px}}
      </style></head><body>
      <div class="header"><h1>${hospitalName}</h1><p>Juba, South Sudan</p><p>PHARMACY PRESCRIPTION</p></div>
      <div class="patient-info"><p><strong>Patient:</strong> ${group.patient_name}</p><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p></div>
      ${group.medicines.map((med, i) => `<div class="medicine"><h3>${i + 1}. ${med.medicine_name}</h3><p><strong>Dosage:</strong> ${med.dosage}</p><p><strong>Qty:</strong> ${med.quantity_prescribed}</p></div>`).join("")}
      <div class="footer"><p>${hospitalName} - MediCore HMS</p><p>Printed: ${new Date().toLocaleString()}</p></div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const groupedPrescriptions = {};
  prescriptions.forEach((p) => {
    const key = p.patient_name || "Unknown";
    if (!groupedPrescriptions[key])
      groupedPrescriptions[key] = { patient_name: key, medicines: [] };
    groupedPrescriptions[key].medicines.push(p);
  });
  const patientGroups = Object.values(groupedPrescriptions);
  const awaitingPayment = patientGroups.filter((g) =>
    g.medicines.some((m) => m.status === "pending"),
  );
  const readyToDispense = patientGroups.filter((g) =>
    g.medicines.every(
      (m) =>
        m.status === "ready" ||
        m.status === "partial" ||
        m.status === "dispensed",
    ),
  );

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
            <h1 className="text-2xl font-bold">💊 Pharmacy Dashboard</h1>
            <p className="text-sm text-gray-500">
              {readyToDispense.length} ready to dispense
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button icon={Plus} onClick={() => setShowPOS(true)}>
              Quick Sale (POS)
            </Button>
            <Button variant="outline" onClick={fetchData}>
              Refresh
            </Button>
          </div>
        </div>
        <Card>
          <h3 className="font-semibold mb-3">📊 My Shift Report</h3>
          <ReportGenerator
            role="pharmacist"
            endpoint="/reports/pharmacy/"
            title="Pharmacist Shift Report"
          />
        </Card>
        <div className="grid grid-cols-4 gap-4">
          <Card className="text-center">
            <DollarSign className="h-6 w-6 text-red-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{awaitingPayment.length}</p>
            <p className="text-xs text-gray-500">Awaiting Payment</p>
          </Card>
          <Card className="text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{readyToDispense.length}</p>
            <p className="text-xs text-gray-500">Ready</p>
          </Card>
          <Card className="text-center">
            <Pill className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {prescriptions.filter((p) => p.status === "dispensed").length}
            </p>
            <p className="text-xs text-gray-500">Dispensed</p>
          </Card>
          <Card className="text-center">
            <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">SSP 0</p>
            <p className="text-xs text-gray-500">Sales</p>
          </Card>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("ready")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "ready" ? "bg-white shadow-sm" : "text-gray-500"}`}
          >
            ✅ Ready ({readyToDispense.length})
          </button>
          <button
            onClick={() => setActiveTab("payment")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "payment" ? "bg-white shadow-sm" : "text-gray-500"}`}
          >
            ⏳ Awaiting Payment ({awaitingPayment.length})
          </button>
        </div>
        {activeTab === "payment" && awaitingPayment.length === 0 && (
          <Card>
            <div className="text-center py-12 text-gray-500">
              No patients awaiting payment
            </div>
          </Card>
        )}
        {activeTab === "ready" && readyToDispense.length === 0 && (
          <Card>
            <div className="text-center py-12 text-gray-500">
              No prescriptions ready
            </div>
          </Card>
        )}
        {(activeTab === "ready" ? readyToDispense : awaitingPayment).map(
          (group) => (
            <Card
              key={group.patient_name}
              className={`border-l-4 ${activeTab === "ready" ? "border-green-500" : "border-red-400"} shadow-md`}
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      {group.patient_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {group.medicines.length} medicine(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeTab === "ready" && (
                    <button
                      onClick={() => handlePrintPrescription(group)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Print"
                    >
                      <Printer className="h-5 w-5" />
                    </button>
                  )}
                  <Badge
                    variant={activeTab === "ready" ? "success" : "warning"}
                  >
                    {activeTab === "ready" ? "Paid" : "Awaiting Payment"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                {group.medicines.map((med) => (
                  <div
                    key={med.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Pill className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-semibold text-gray-800">
                          {med.medicine_name}
                        </p>
                        <p className="text-xs text-gray-500">{med.dosage}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="info">
                        Qty: {med.quantity_prescribed}
                      </Badge>
                      {activeTab === "ready" && (
                        <Button
                          size="sm"
                          icon={Pill}
                          onClick={() => {
                            setShowDispense(med);
                            setDispenseQty("");
                          }}
                        >
                          Dispense
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ),
        )}
      </div>
      {/* Modals remain the same */}
      <Modal
        isOpen={!!showDispense}
        onClose={() => setShowDispense(null)}
        title={`Dispense: ${showDispense?.medicine_name}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDispense(null)}>
              Cancel
            </Button>
            <Button onClick={handleDispense}>Confirm</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p>
              <strong>Patient:</strong> {showDispense?.patient_name}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <p>
              <strong>Medicine:</strong> {showDispense?.medicine_name}
            </p>
            <p className="text-sm text-gray-500">{showDispense?.dosage}</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm">
              <strong>📦 Stock:</strong>{" "}
              <span className="text-lg font-bold">
                {medicines.find(
                  (m) =>
                    m.name?.toLowerCase() ===
                    showDispense?.medicine_name?.toLowerCase(),
                )?.quantity || "N/A"}
              </span>
            </p>
          </div>
          <Input
            label="Quantity *"
            type="number"
            value={dispenseQty}
            onChange={(e) => setDispenseQty(e.target.value)}
          />
        </div>
      </Modal>
      <Modal
        isOpen={showPOS}
        onClose={() => setShowPOS(false)}
        title="Quick Sale (POS)"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPOS(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickSale}>Complete Sale</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Medicine
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Type medicine name..."
                value={posForm.searchTerm || ""}
                onChange={(e) =>
                  setPosForm({
                    ...posForm,
                    searchTerm: e.target.value,
                    medicine: "",
                  })
                }
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              />
            </div>
            {posForm.searchTerm && !posForm.medicine && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {medicines
                  .filter(
                    (m) =>
                      m.quantity > 0 &&
                      m.name
                        ?.toLowerCase()
                        .includes(posForm.searchTerm?.toLowerCase()),
                  )
                  .slice(0, 10)
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setPosForm({
                          ...posForm,
                          medicine: m.id,
                          price: m.selling_price || "",
                          selectedName: m.name,
                          stock: m.quantity,
                        });
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-orange-50 border-b text-sm"
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="text-gray-400 ml-2">
                        Stock: {m.quantity}
                      </span>
                      <span className="text-green-600 float-right">
                        SSP {m.selling_price}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>
          {posForm.medicine && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="font-medium">{posForm.selectedName}</p>
              <p className="text-xs text-gray-500">
                Stock: {posForm.stock} | SSP {posForm.price}
              </p>
            </div>
          )}
          <Input
            label="Quantity"
            type="number"
            value={posForm.quantity}
            onChange={(e) =>
              setPosForm({ ...posForm, quantity: e.target.value })
            }
          />
          <Input
            label="Price (SSP)"
            type="number"
            value={posForm.price}
            onChange={(e) => setPosForm({ ...posForm, price: e.target.value })}
          />
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">
              SSP{" "}
              {(
                (parseFloat(posForm.price) || 0) *
                (parseInt(posForm.quantity) || 0)
              ).toLocaleString()}
            </p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
