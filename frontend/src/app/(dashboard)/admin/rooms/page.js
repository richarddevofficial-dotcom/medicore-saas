"use client";

import { useState } from "react";
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
import { useWards } from "@/hooks/useRooms";
import { Plus, Bed, Building2, Home, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

const emptyWard = { name: "", ward_type: "general", floor: "1" };
const emptyRoom = {
  room_number: "",
  ward: "",
  room_type: "general",
  capacity: "2",
  price_per_day: "500",
};
const emptyBed = { bed_number: "", room: "", bed_type: "standard" };

export default function RoomsPage() {
  const { data: wardsData, isLoading, refetch } = useWards();
  const [activeTab, setActiveTab] = useState("wards");
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [showWardModal, setShowWardModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const [editingWard, setEditingWard] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingBed, setEditingBed] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [wardForm, setWardForm] = useState(emptyWard);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [bedForm, setBedForm] = useState(emptyBed);

  const formatCurrency = (value) => {
    const amount = Number.parseFloat(value ?? 0);
    return `SSP ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
  };

  const wards = Array.isArray(wardsData) ? wardsData : wardsData?.results || [];

  // ====== WARD CRUD ======
  const openAddWard = () => {
    setEditingWard(null);
    setWardForm(emptyWard);
    setShowWardModal(true);
  };
  const openEditWard = (ward) => {
    setEditingWard(ward);
    setWardForm({
      name: ward.name,
      ward_type: ward.ward_type,
      floor: String(ward.floor),
    });
    setShowWardModal(true);
  };

  const saveWard = async () => {
    if (!wardForm.name) return toast.error("Name required");
    setIsSaving(true);
    try {
      if (editingWard) {
        await apiClient.patch(`/wards/${editingWard.id}/`, wardForm);
        toast.success("Ward updated!");
      } else {
        await apiClient.post("/wards/", wardForm);
        toast.success("Ward added!");
      }
      setShowWardModal(false);
      refetch();
    } catch (err) {
      toast.error("Failed to save ward");
    } finally {
      setIsSaving(false);
    }
  };

  // ====== ROOM CRUD ======
  const openAddRoom = () => {
    setEditingRoom(null);
    setRoomForm(emptyRoom);
    setShowRoomModal(true);
  };
  const openEditRoom = (room) => {
    setEditingRoom(room);
    setRoomForm({
      room_number: room.room_number,
      ward: String(room.ward),
      room_type: room.room_type,
      capacity: String(room.capacity),
      price_per_day: String(room.price_per_day),
    });
    setShowRoomModal(true);
  };

  const saveRoom = async () => {
    if (!roomForm.room_number || !roomForm.ward)
      return toast.error("Room number and ward required");
    setIsSaving(true);
    try {
      const payload = {
        ...roomForm,
        ward: parseInt(roomForm.ward),
        capacity: parseInt(roomForm.capacity),
      };
      if (editingRoom) {
        await apiClient.patch(`/rooms/${editingRoom.id}/`, payload);
        toast.success("Room updated!");
      } else {
        await apiClient.post("/rooms/", payload);
        toast.success("Room added!");
      }
      setShowRoomModal(false);
      refetch();
    } catch (err) {
      toast.error("Failed to save room");
    } finally {
      setIsSaving(false);
    }
  };

  // ====== BED CRUD ======
  const openAddBed = () => {
    setEditingBed(null);
    setBedForm(emptyBed);
    setShowBedModal(true);
  };
  const openEditBed = (bed) => {
    setEditingBed(bed);
    setBedForm({
      bed_number: bed.bed_number,
      room: String(bed.room),
      bed_type: bed.bed_type,
    });
    setShowBedModal(true);
  };

  const saveBed = async () => {
    if (!bedForm.bed_number || !bedForm.room)
      return toast.error("Bed number and room required");
    setIsSaving(true);
    try {
      const payload = { ...bedForm, room: parseInt(bedForm.room) };
      if (editingBed) {
        await apiClient.patch(`/beds/${editingBed.id}/`, payload);
        toast.success("Bed updated!");
      } else {
        await apiClient.post("/beds/", payload);
        toast.success("Bed added!");
      }
      setShowBedModal(false);
      refetch();
    } catch (err) {
      toast.error("Failed to save bed");
    } finally {
      setIsSaving(false);
    }
  };

  // ====== DELETE ======
  const confirmDelete = (type, item) => {
    setDeleteTarget({
      type,
      id: item.id,
      name: item.name || item.room_number || item.bed_number,
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await apiClient.delete(`/${deleteTarget.type}/${deleteTarget.id}/`);
      toast.success(`${deleteTarget.type} deleted!`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error("Failed to delete");
    } finally {
      setIsSaving(false);
    }
  };

  // ====== HELPERS ======
  const wardOptions = wards.map((w) => ({
    value: w.id,
    label: `${w.name} (Floor ${w.floor})`,
  }));

  const getAllRooms = () =>
    wards.flatMap((w) =>
      (w.rooms || []).map((r) => ({ ...r, ward_name: w.name, ward_id: w.id })),
    );
  const getAllBeds = () =>
    getAllRooms().flatMap((r) =>
      (r.beds || []).map((b) => ({
        ...b,
        room_number: r.room_number,
        ward_name: r.ward_name,
      })),
    );

  const roomOptions = getAllRooms().map((r) => ({
    value: r.id,
    label: `Room ${r.room_number} (${r.ward_name})`,
  }));

  const totalRooms = getAllRooms().length;
  const totalBeds = getAllBeds().length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { id: "wards", label: `Wards (${wards.length})` },
    { id: "rooms", label: `Rooms (${totalRooms})` },
    { id: "beds", label: `Beds (${totalBeds})` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AdminBackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Rooms & Wards
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {wards.length} wards • {totalRooms} rooms • {totalBeds} beds
              </p>
            </div>
          </div>
          {activeTab === "wards" && (
            <Button icon={Plus} onClick={openAddWard}>
              Add Ward
            </Button>
          )}
          {activeTab === "rooms" && (
            <Button icon={Plus} onClick={openAddRoom}>
              Add Room
            </Button>
          )}
          {activeTab === "beds" && (
            <Button icon={Plus} onClick={openAddBed}>
              Add Bed
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== WARDS ===== */}
        {activeTab === "wards" &&
          (wards.length === 0 ? (
            <Card>
              <EmptyState
                icon={Building2}
                title="No wards yet"
                description={null}
                className="py-12"
                titleClassName="text-base font-medium text-gray-500 mb-4"
                actionLabel="Add Ward"
                onAction={openAddWard}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wards.map((ward) => (
                <Card key={ward.id} className="relative hover:shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <Badge
                      variant={
                        ["icu", "emergency"].includes(ward.ward_type)
                          ? "danger"
                          : "success"
                      }
                    >
                      {ward.ward_type}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {ward.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Floor {ward.floor} • {ward.rooms?.length || 0} rooms
                  </p>

                  {/* Actions */}
                  <div className="absolute top-3 right-3 flex gap-1">
                    <button
                      onClick={() => openEditWard(ward)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => confirmDelete("wards", ward)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ))}

        {/* ===== ROOMS ===== */}
        {activeTab === "rooms" && (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Room #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ward
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Beds
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getAllRooms().map((room) => (
                    <tr key={room.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">
                        {room.room_number}
                      </td>
                      <td className="px-4 py-3 text-sm">{room.ward_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="info">{room.room_type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {room.capacity} beds
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {formatCurrency(room.price_per_day)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() =>
                            openEditRoom({ ...room, ward: room.ward_id })
                          }
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => confirmDelete("rooms", room)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded ml-1"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {getAllRooms().length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-gray-500"
                      >
                        <EmptyState
                          imageSrc="/images/empty-states/appointments-empty.svg"
                          imageAlt="No rooms"
                          title="No rooms yet"
                          className="py-2 px-0"
                          titleClassName="text-sm font-normal text-gray-500 mb-0"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ===== BEDS ===== */}
        {activeTab === "beds" && (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Bed #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Room
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ward
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
                  {getAllBeds().map((bed) => (
                    <tr key={bed.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">
                        {bed.bed_number}
                      </td>
                      <td className="px-4 py-3 text-sm">{bed.room_number}</td>
                      <td className="px-4 py-3 text-sm">{bed.ward_name}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            bed.status === "available"
                              ? "success"
                              : bed.status === "occupied"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {bed.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() =>
                            openEditBed({ ...bed, room: bed.room })
                          }
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => confirmDelete("beds", bed)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded ml-1"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {getAllBeds().length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-8 text-gray-500"
                      >
                        <EmptyState
                          imageSrc="/images/empty-states/appointments-empty.svg"
                          imageAlt="No beds"
                          title="No beds yet"
                          className="py-2 px-0"
                          titleClassName="text-sm font-normal text-gray-500 mb-0"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ===== WARD MODAL ===== */}
        <Modal
          isOpen={showWardModal}
          onClose={() => setShowWardModal(false)}
          title={editingWard ? "Edit Ward" : "Add Ward"}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowWardModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveWard} isLoading={isSaving}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Ward Name *"
              value={wardForm.name}
              onChange={(e) =>
                setWardForm({ ...wardForm, name: e.target.value })
              }
            />
            <Select
              label="Ward Type"
              value={wardForm.ward_type}
              onChange={(e) =>
                setWardForm({ ...wardForm, ward_type: e.target.value })
              }
              options={[
                { value: "general", label: "General" },
                { value: "private", label: "Private" },
                { value: "icu", label: "ICU" },
                { value: "maternity", label: "Maternity" },
                { value: "emergency", label: "Emergency" },
              ]}
            />
            <Input
              label="Floor"
              type="number"
              value={wardForm.floor}
              onChange={(e) =>
                setWardForm({ ...wardForm, floor: e.target.value })
              }
            />
          </div>
        </Modal>

        {/* ===== ROOM MODAL ===== */}
        <Modal
          isOpen={showRoomModal}
          onClose={() => setShowRoomModal(false)}
          title={editingRoom ? "Edit Room" : "Add Room"}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowRoomModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveRoom} isLoading={isSaving}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Room Number *"
              value={roomForm.room_number}
              onChange={(e) =>
                setRoomForm({ ...roomForm, room_number: e.target.value })
              }
            />
            <Select
              label="Ward *"
              value={roomForm.ward}
              onChange={(e) =>
                setRoomForm({ ...roomForm, ward: e.target.value })
              }
              options={[{ value: "", label: "Select ward..." }, ...wardOptions]}
            />
            <Select
              label="Room Type"
              value={roomForm.room_type}
              onChange={(e) =>
                setRoomForm({ ...roomForm, room_type: e.target.value })
              }
              options={[
                { value: "general", label: "General" },
                { value: "private", label: "Private" },
                { value: "deluxe", label: "Deluxe" },
                { value: "icu", label: "ICU" },
              ]}
            />
            <Input
              label="Capacity (beds)"
              type="number"
              value={roomForm.capacity}
              onChange={(e) =>
                setRoomForm({ ...roomForm, capacity: e.target.value })
              }
            />
            <Input
              label="Price/Day (SSP)"
              type="number"
              value={roomForm.price_per_day}
              onChange={(e) =>
                setRoomForm({ ...roomForm, price_per_day: e.target.value })
              }
            />
          </div>
        </Modal>

        {/* ===== BED MODAL ===== */}
        <Modal
          isOpen={showBedModal}
          onClose={() => setShowBedModal(false)}
          title={editingBed ? "Edit Bed" : "Add Bed"}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowBedModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveBed} isLoading={isSaving}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Bed Number *"
              value={bedForm.bed_number}
              onChange={(e) =>
                setBedForm({ ...bedForm, bed_number: e.target.value })
              }
              placeholder="e.g., 101-A"
            />
            <Select
              label="Room *"
              value={bedForm.room}
              onChange={(e) => setBedForm({ ...bedForm, room: e.target.value })}
              options={[{ value: "", label: "Select room..." }, ...roomOptions]}
            />
            <Select
              label="Bed Type"
              value={bedForm.bed_type}
              onChange={(e) =>
                setBedForm({ ...bedForm, bed_type: e.target.value })
              }
              options={[
                { value: "standard", label: "Standard" },
                { value: "electric", label: "Electric" },
                { value: "bariatric", label: "Bariatric" },
              ]}
            />
          </div>
        </Modal>

        {/* ===== DELETE CONFIRMATION ===== */}
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title={`Delete ${deleteTarget?.type?.slice(0, -1)}`}
          message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
          confirmLabel="Delete"
          variant="danger"
          isLoading={isSaving}
        />
      </div>
    </DashboardLayout>
  );
}
