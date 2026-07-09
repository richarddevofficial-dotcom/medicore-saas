"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AdminBackButton from "@/components/ui/AdminBackButton";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import {
  Plus,
  Search,
  TrendingDown,
  AlertTriangle,
  Package,
  DollarSign,
  Download,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import * as XLSX from "xlsx";

export default function InventoryPage() {
  const fileInputRef = useRef(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    form: "tablet",
    strength: "",
    quantity: "0",
    min_stock: "10",
    reorder_level: "20",
    max_stock: "100",
    cost_price: "0",
    selling_price: "0",
    batch_number: "",
    expiry_date: "",
    manufacturer: "",
    supplier: "",
  });

  const fetchData = async () => {
    try {
      const { data } = await apiClient.get("/medicines/");
      const items = data.results || data || [];
      setMedicines(Array.isArray(items) ? items : []);
    } catch (err) {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const urlFilter = (searchParams.get("filter") || "").toLowerCase();
    if (["all", "critical", "low", "normal"].includes(urlFilter)) {
      setFilter(urlFilter);
    }
  }, [searchParams]);

  const handleSave = async () => {
    if (!form.name) return toast.error("Name required");
    try {
      if (editing) {
        await apiClient.patch(`/medicines/${editing.id}/`, form);
        toast.success("Updated!");
      } else {
        await apiClient.post("/medicines/", form);
        toast.success("Added!");
      }
      setShowModal(false);
      setEditing(null);
      setForm({
        name: "",
        category: "",
        form: "tablet",
        strength: "",
        quantity: "0",
        min_stock: "10",
        reorder_level: "20",
        max_stock: "100",
        cost_price: "0",
        selling_price: "0",
        batch_number: "",
        expiry_date: "",
        manufacturer: "",
        supplier: "",
      });
      fetchData();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this item?")) return;
    try {
      await apiClient.delete(`/medicines/${id}/`);
      toast.success("Deleted!");
      fetchData();
    } catch (err) {
      toast.error("Failed");
    }
  };

  // EXPORT
  const handleExport = () => {
    const exportData = medicines.map((m) => ({
      Name: m.name || "",
      Category: m.category_name || m.category || "",
      Form: m.form || "",
      Strength: m.strength || "",
      Quantity: m.quantity || 0,
      "Min Stock": m.min_stock || 10,
      "Reorder Level": m.reorder_level || 20,
      "Max Stock": m.max_stock || 100,
      "Cost Price": m.cost_price || 0,
      "Selling Price": m.selling_price || 0,
      "Batch Number": m.batch_number || "",
      "Expiry Date": m.expiry_date || "",
      Manufacturer: m.manufacturer || "",
      Supplier: m.supplier || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(
      wb,
      `inventory_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Exported!");
  };

  // IMPORT
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws);

        let imported = 0;
        for (const item of jsonData) {
          try {
            await apiClient.post("/medicines/", {
              name: item["Name"] || item.name || "",
              category: item["Category"] || item.category || "",
              form: item["Form"] || item.form || "tablet",
              strength: item["Strength"] || item.strength || "",
              quantity: parseInt(item["Quantity"] || item.quantity || 0),
              min_stock: parseInt(item["Min Stock"] || item.min_stock || 10),
              reorder_level: parseInt(
                item["Reorder Level"] || item.reorder_level || 20,
              ),
              max_stock: parseInt(item["Max Stock"] || item.max_stock || 100),
              cost_price: parseFloat(
                item["Cost Price"] || item.cost_price || 0,
              ),
              selling_price: parseFloat(
                item["Selling Price"] || item.selling_price || 0,
              ),
              batch_number: item["Batch Number"] || item.batch_number || "",
              expiry_date: item["Expiry Date"] || item.expiry_date || null,
              manufacturer: item["Manufacturer"] || item.manufacturer || "",
              supplier: item["Supplier"] || item.supplier || "",
            });
            imported++;
          } catch (err) {}
        }
        toast.success(`${imported} items imported!`);
        fetchData();
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      toast.error("Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  // Download Template
  const downloadTemplate = () => {
    const template = [
      {
        Name: "Paracetamol",
        Category: "Pain Relief",
        Form: "tablet",
        Strength: "500mg",
        Quantity: 100,
        "Min Stock": 10,
        "Reorder Level": 20,
        "Max Stock": 200,
        "Cost Price": 20,
        "Selling Price": 50,
        "Batch Number": "BATCH001",
        "Expiry Date": "2025-12-31",
        Manufacturer: "Pharma Inc",
        Supplier: "MedSupply",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "inventory_template.xlsx");
    toast.success("Template downloaded!");
  };

  const critical = medicines.filter(
    (m) => m.quantity <= (m.min_stock || 10),
  ).length;
  const low = medicines.filter(
    (m) =>
      m.quantity <= (m.reorder_level || 20) && m.quantity > (m.min_stock || 10),
  ).length;
  const totalValue = medicines.reduce(
    (s, m) => s + m.quantity * (m.cost_price || m.selling_price || 0),
    0,
  );

  const filtered = medicines
    .filter((m) => {
      if (filter === "critical") return m.quantity <= (m.min_stock || 10);
      if (filter === "low")
        return (
          m.quantity <= (m.reorder_level || 20) &&
          m.quantity > (m.min_stock || 10)
        );
      if (filter === "normal") return m.quantity > (m.reorder_level || 20);
      return true;
    })
    .filter((m) =>
      (m.name || "").toLowerCase().includes(searchTerm.toLowerCase()),
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
          <div className="flex items-center gap-4">
            <AdminBackButton />
            <div>
              <h1 className="text-2xl font-bold">📦 Inventory Management</h1>
              <p className="text-sm text-gray-500">
                {medicines.length} items | Value: SSP{" "}
                {totalValue.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={FileSpreadsheet}
              onClick={downloadTemplate}
            >
              Template
            </Button>
            <Button variant="outline" icon={Download} onClick={handleExport}>
              Export
            </Button>
            <label className="cursor-pointer">
              <Button
                variant="outline"
                icon={Upload}
                onClick={() => fileInputRef.current?.click()}
                isLoading={importing}
              >
                Import
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".xlsx,.xls"
                className="hidden"
              />
            </label>
            <Button
              icon={Plus}
              onClick={() => {
                setEditing(null);
                setForm({
                  name: "",
                  category: "",
                  form: "tablet",
                  strength: "",
                  quantity: "0",
                  min_stock: "10",
                  reorder_level: "20",
                  max_stock: "100",
                  cost_price: "0",
                  selling_price: "0",
                  batch_number: "",
                  expiry_date: "",
                  manufacturer: "",
                  supplier: "",
                });
                setShowModal(true);
              }}
            >
              Add Item
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="text-center">
            <Package className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{medicines.length}</p>
            <p className="text-xs text-gray-500">Total Items</p>
          </Card>
          <Card className="text-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600">{critical}</p>
            <p className="text-xs text-gray-500">Critical</p>
          </Card>
          <Card className="text-center">
            <TrendingDown className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-600">{low}</p>
            <p className="text-xs text-gray-500">Low Stock</p>
          </Card>
          <Card className="text-center">
            <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              SSP {totalValue.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Stock Value</p>
          </Card>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {[
              { id: "all", label: "All" },
              { id: "critical", label: "🔴 Critical" },
              { id: "low", label: "🟡 Low" },
              { id: "normal", label: "🟢 Normal" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${filter === f.id ? "bg-white shadow-sm" : "text-gray-500"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Item
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stock
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cost
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sell
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Value
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Expiry
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((m) => {
                  const stockValue =
                    m.quantity * (m.cost_price || m.selling_price || 0);
                  const isExpired =
                    m.expiry_date && new Date(m.expiry_date) < new Date();
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td
                        className="px-3 py-3 cursor-pointer"
                        onClick={() => {
                          setEditing(m);
                          setForm({
                            name: m.name,
                            category: m.category_name || "",
                            form: m.form,
                            strength: m.strength || "",
                            quantity: String(m.quantity),
                            min_stock: String(m.min_stock || 10),
                            reorder_level: String(m.reorder_level || 20),
                            max_stock: String(m.max_stock || 100),
                            cost_price: String(m.cost_price || 0),
                            selling_price: String(m.selling_price || 0),
                            batch_number: m.batch_number || "",
                            expiry_date: m.expiry_date || "",
                            manufacturer: m.manufacturer || "",
                            supplier: m.supplier || "",
                          });
                          setShowModal(true);
                        }}
                      >
                        <p className="text-sm font-medium">{m.name}</p>
                        {m.strength && (
                          <p className="text-xs text-gray-400">{m.strength}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {m.category_name || m.category || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`font-bold ${m.quantity <= (m.min_stock || 10) ? "text-red-600" : m.quantity <= (m.reorder_level || 20) ? "text-orange-600" : "text-green-600"}`}
                        >
                          {m.quantity}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        SSP {m.cost_price || 0}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        SSP {m.selling_price || 0}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium">
                        SSP {stockValue.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {m.expiry_date || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {isExpired ? (
                          <Badge variant="danger">Expired</Badge>
                        ) : m.quantity <= (m.min_stock || 10) ? (
                          <Badge variant="danger">Critical</Badge>
                        ) : m.quantity <= (m.reorder_level || 20) ? (
                          <Badge variant="warning">Low</Badge>
                        ) : (
                          <Badge variant="success">Normal</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editing ? "Edit Item" : "Add Item"}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="Strength"
                value={form.strength}
                onChange={(e) => setForm({ ...form, strength: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Select
                label="Form"
                value={form.form}
                onChange={(e) => setForm({ ...form, form: e.target.value })}
                options={[
                  { value: "tablet", label: "Tablet" },
                  { value: "capsule", label: "Capsule" },
                  { value: "syrup", label: "Syrup" },
                  { value: "injection", label: "Injection" },
                ]}
              />
              <Input
                label="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <Input
                label="Batch #"
                value={form.batch_number}
                onChange={(e) =>
                  setForm({ ...form, batch_number: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Input
                label="Quantity"
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <Input
                label="Min Stock"
                type="number"
                value={form.min_stock}
                onChange={(e) =>
                  setForm({ ...form, min_stock: e.target.value })
                }
              />
              <Input
                label="Reorder"
                type="number"
                value={form.reorder_level}
                onChange={(e) =>
                  setForm({ ...form, reorder_level: e.target.value })
                }
              />
              <Input
                label="Max Stock"
                type="number"
                value={form.max_stock}
                onChange={(e) =>
                  setForm({ ...form, max_stock: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Cost Price (SSP)"
                type="number"
                value={form.cost_price}
                onChange={(e) =>
                  setForm({ ...form, cost_price: e.target.value })
                }
              />
              <Input
                label="Selling Price (SSP)"
                type="number"
                value={form.selling_price}
                onChange={(e) =>
                  setForm({ ...form, selling_price: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Expiry Date"
                type="date"
                value={form.expiry_date}
                onChange={(e) =>
                  setForm({ ...form, expiry_date: e.target.value })
                }
              />
              <Input
                label="Manufacturer"
                value={form.manufacturer}
                onChange={(e) =>
                  setForm({ ...form, manufacturer: e.target.value })
                }
              />
            </div>
            <Input
              label="Supplier"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
