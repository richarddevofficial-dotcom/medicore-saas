"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useDoctors } from "@/hooks/useStaff";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  Users,
  Stethoscope,
  Pencil,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import toast from "react-hot-toast";

const initialDepartments = [
  {
    id: 1,
    name: "Cardiology",
    head: "Assigned",
    headId: 1,
    staff: 5,
    rooms: 3,
    status: "active",
  },
  {
    id: 2,
    name: "General Medicine",
    head: "Assigned",
    headId: 2,
    staff: 8,
    rooms: 5,
    status: "active",
  },
  {
    id: 3,
    name: "Pediatrics",
    head: "Assigned",
    headId: 3,
    staff: 4,
    rooms: 2,
    status: "active",
  },
  {
    id: 4,
    name: "Orthopedics",
    head: "Unassigned",
    headId: null,
    staff: 0,
    rooms: 2,
    status: "inactive",
  },
  {
    id: 5,
    name: "Radiology",
    head: "Unassigned",
    headId: null,
    staff: 0,
    rooms: 1,
    status: "inactive",
  },
  {
    id: 6,
    name: "Pathology",
    head: "Unassigned",
    headId: null,
    staff: 0,
    rooms: 1,
    status: "inactive",
  },
  {
    id: 7,
    name: "Emergency",
    head: "Unassigned",
    headId: null,
    staff: 6,
    rooms: 4,
    status: "active",
  },
  {
    id: 8,
    name: "Pharmacy",
    head: "Unassigned",
    headId: null,
    staff: 2,
    rooms: 1,
    status: "active",
  },
];

export default function DepartmentsPage() {
  const router = useRouter();
  const { data: doctors } = useDoctors();
  const [departments, setDepartments] = useState(initialDepartments);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDept, setNewDept] = useState({
    name: "",
    head: "Unassigned",
    headId: "",
    rooms: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Head status options (only Assigned/Unassigned)
  const headOptions = [
    { value: "Assigned", label: "Assigned" },
    { value: "Unassigned", label: "Unassigned" },
  ];

  const handleAdd = () => {
    if (!newDept.name.trim()) {
      toast.error("Department name is required");
      return;
    }
    setDepartments([
      ...departments,
      {
        id: Date.now(),
        name: newDept.name,
        head: newDept.head || "Unassigned",
        headId: null,
        staff: 0,
        rooms: parseInt(newDept.rooms) || 1,
        status: "active",
      },
    ]);
    setShowAddModal(false);
    setNewDept({ name: "", head: "Unassigned", headId: "", rooms: "" });
    toast.success("Department added!");
  };

  const handleEditClick = (dept) => {
    setEditDept({ ...dept });
    setShowEditModal(true);
  };

  const handleEditSave = () => {
    if (!editDept.name.trim()) {
      toast.error("Department name is required");
      return;
    }
    setDepartments(
      departments.map((d) =>
        d.id === editDept.id
          ? {
              ...editDept,
              rooms: parseInt(editDept.rooms) || 1,
              staff: parseInt(editDept.staff) || 0,
            }
          : d,
      ),
    );
    setShowEditModal(false);
    setEditDept(null);
    toast.success("Department updated!");
  };

  const handleToggleStatus = (id) => {
    setDepartments(
      departments.map((d) =>
        d.id === id
          ? { ...d, status: d.status === "active" ? "inactive" : "active" }
          : d,
      ),
    );
    toast.success("Status updated!");
  };

  const handleDeleteClick = (id) => {
    setDeleteId(id);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    setDepartments(departments.filter((d) => d.id !== deleteId));
    setShowDeleteDialog(false);
    setDeleteId(null);
    toast.success("Department removed");
  };

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const activeCount = departments.filter((d) => d.status === "active").length;
  const assignedCount = departments.filter((d) => d.head === "Assigned").length;

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
              <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
              <p className="text-sm text-gray-500 mt-1">
                {departments.length} total • {activeCount} active •{" "}
                {assignedCount} assigned
              </p>
            </div>
          </div>
          <Button icon={Plus} onClick={() => setShowAddModal(true)}>
            Add Department
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((dept) => (
            <Card
              key={dept.id}
              className="relative hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-orange-600" />
                </div>
                <button
                  onClick={() => handleToggleStatus(dept.id)}
                  title="Toggle status"
                >
                  <Badge
                    variant={dept.status === "active" ? "success" : "warning"}
                  >
                    {dept.status}
                  </Badge>
                </button>
              </div>

              <h3 className="font-semibold text-gray-900 text-lg">
                {dept.name}
              </h3>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {dept.head === "Assigned" ? (
                    <UserCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <UserX className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={
                      dept.head === "Assigned"
                        ? "text-green-700 font-medium"
                        : "text-red-500"
                    }
                  >
                    {dept.head}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Users className="h-4 w-4" />
                  <span>{dept.staff} staff</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Building2 className="h-4 w-4" />
                  <span>{dept.rooms} rooms</span>
                </div>
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-1">
                <button
                  onClick={() => handleEditClick(dept)}
                  className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteClick(dept.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>

        {/* Add Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Department"
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAdd}>Add</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Department Name *"
              value={newDept.name}
              onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
            />
            <Select
              label="Department Head"
              value={newDept.head}
              onChange={(e) => setNewDept({ ...newDept, head: e.target.value })}
              options={headOptions}
            />
            <Input
              label="Rooms"
              type="number"
              value={newDept.rooms}
              onChange={(e) =>
                setNewDept({ ...newDept, rooms: e.target.value })
              }
            />
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title={`Edit: ${editDept?.name}`}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleEditSave}>Save</Button>
            </>
          }
        >
          {editDept && (
            <div className="space-y-4">
              <Input
                label="Department Name *"
                value={editDept.name}
                onChange={(e) =>
                  setEditDept({ ...editDept, name: e.target.value })
                }
              />
              <Select
                label="Department Head"
                value={editDept.head}
                onChange={(e) =>
                  setEditDept({ ...editDept, head: e.target.value })
                }
                options={headOptions}
              />
              <Input
                label="Rooms"
                type="number"
                value={editDept.rooms}
                onChange={(e) =>
                  setEditDept({ ...editDept, rooms: e.target.value })
                }
              />
              <Input
                label="Staff Count"
                type="number"
                value={editDept.staff}
                onChange={(e) =>
                  setEditDept({ ...editDept, staff: e.target.value })
                }
              />
            </div>
          )}
        </Modal>

        <ConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Department"
          message="Are you sure?"
          confirmLabel="Delete"
          variant="danger"
        />
      </div>
    </DashboardLayout>
  );
}
