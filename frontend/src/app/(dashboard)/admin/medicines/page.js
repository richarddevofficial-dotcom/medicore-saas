"use client";

import { useState, useRef } from "react";
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
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { useMedicines } from "@/hooks/usePharmacy";
import {
  exportToExcel,
  parseExcelFile,
  downloadTemplate,
} from "@/lib/excelUtils";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

const emptyForm = {
  name: "",
  category: "General",
  form: "tablet",
  strength: "",
  quantity: "0",
  reorder_level: "10",
  unit_price: "0",
  selling_price: "0",
  batch_number: "",
  expiry_date: "",
  manufacturer: "",
};

export default function MedicinesPage() {
  const { data: medicines, isLoading, refetch } = useMedicines();
  const [showModal, setShowModal] = useState(false);
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const urlFilter = (searchParams.get("filter") || "").toLowerCase();

  const items = Array.isArray(medicines) ? medicines : [];

  const formatCurrency = (value) => {
    const amount = Number.parseFloat(value ?? 0);
    return `SSP ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };
  const openEdit = (med) => {
    setEditing(med);
    setForm({
      name: med.name || "",
      category: med.category || "General",
      form: med.form || "tablet",
      strength: med.strength || "",
      quantity: String(med.quantity || 0),
      reorder_level: String(med.reorder_level || 10),
      unit_price: String(med.unit_price || 0),
      selling_price: String(med.selling_price || 0),
      batch_number: med.batch_number || "",
      expiry_date: med.expiry_date || "",
      manufacturer: med.manufacturer || "",
    });
    setShowModal(true);
  };

  const saveMedicine = async () => {
    if (!form.name) return toast.error("Name required");
    setIsSaving(true);
    try {
      const parsedCategoryId = Number(form.category);
      const payload = {
        name: form.name,
        generic_name: form.name,
        form: form.form,
        strength: form.strength,
        quantity: parseInt(form.quantity || "0", 10),
        reorder_level: parseInt(form.reorder_level || "10", 10),
        cost_price: form.unit_price || form.selling_price || "0",
        selling_price: form.selling_price || "0",
        batch_number: form.batch_number,
        expiry_date: form.expiry_date || null,
        manufacturer: form.manufacturer,
      };

      // Backend expects `category` as FK id, not free text.
      if (Number.isInteger(parsedCategoryId) && parsedCategoryId > 0) {
        payload.category = parsedCategoryId;
      }

      if (editing) {
        await apiClient.patch(`/medicines/${editing.id}/`, payload);
        toast.success("Updated!");
      } else {
        await apiClient.post("/medicines/", payload);
        toast.success("Added!");
      }
      setShowModal(false);
      refetch();
    } catch (err) {
      const apiError = err?.response?.data;
      const firstError =
        typeof apiError === "string"
          ? apiError
          : apiError?.detail ||
            Object.values(apiError || {})
              .flat()
              .find(Boolean);
      toast.error(firstError || "Failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/medicines/${deleteTarget.id}/`);
      toast.success("Deleted!");
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error("Failed");
    }
  };

  // Export
  const handleExport = () => {
    if (items.length === 0) return toast.error("No data to export");
    exportToExcel(
      items,
      `medicines_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Exported successfully!");
  };

  // Import
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const data = await parseExcelFile(file);
      const { data: response } = await apiClient.post(
        "/medicines/bulk_import/",
        { medicines: data },
      );
      const created = Number(response?.created || 0);
      const updated = Number(response?.updated || 0);
      const failed = Array.isArray(response?.errors)
        ? response.errors.length
        : 0;
      toast.success(
        `Import complete: ${created} created, ${updated} updated${failed ? `, ${failed} failed` : ""}.`,
      );
      refetch();
    } catch (err) {
      toast.error("Import failed. Check file format.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = items
    .filter((m) => {
      if (urlFilter !== "expiring_soon") return true;
      if (!m?.expiry_date) return false;
      const expiry = new Date(m.expiry_date);
      if (Number.isNaN(expiry.getTime())) return false;
      const now = new Date();
      const within30 = new Date();
      within30.setDate(now.getDate() + 30);
      return expiry >= now && expiry <= within30;
    })
    .filter((m) => m.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <AdminBackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Pharmacy / Medicines
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {items.length} medicines in inventory
              </p>
              {urlFilter === "expiring_soon" && (
                <p className="text-xs text-amber-600 mt-1">
                  Filter active: Expiring within 30 days
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={Download}
              onClick={downloadTemplate}
            >
              Template
            </Button>
            <Button
              variant="outline"
              icon={FileSpreadsheet}
              onClick={handleExport}
              disabled={items.length === 0}
            >
              Export
            </Button>
            <label className="cursor-pointer">
              <Button
                variant="outline"
                icon={Upload}
                onClick={() => fileInputRef.current?.click()}
                isLoading={isImporting}
              >
                Import
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
            </label>
            <Button icon={Plus} onClick={openAdd}>
              Add Medicine
            </Button>
          </div>
        </div>

        {/* Search */}
        <Input
          placeholder="Search medicines..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Table */}
        <Card padding={false}>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Form
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Stock
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Expiry
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((med) => (
                    <tr key={med.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{med.name}</p>
                        {med.strength && (
                          <p className="text-xs text-gray-400">
                            {med.strength}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {med.category || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="info">{med.form}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            med.quantity <= med.reorder_level
                              ? "text-red-600 font-bold"
                              : "text-green-600"
                          }
                        >
                          {med.quantity}
                        </span>
                        {med.quantity <= med.reorder_level && (
                          <span className="ml-1 text-xs text-red-500">
                            ⚠️ Low
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {formatCurrency(med.selling_price)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {med.expiry_date || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(med)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(med)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded ml-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-gray-500"
                      >
                        <EmptyState
                          imageSrc="/images/empty-states/pharmacy-empty.svg"
                          imageAlt="No medicines"
                          title="No medicines found"
                          className="py-2 px-0"
                          titleClassName="text-sm font-normal text-gray-500 mb-0"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Add/Edit Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editing ? "Edit Medicine" : "Add Medicine"}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={saveMedicine} isLoading={isSaving}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
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
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Quantity"
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <Input
                label="Selling Price (SSP)"
                type="number"
                value={form.selling_price}
                onChange={(e) =>
                  setForm({ ...form, selling_price: e.target.value })
                }
              />
              <Input
                label="Reorder Level"
                type="number"
                value={form.reorder_level}
                onChange={(e) =>
                  setForm({ ...form, reorder_level: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Batch #"
                value={form.batch_number}
                onChange={(e) =>
                  setForm({ ...form, batch_number: e.target.value })
                }
              />
              <Input
                label="Expiry Date"
                type="date"
                value={form.expiry_date}
                onChange={(e) =>
                  setForm({ ...form, expiry_date: e.target.value })
                }
              />
            </div>
            <Input
              label="Manufacturer"
              value={form.manufacturer}
              onChange={(e) =>
                setForm({ ...form, manufacturer: e.target.value })
              }
            />
          </div>
        </Modal>

        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete"
          message={`Delete ${deleteTarget?.name}?`}
          confirmLabel="Delete"
          variant="danger"
        />
      </div>
    </DashboardLayout>
  );
}
