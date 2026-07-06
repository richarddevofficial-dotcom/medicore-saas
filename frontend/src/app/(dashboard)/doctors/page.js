"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import {
  useStaff,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  useToggleStaffStatus,
} from "@/hooks/useStaff";
import { useDepartments } from "@/hooks/useDepartments";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Search,
  Stethoscope,
  Building2,
  Clock,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";

export default function DoctorsPage() {
  const router = useRouter();
  const { data: staffData, isLoading } = useStaff();
  const { data: departments } = useDepartments();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();
  const toggleStatus = useToggleStaffStatus();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDoctor, setEditDoctor] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "doctor",
    department: "",
    specialization: "",
    license_number: "",
    consultation_fee: "",
    max_patients_per_day: "20",
    phone: "",
  });

  const staff = staffData?.results || [];
  const doctors = staff.filter((s) => s.role === "doctor");

  const departmentList = Array.isArray(departments)
    ? departments
    : departments?.results || [];
  const departmentOptions = [
    { value: "", label: "Select department..." },
    ...departmentList.map((dept) => ({ value: dept.id, label: dept.name })),
  ];

  const specializationOptions = [
    { value: "", label: "Select..." },
    { value: "general", label: "General Physician" },
    { value: "cardiology", label: "Cardiology" },
    { value: "neurology", label: "Neurology" },
    { value: "orthopedics", label: "Orthopedics" },
    { value: "pediatrics", label: "Pediatrics" },
    { value: "gynecology", label: "Gynecology" },
  ];

  const filteredDoctors = doctors.filter((doc) => {
    const search = searchTerm.toLowerCase();
    const name =
      `${doc.user?.first_name || ""} ${doc.user?.last_name || ""}`.toLowerCase();
    return (
      name.includes(search) ||
      (doc.specialization || "").toLowerCase().includes(search) ||
      (doc.department_name || "").toLowerCase().includes(search)
    );
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      toast.error("Please fill all required fields");
      return;
    }

    // Build payload - remove empty department
    const payload = { ...form };
    if (!payload.department || payload.department === "") {
      delete payload.department;
    }

    await createStaff.mutateAsync(payload);
    setShowAddModal(false);
    setForm({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      role: "doctor",
      department: "",
      specialization: "",
      license_number: "",
      consultation_fee: "",
      max_patients_per_day: "20",
      phone: "",
    });
  };

  const handleEditClick = (doc) => {
    setEditDoctor({
      id: doc.id,
      first_name: doc.user?.first_name || "",
      last_name: doc.user?.last_name || "",
      email: doc.user?.email || "",
      department: doc.department || "",
      specialization: doc.specialization || "",
      license_number: doc.license_number || "",
      consultation_fee: doc.consultation_fee || "",
      max_patients_per_day: doc.max_patients_per_day || "20",
      phone: doc.phone || "",
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    // Only send fields that can be updated
    const payload = {
      department: editDoctor.department || null,
      specialization: editDoctor.specialization || "",
      license_number: editDoctor.license_number || "",
      consultation_fee: editDoctor.consultation_fee || "0",
      max_patients_per_day: editDoctor.max_patients_per_day || "20",
      phone: editDoctor.phone || "",
    };

    // Remove empty department
    if (!payload.department) delete payload.department;

    await updateStaff.mutateAsync({ id: editDoctor.id, ...payload });
    setShowEditModal(false);
    setEditDoctor(null);
  };

  const handleToggleStatus = (doc) => toggleStatus.mutate(doc.id);

  const activeDoctors = doctors.filter((d) => d.is_active).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => router.push("/admin")}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
              <p className="text-sm text-gray-500 mt-1">
                {doctors.length} doctors • {activeDoctors} active
              </p>
            </div>
          </div>
          <Button icon={Plus} onClick={() => setShowAddModal(true)}>
            Add Doctor
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search doctors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>

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
                      Doctor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Specialization
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDoctors.map((doc) => (
                    <tr
                      key={doc.id}
                      className={`hover:bg-gray-50 ${!doc.is_active ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-green-700">
                              {doc.user?.first_name?.[0]}
                              {doc.user?.last_name?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Dr. {doc.user?.first_name} {doc.user?.last_name}
                            </p>
                            {doc.license_number && (
                              <p className="text-xs text-gray-400">
                                Lic: {doc.license_number}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="primary">
                          {doc.department_name || "Not assigned"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {doc.specialization || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {doc.consultation_fee
                          ? `₹${doc.consultation_fee}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={doc.is_active ? "success" : "danger"}>
                          {doc.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEditClick(doc)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(doc)}
                            className={`p-2 rounded ${doc.is_active ? "text-orange-600 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`}
                          >
                            {doc.is_active ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteId(doc.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
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
          )}
        </Card>

        {/* Add Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Doctor"
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} isLoading={createStaff.isPending}>
                Add Doctor
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
              label="Email *"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Password *"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Select
              label="Department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              options={departmentOptions}
            />
            <Select
              label="Specialization"
              value={form.specialization}
              onChange={(e) =>
                setForm({ ...form, specialization: e.target.value })
              }
              options={specializationOptions}
            />
            <Input
              label="License"
              value={form.license_number}
              onChange={(e) =>
                setForm({ ...form, license_number: e.target.value })
              }
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fee (₹)"
                type="number"
                value={form.consultation_fee}
                onChange={(e) =>
                  setForm({ ...form, consultation_fee: e.target.value })
                }
              />
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Doctor"
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                isLoading={updateStaff.isPending}
              >
                Save Changes
              </Button>
            </>
          }
        >
          {editDoctor && (
            <div className="space-y-4">
              <Select
                label="Department"
                value={editDoctor.department}
                onChange={(e) =>
                  setEditDoctor({ ...editDoctor, department: e.target.value })
                }
                options={departmentOptions}
              />
              <Select
                label="Specialization"
                value={editDoctor.specialization}
                onChange={(e) =>
                  setEditDoctor({
                    ...editDoctor,
                    specialization: e.target.value,
                  })
                }
                options={specializationOptions}
              />
              <Input
                label="License"
                value={editDoctor.license_number}
                onChange={(e) =>
                  setEditDoctor({
                    ...editDoctor,
                    license_number: e.target.value,
                  })
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Fee (₹)"
                  type="number"
                  value={editDoctor.consultation_fee}
                  onChange={(e) =>
                    setEditDoctor({
                      ...editDoctor,
                      consultation_fee: e.target.value,
                    })
                  }
                />
                <Input
                  label="Phone"
                  value={editDoctor.phone}
                  onChange={(e) =>
                    setEditDoctor({ ...editDoctor, phone: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </Modal>

        <ConfirmDialog
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={() => {
            deleteStaff.mutate(deleteId);
            setDeleteId(null);
          }}
          title="Remove Doctor"
          message="Are you sure?"
          confirmLabel="Remove"
          variant="danger"
        />
      </div>
    </DashboardLayout>
  );
}
