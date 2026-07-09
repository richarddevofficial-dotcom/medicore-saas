"use client";

import { useState, useEffect } from "react";
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
  Pencil,
  Trash2,
  Camera,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

const typeColors = {
  xray: "info",
  mri: "purple",
  ct: "warning",
  ultrasound: "success",
  mammogram: "pink",
  other: "default",
};

export default function ImagingPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showResult, setShowResult] = useState(null);
  const [resultText, setResultText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    patient_name: "",
    test_type: "xray",
    body_part: "",
    notes: "",
    price: "",
  });

  const fetchData = async () => {
    try {
      const { data } = await apiClient.get("/imaging-tests/");
      setTests(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!form.patient_name || !form.body_part)
      return toast.error("Patient name and body part required");
    setIsSaving(true);
    try {
      if (editing) {
        await apiClient.patch(`/imaging-tests/${editing.id}/`, form);
        toast.success("Updated!");
      } else {
        await apiClient.post("/imaging-tests/", form);
        toast.success("Added!");
      }
      setShowModal(false);
      setEditing(null);
      setForm({
        patient_name: "",
        test_type: "xray",
        body_part: "",
        notes: "",
        price: "",
      });
      fetchData();
    } catch (err) {
      toast.error("Failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!resultText.trim()) return toast.error("Enter result");
    try {
      // Save to imaging test
      await apiClient.post(`/imaging-tests/${showResult.id}/complete/`, {
        result: resultText,
      });

      // Also update patient status
      if (showResult.patient) {
        await apiClient.post(
          `/patients/${showResult.patient}/complete_imaging/`,
          {
            imaging_results: resultText,
          },
        );
      }

      toast.success("Results saved! Patient status updated.");
      setShowResult(null);
      setResultText("");
      fetchData();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/imaging-tests/${id}/`);
      toast.success("Deleted!");
      fetchData();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const filtered = tests.filter(
    (t) =>
      (t.patient_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.body_part || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const requested = tests.filter((t) => t.status === "requested").length;
  const completed = tests.filter((t) => t.status === "completed").length;

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
              <h1 className="text-2xl font-bold">🖼️ Imaging</h1>
              <p className="text-sm text-gray-500">{tests.length} tests</p>
            </div>
          </div>
          <Button
            icon={Plus}
            onClick={() => {
              setEditing(null);
              setForm({
                patient_name: "",
                test_type: "xray",
                body_part: "",
                notes: "",
                price: "",
              });
              setShowModal(true);
            }}
          >
            Add Test
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="text-center">
            <Camera className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{tests.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </Card>
          <Card className="text-center">
            <Clock className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{requested}</p>
            <p className="text-xs text-gray-500">Requested</p>
          </Card>
          <Card className="text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{completed}</p>
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

        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Patient
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Body Part
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Price
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm font-medium">
                      {t.patient_name}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={typeColors[t.test_type] || "default"}>
                        {t.test_type_display || t.test_type}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-sm">{t.body_part}</td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          t.status === "completed"
                            ? "success"
                            : t.status === "in_progress"
                              ? "info"
                              : "warning"
                        }
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-sm">SSP {t.price}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-center gap-1">
                        {t.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowResult(t);
                              setResultText(t.result || "");
                            }}
                          >
                            Result
                          </Button>
                        )}
                        <button
                          onClick={() => {
                            setEditing(t);
                            setForm({
                              patient_name: t.patient_name,
                              test_type: t.test_type,
                              body_part: t.body_part,
                              notes: t.notes || "",
                              price: t.price || "",
                            });
                            setShowModal(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editing ? "Edit Test" : "Add Imaging Test"}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Patient Name *"
              value={form.patient_name}
              onChange={(e) =>
                setForm({ ...form, patient_name: e.target.value })
              }
            />
            <Select
              label="Test Type *"
              value={form.test_type}
              onChange={(e) => setForm({ ...form, test_type: e.target.value })}
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
              value={form.body_part}
              onChange={(e) => setForm({ ...form, body_part: e.target.value })}
              placeholder="e.g., Chest, Head, Abdomen"
            />
            <Input
              label="Price (SSP)"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <Input
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </Modal>

        <Modal
          isOpen={!!showResult}
          onClose={() => setShowResult(null)}
          title={`Results: ${showResult?.patient_name}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowResult(null)}>
                Close
              </Button>
              {showResult?.status !== "completed" && (
                <Button onClick={handleComplete} isLoading={isSaving}>
                  Save Results
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <p>
              <strong>Test:</strong> {showResult?.test_type_display} -{" "}
              {showResult?.body_part}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Results</label>
              <textarea
                rows={5}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                placeholder="Enter imaging results/findings..."
                readOnly={showResult?.status === "completed"}
              />
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
