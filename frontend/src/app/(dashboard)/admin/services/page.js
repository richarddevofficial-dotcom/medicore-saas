"use client";

import { useEffect, useRef, useState } from "react";
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
import { exportToExcel, parseExcelFile } from "@/lib/excelUtils";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  Receipt,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

const emptyForm = {
  name: "",
  service_type: "other",
  code: "",
  price: "0",
  is_active: "true",
  notes: "",
};

const serviceTypeOptions = [
  { value: "consultation", label: "Consultation" },
  { value: "lab", label: "Lab" },
  { value: "other", label: "Other" },
];

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["true", "1", "yes", "y", "active"].includes(normalized);
};

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  const fetchServices = async () => {
    try {
      const { data } = await apiClient.get("/services/");
      setServices(data.results || data || []);
    } catch (err) {
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (service) => {
    setEditing(service);
    setForm({
      name: service.name || "",
      service_type: service.service_type || "other",
      code: service.code || "",
      price: String(service.price || 0),
      is_active: service.is_active ? "true" : "false",
      notes: service.notes || "",
    });
    setShowModal(true);
  };

  const saveService = async () => {
    if (!form.name.trim()) return toast.error("Service name is required");
    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      service_type: form.service_type,
      code: form.code.trim(),
      price: parseFloat(form.price || 0),
      is_active: normalizeBoolean(form.is_active),
      notes: form.notes.trim(),
    };

    try {
      if (editing) {
        await apiClient.patch(`/services/${editing.id}/`, payload);
        toast.success("Service updated");
      } else {
        await apiClient.post("/services/", payload);
        toast.success("Service added");
      }
      setShowModal(false);
      fetchServices();
    } catch (err) {
      const apiError = err?.response?.data;
      const firstError =
        typeof apiError === "string"
          ? apiError
          : apiError?.detail ||
            Object.values(apiError || {})
              .flat()
              .find(Boolean);
      toast.error(firstError || "Failed to save service");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/services/${deleteTarget.id}/`);
      toast.success("Service deleted");
      setDeleteTarget(null);
      fetchServices();
    } catch (err) {
      toast.error("Failed to delete service");
    }
  };

  const handleExport = () => {
    if (!services.length) return toast.error("No service data to export");
    exportToExcel(
      services,
      `service_catalog_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Service catalog exported");
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        name: "General Consultation",
        service_type: "consultation",
        code: "CONS-001",
        price: 50,
        is_active: true,
        notes: "Default consultation",
      },
      {
        name: "Complete Blood Count",
        service_type: "lab",
        code: "LAB-CBC",
        price: 30,
        is_active: true,
        notes: "Routine hematology",
      },
      {
        name: "ECG",
        service_type: "other",
        code: "SRV-ECG",
        price: 45,
        is_active: true,
        notes: "Cardiac screening",
      },
    ];

    exportToExcel(template, "service_catalog_import_template.xlsx");
    toast.success("Template downloaded");
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const rows = await parseExcelFile(file);
      const normalized = rows.map((row) => ({
        name: row.name || row.Name || "",
        service_type:
          row.service_type ||
          row["service type"] ||
          row.type ||
          row.Type ||
          "other",
        code: row.code || row.Code || "",
        price: row.price || row.Price || row["price (ssp)"] || 0,
        is_active: row.is_active ?? row.active ?? true,
        notes: row.notes || row.Notes || "",
      }));

      const { data } = await apiClient.post("/services/bulk_import/", {
        services: normalized,
      });

      const created = Number(data?.created || 0);
      const updated = Number(data?.updated || 0);
      const failed = Array.isArray(data?.errors) ? data.errors.length : 0;

      toast.success(
        `Import complete: ${created} created, ${updated} updated${failed ? `, ${failed} failed` : ""}`,
      );
      fetchServices();
    } catch (err) {
      toast.error("Import failed. Please check the file format.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = services.filter((service) => {
    const term = searchTerm.toLowerCase();
    return (
      service.name?.toLowerCase().includes(term) ||
      service.code?.toLowerCase().includes(term) ||
      service.service_type?.toLowerCase().includes(term)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <AdminBackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Service Catalog
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {services.length} services configured
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={Download}
              onClick={handleDownloadTemplate}
            >
              Template
            </Button>
            <Button
              variant="outline"
              icon={FileSpreadsheet}
              onClick={handleExport}
              disabled={!services.length}
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
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
            </label>
            <Button icon={Plus} onClick={openAdd}>
              Add Service
            </Button>
          </div>
        </div>

        <Input
          placeholder="Search by name, code, or type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <Card padding={false}>
          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Price (SSP)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((service) => (
                    <tr key={service.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {service.name}
                        </p>
                        {service.notes && (
                          <p className="text-xs text-gray-500 mt-1">
                            {service.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            service.service_type === "lab"
                              ? "warning"
                              : service.service_type === "consultation"
                                ? "info"
                                : "default"
                          }
                        >
                          {service.service_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {service.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {Number(service.price || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={service.is_active ? "success" : "danger"}
                        >
                          {service.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(service)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(service)}
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
                        colSpan={6}
                        className="text-center py-8 text-gray-500"
                      >
                        <EmptyState
                          imageSrc="/images/empty-states/billing-empty.svg"
                          imageAlt="No services"
                          title="No services found"
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

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editing ? "Edit Service" : "Add Service"}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={saveService} isLoading={isSaving}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Service Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Service Type"
                value={form.service_type}
                onChange={(e) =>
                  setForm({ ...form, service_type: e.target.value })
                }
                options={serviceTypeOptions}
              />
              <Input
                label="Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Price (SSP)"
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <Select
                label="Status"
                value={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.value })
                }
                options={[
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ]}
              />
            </div>
            <Input
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </Modal>

        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete service"
          message={`Delete ${deleteTarget?.name}?`}
          confirmLabel="Delete"
          variant="danger"
        />
      </div>
    </DashboardLayout>
  );
}
