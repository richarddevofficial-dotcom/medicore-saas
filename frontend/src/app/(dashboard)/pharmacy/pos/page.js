"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";
import { useHospitalSettings } from "@/hooks/useSettings";
import { ArrowLeft, Printer, ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { printPosReceipt } from "@/lib/printPosReceipt";

export default function PharmacyPOSPage() {
  const router = useRouter();
  const { data: hospitalSettings } = useHospitalSettings();
  const hospitalName = hospitalSettings?.name || "Medical Centre";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [posReceipts, setPosReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastReceipt, setLastReceipt] = useState(null);
  const [form, setForm] = useState({
    medicineId: "",
    quantity: "1",
    unitPrice: "0",
    customerName: "Walk-in Customer",
  });

  const fetchMedicines = async () => {
    try {
      const { data } = await apiClient.get("/medicines/");
      const items = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];
      setMedicines(items);
    } catch {
      toast.error("Failed to load medicines");
    }
  };

  const fetchPosReceipts = async () => {
    setReceiptsLoading(true);
    try {
      const { data } = await apiClient.get("/pos-receipts/");
      const items = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];
      setPosReceipts(items);
    } catch {
      toast.error("Failed to load POS history");
    } finally {
      setReceiptsLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await Promise.all([fetchMedicines(), fetchPosReceipts()]);
      setLoading(false);
    };

    loadInitialData();
  }, []);

  const filteredMedicines = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return medicines;
    return medicines.filter((m) =>
      (m?.name || "").toLowerCase().includes(term),
    );
  }, [medicines, searchTerm]);

  const selectedMedicine = useMemo(
    () => medicines.find((m) => String(m.id) === String(form.medicineId)),
    [medicines, form.medicineId],
  );

  const quantity = Number.parseInt(form.quantity || "0", 10) || 0;
  const unitPrice = Number.parseFloat(form.unitPrice || "0") || 0;
  const total = quantity * unitPrice;

  const receiptSummary = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);

    return posReceipts.reduce(
      (acc, item) => {
        const amount = Number.parseFloat(item?.total_amount || 0) || 0;
        const createdAt = item?.created_at || "";

        acc.totalRevenue += amount;
        acc.totalTransactions += 1;
        if (createdAt.slice(0, 10) === todayKey) {
          acc.todayRevenue += amount;
          acc.todayTransactions += 1;
        }

        return acc;
      },
      {
        todayRevenue: 0,
        totalRevenue: 0,
        totalTransactions: 0,
        todayTransactions: 0,
      },
    );
  }, [posReceipts]);

  const recentReceipts = useMemo(() => posReceipts.slice(0, 10), [posReceipts]);

  const medicineOptions = filteredMedicines.map((m) => ({
    value: String(m.id),
    label: `${m.name} (Stock: ${m.quantity || 0})`,
  }));

  const handleMedicineChange = (value) => {
    const med = medicines.find((m) => String(m.id) === String(value));
    setForm((prev) => ({
      ...prev,
      medicineId: value,
      unitPrice: String(med?.selling_price || 0),
    }));
  };

  const handleCompleteSale = async () => {
    if (!form.medicineId) return toast.error("Select a medicine");
    if (quantity <= 0) return toast.error("Enter a valid quantity");
    if (!selectedMedicine) return toast.error("Medicine not found");

    const currentStock = Number(selectedMedicine.quantity || 0);
    if (quantity > currentStock) {
      return toast.error("Not enough stock for this sale");
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post("/pos-receipts/", {
        medicine_id: selectedMedicine.id,
        quantity,
        unit_price: unitPrice,
        customer_name: form.customerName || "Walk-in Customer",
        payment_method: "cash",
      });

      const receipt = {
        receiptNo: data?.receipt_number || `POS-${Date.now()}`,
        date: data?.created_at
          ? new Date(data.created_at).toLocaleString()
          : new Date().toLocaleString(),
        customerName:
          data?.customer_name || form.customerName || "Walk-in Customer",
        cashier: data?.cashier_name || "Pharmacy POS",
        hospitalName,
        medicineName: data?.medicine_name || selectedMedicine.name,
        quantity: Number(data?.quantity || quantity),
        unitPrice: Number(data?.unit_price || unitPrice),
        total: Number(data?.total_amount || total),
      };
      setLastReceipt(receipt);
      printPosReceipt(receipt);

      toast.success(
        `Sale completed: SSP ${Number(data?.total_amount || total).toLocaleString()}`,
      );
      setForm({
        medicineId: "",
        quantity: "1",
        unitPrice: "0",
        customerName: "Walk-in Customer",
      });
      setSearchTerm("");
      await Promise.all([fetchMedicines(), fetchPosReceipts()]);
    } catch {
      toast.error("Failed to complete sale");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReprintFromHistory = (item) => {
    const receipt = {
      receiptNo: item?.receipt_number || `POS-${item?.id || Date.now()}`,
      date: item?.created_at
        ? new Date(item.created_at).toLocaleString()
        : new Date().toLocaleString(),
      customerName: item?.customer_name || "Walk-in Customer",
      cashier: item?.cashier_name || "Pharmacy POS",
      hospitalName,
      medicineName: item?.medicine_name || "Medicine",
      quantity: Number(item?.quantity || 0),
      unitPrice: Number(item?.unit_price || 0),
      total: Number(item?.total_amount || 0),
    };

    setLastReceipt(receipt);
    printPosReceipt(receipt);
  };

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => router.push("/pharmacy")}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pharmacy POS</h1>
              <p className="text-sm text-gray-500">
                Quick walk-in drug sales and stock deduction.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            icon={Printer}
            onClick={() => lastReceipt && printPosReceipt(lastReceipt)}
            disabled={!lastReceipt}
          >
            Print Last Receipt
          </Button>
        </div>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-5 w-5 text-orange-600" />
            <h2 className="font-semibold">New Sale</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Search Medicine"
              placeholder="Type medicine name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              label="Medicine"
              value={form.medicineId}
              onChange={(e) => handleMedicineChange(e.target.value)}
              options={[
                { value: "", label: "Select medicine..." },
                ...medicineOptions,
              ]}
            />
            <Input
              label="Customer"
              value={form.customerName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, customerName: e.target.value }))
              }
            />
            <Input
              label="Quantity"
              type="number"
              value={form.quantity}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, quantity: e.target.value }))
              }
            />
            <Input
              label="Unit Price (SSP)"
              type="number"
              value={form.unitPrice}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, unitPrice: e.target.value }))
              }
            />
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-xs text-gray-500">Current Stock</p>
              <p className="text-lg font-semibold text-gray-900">
                {selectedMedicine ? selectedMedicine.quantity || 0 : 0}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-lg bg-orange-50 border border-orange-100 p-4">
            <div>
              <p className="text-sm text-gray-600">Sale Total</p>
              <p className="text-2xl font-bold text-orange-700">
                SSP {total.toLocaleString()}
              </p>
            </div>
            <Button onClick={handleCompleteSale} isLoading={submitting}>
              Complete Sale
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-500">Today POS Revenue</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              SSP {receiptSummary.todayRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {receiptSummary.todayTransactions} transactions
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Total POS Revenue</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              SSP {receiptSummary.totalRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {receiptSummary.totalTransactions} receipts
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Latest Receipt</p>
            <p className="text-lg font-semibold text-gray-900 mt-1 truncate">
              {posReceipts[0]?.receipt_number || "No receipt yet"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {posReceipts[0]?.created_at
                ? new Date(posReceipts[0].created_at).toLocaleString()
                : "-"}
            </p>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">POS History</h2>
            <Button
              variant="outline"
              onClick={fetchPosReceipts}
              isLoading={receiptsLoading}
            >
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3">Receipt</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Medicine</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2">Cashier</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentReceipts.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 text-gray-700"
                  >
                    <td className="py-2 pr-3 font-medium">
                      {item.receipt_number}
                    </td>
                    <td className="py-2 pr-3">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="py-2 pr-3">{item.medicine_name || "-"}</td>
                    <td className="py-2 pr-3">
                      {item.customer_name || "Walk-in Customer"}
                    </td>
                    <td className="py-2 pr-3">{item.quantity || 0}</td>
                    <td className="py-2 pr-3">
                      SSP {Number(item.total_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-2">
                      {item.cashier_name || "Pharmacy POS"}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Printer}
                        onClick={() => handleReprintFromHistory(item)}
                        title={`Reprint ${item.receipt_number || "receipt"}`}
                        aria-label={`Reprint ${item.receipt_number || "receipt"}`}
                      />
                    </td>
                  </tr>
                ))}
                {!recentReceipts.length && !receiptsLoading && (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={8}>
                      No POS history yet.
                    </td>
                  </tr>
                )}
                {receiptsLoading && (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={8}>
                      Loading POS history...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
