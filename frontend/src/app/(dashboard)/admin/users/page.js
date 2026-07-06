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
  useDeleteStaff,
  useToggleStaffStatus,
  useUpdateStaffRole,
} from "@/hooks/useStaff";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  Power,
  PowerOff,
  Search,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";

const roleColors = {
  admin: "danger",
  doctor: "success",
  nurse: "info",
  receptionist: "warning",
  pharmacist: "default",
  lab_technician: "default",
  radiographer: "default",
  accountant: "default",
};

const roleOptions = [
  { value: "admin", label: "Administrator" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "lab_technician", label: "Lab Technician" },
  { value: "radiographer", label: "Radiographer" },
  { value: "accountant", label: "Accountant" },
];

export default function ManageUsersPage() {
  const router = useRouter();
  const { data: staffData, isLoading } = useStaff();
  const createStaff = useCreateStaff();
  const deleteStaff = useDeleteStaff();
  const toggleStatus = useToggleStaffStatus();
  const updateRole = useUpdateStaffRole();

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [newRole, setNewRole] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "receptionist",
    phone: "",
  });

  const staff = staffData?.results || [];

  const filteredStaff = staff.filter((s) => {
    const search = searchTerm.toLowerCase();
    const name =
      `${s.user?.first_name || ""} ${s.user?.last_name || ""}`.toLowerCase();
    return (
      name.includes(search) ||
      (s.user?.email || "").toLowerCase().includes(search) ||
      (s.role || "").toLowerCase().includes(search)
    );
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      toast.error("Please fill all required fields");
      return;
    }
    await createStaff.mutateAsync(form);
    setShowAddModal(false);
    setForm({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      role: "receptionist",
      phone: "",
    });
  };

  const handleToggleStatus = (staffMember) => {
    toggleStatus.mutate(staffMember.id);
  };

  const handleEditRole = (staffMember) => {
    setEditUser(staffMember);
    setNewRole(staffMember.role);
    setShowEditRoleModal(true);
  };

  const handleUpdateRole = async () => {
    if (editUser && newRole && newRole !== editUser.role) {
      await updateRole.mutateAsync({ id: editUser.id, role: newRole });
      setShowEditRoleModal(false);
      setEditUser(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => router.push("/admin")}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
              <p className="text-sm text-gray-500 mt-1">{staff.length} users</p>
            </div>
          </div>
          <Button icon={UserPlus} onClick={() => setShowAddModal(true)}>
            Add User
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
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
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Role
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
                  {filteredStaff.map((s) => (
                    <tr key={s.id} className={!s.is_active ? "opacity-60" : ""}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-orange-700">
                              {s.user?.first_name?.[0]}
                              {s.user?.last_name?.[0]}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {s.user?.first_name} {s.user?.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.user?.email}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={roleColors[s.role] || "default"}>
                            {s.role}
                          </Badge>
                          <button
                            onClick={() => handleEditRole(s)}
                            className="p-1 text-gray-400 hover:text-orange-600 rounded"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.is_active ? "success" : "danger"}>
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleToggleStatus(s)}
                            className={`p-2 rounded ${s.is_active ? "text-orange-600 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`}
                          >
                            {s.is_active ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteId(s.id)}
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

        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add User"
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} isLoading={createStaff.isPending}>
                Add User
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
              label="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              options={roleOptions}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </form>
        </Modal>

        <Modal
          isOpen={showEditRoleModal}
          onClose={() => setShowEditRoleModal(false)}
          title={`Change Role: ${editUser?.user?.first_name} ${editUser?.user?.last_name}`}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowEditRoleModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateRole}
                disabled={newRole === editUser?.role}
              >
                Update
              </Button>
            </>
          }
        >
          <Select
            label="New Role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            options={roleOptions}
          />
        </Modal>

        <ConfirmDialog
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={() => {
            deleteStaff.mutate(deleteId);
            setDeleteId(null);
          }}
          title="Remove User"
          message="Are you sure?"
          confirmLabel="Remove"
          variant="danger"
        />
      </div>
    </DashboardLayout>
  );
}
