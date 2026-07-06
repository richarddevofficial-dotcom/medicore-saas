"use client";

import { useState, useEffect } from "react";
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
  ArrowLeft,
  Plus,
  Search,
  Bed,
  Home,
  Building2,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function BedManagementPage() {
  const router = useRouter();
  const [wards, setWards] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("beds");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("bed");
  const [editing, setEditing] = useState(null);

  const [bedForm, setBedForm] = useState({
    bed_number: "",
    room: "",
    bed_type: "standard",
    status: "available",
    price_per_day: "",
  });
  const [wardForm, setWardForm] = useState({
    name: "",
    ward_type: "general",
    floor: "1",
  });
  const [roomForm, setRoomForm] = useState({
    room_number: "",
    ward: "",
    room_type: "general",
    floor: "1",
    capacity: "2",
    price_per_day: "",
  });

  const fetchData = async () => {
    try {
      const [wardRes, roomRes, bedRes] = await Promise.all([
        apiClient.get("/wards/"),
        apiClient.get("/rooms/"),
        apiClient.get("/beds/"),
      ]);
      setWards(wardRes.data.results || wardRes.data || []);
      setRooms(roomRes.data.results || roomRes.data || []);
      setBeds(bedRes.data.results || bedRes.data || []);
    } catch (err) {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      if (modalType === "bed") {
        if (editing) await apiClient.patch(`/beds/${editing.id}/`, bedForm);
        else await apiClient.post("/beds/", bedForm);
      } else if (modalType === "ward") {
        if (editing) await apiClient.patch(`/wards/${editing.id}/`, wardForm);
        else await apiClient.post("/wards/", wardForm);
      } else if (modalType === "room") {
        if (editing) await apiClient.patch(`/rooms/${editing.id}/`, roomForm);
        else await apiClient.post("/rooms/", roomForm);
      }
      toast.success("Saved!");
      setShowModal(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const handleBedStatus = async (bed, newStatus) => {
    try {
      await apiClient.patch(`/beds/${bed.id}/`, { status: newStatus });
      toast.success(`Bed ${newStatus}`);
      fetchData();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const available = beds.filter((b) => b.status === "available").length;
  const occupied = beds.filter((b) => b.status === "occupied").length;
  const reserved = beds.filter((b) => b.status === "reserved").length;
  const maintenance = beds.filter((b) =>
    ["maintenance", "cleaning"].includes(b.status),
  ).length;

  const filteredBeds = beds
    .filter((b) => {
      if (filter === "available") return b.status === "available";
      if (filter === "occupied") return b.status === "occupied";
      if (filter === "reserved") return b.status === "reserved";
      if (filter === "maintenance")
        return ["maintenance", "cleaning"].includes(b.status);
      return true;
    })
    .filter(
      (b) =>
        (b.bed_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.room_number || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (b.ward_name || "").toLowerCase().includes(searchTerm.toLowerCase()),
    );

  if (loading)
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );

  const tabs = [
    { id: "beds", label: "🛏️ Beds", count: beds.length },
    { id: "rooms", label: "🚪 Rooms", count: rooms.length },
    { id: "wards", label: "🏥 Wards", count: wards.length },
  ];

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
              <h1 className="text-2xl font-bold">🛏️ Bed Management</h1>
              <p className="text-sm text-gray-500">
                {beds.length} beds • {available} available • {occupied} occupied
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              icon={Plus}
              onClick={() => {
                setModalType("bed");
                setEditing(null);
                setBedForm({
                  bed_number: "",
                  room: "",
                  bed_type: "standard",
                  status: "available",
                  price_per_day: "",
                });
                setShowModal(true);
              }}
            >
              Add Bed
            </Button>
            <Button
              icon={Plus}
              variant="outline"
              onClick={() => {
                setModalType("room");
                setEditing(null);
                setRoomForm({
                  room_number: "",
                  ward: "",
                  room_type: "general",
                  floor: "1",
                  capacity: "2",
                  price_per_day: "",
                });
                setShowModal(true);
              }}
            >
              Add Room
            </Button>
            <Button
              icon={Plus}
              variant="outline"
              onClick={() => {
                setModalType("ward");
                setEditing(null);
                setWardForm({ name: "", ward_type: "general", floor: "1" });
                setShowModal(true);
              }}
            >
              Add Ward
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="text-center">
            <Bed className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{beds.length}</p>
            <p className="text-xs text-gray-500">Total Beds</p>
          </Card>
          <Card className="text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">{available}</p>
            <p className="text-xs text-gray-500">Available</p>
          </Card>
          <Card className="text-center">
            <Users className="h-6 w-6 text-red-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600">{occupied}</p>
            <p className="text-xs text-gray-500">Occupied</p>
          </Card>
          <Card className="text-center">
            <Clock className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-600">{reserved}</p>
            <p className="text-xs text-gray-500">Reserved</p>
          </Card>
          <Card className="text-center">
            <AlertCircle className="h-6 w-6 text-gray-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{maintenance}</p>
            <p className="text-xs text-gray-500">Maintenance</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === tab.id ? "bg-white shadow-sm" : "text-gray-500"}`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {activeTab === "beds" && (
          <>
            <div className="flex gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search beds..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {[
                  { id: "all", label: "All" },
                  { id: "available", label: "🟢 Available" },
                  { id: "occupied", label: "🔴 Occupied" },
                  { id: "reserved", label: "🟡 Reserved" },
                  { id: "maintenance", label: "⚫ Maint." },
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

            {/* Bed Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredBeds.map((bed) => {
                const statusColors = {
                  available: "bg-green-50 border-green-300 text-green-700",
                  occupied: "bg-red-50 border-red-300 text-red-700",
                  reserved: "bg-yellow-50 border-yellow-300 text-yellow-700",
                  maintenance: "bg-gray-100 border-gray-300 text-gray-500",
                  cleaning: "bg-blue-50 border-blue-300 text-blue-700",
                };
                return (
                  <div
                    key={bed.id}
                    className={`p-3 rounded-lg border-2 text-center cursor-pointer hover:shadow-md transition-shadow ${statusColors[bed.status] || ""}`}
                  >
                    <Bed className="h-6 w-6 mx-auto mb-2" />
                    <p className="text-sm font-bold">{bed.bed_number}</p>
                    <p className="text-xs">{bed.room_number || "N/A"}</p>
                    <Badge
                      variant={
                        bed.status === "available"
                          ? "success"
                          : bed.status === "occupied"
                            ? "danger"
                            : bed.status === "reserved"
                              ? "warning"
                              : "default"
                      }
                      className="mt-1"
                    >
                      {bed.status}
                    </Badge>
                    {bed.status !== "occupied" && (
                      <button
                        onClick={() => handleBedStatus(bed, "occupied")}
                        className="text-xs text-red-600 mt-1 hover:underline"
                      >
                        Occupy
                      </button>
                    )}
                    {bed.status === "occupied" && (
                      <button
                        onClick={() => handleBedStatus(bed, "available")}
                        className="text-xs text-green-600 mt-1 hover:underline"
                      >
                        Release
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "rooms" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <Card key={room.id}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Room {room.room_number}</h3>
                  <Badge variant={room.is_occupied ? "warning" : "success"}>
                    {room.is_occupied ? "Occupied" : "Available"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  Ward: {room.ward_name || "N/A"} | Floor: {room.floor}
                </p>
                <p className="text-sm text-gray-500">
                  Type: {room.room_type} | Capacity: {room.capacity} beds
                </p>
                <p className="text-sm font-medium text-green-600">
                  SSP {room.price_per_day}/day
                </p>
              </Card>
            ))}
          </div>
        )}

        {activeTab === "wards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wards.map((ward) => (
              <Card key={ward.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold">{ward.name}</h3>
                  </div>
                  <Badge variant="info">{ward.ward_type}</Badge>
                </div>
                <p className="text-sm text-gray-500">
                  Floor: {ward.floor} | Rooms: {ward.room_count || 0}
                </p>
              </Card>
            ))}
          </div>
        )}

        {/* Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={`Add ${modalType}`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </>
          }
        >
          {modalType === "bed" && (
            <div className="space-y-3">
              <Input
                label="Bed Number *"
                value={bedForm.bed_number}
                onChange={(e) =>
                  setBedForm({ ...bedForm, bed_number: e.target.value })
                }
              />
              <Select
                label="Room"
                value={bedForm.room}
                onChange={(e) =>
                  setBedForm({ ...bedForm, room: e.target.value })
                }
                options={[
                  { value: "", label: "Select..." },
                  ...rooms.map((r) => ({
                    value: r.id,
                    label: `Room ${r.room_number} (${r.ward_name})`,
                  })),
                ]}
              />
              <Select
                label="Status"
                value={bedForm.status}
                onChange={(e) =>
                  setBedForm({ ...bedForm, status: e.target.value })
                }
                options={[
                  { value: "available", label: "Available" },
                  { value: "occupied", label: "Occupied" },
                  { value: "reserved", label: "Reserved" },
                  { value: "maintenance", label: "Maintenance" },
                ]}
              />
            </div>
          )}
          {modalType === "room" && (
            <div className="space-y-3">
              <Input
                label="Room Number *"
                value={roomForm.room_number}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, room_number: e.target.value })
                }
              />
              <Select
                label="Ward"
                value={roomForm.ward}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, ward: e.target.value })
                }
                options={[
                  { value: "", label: "Select..." },
                  ...wards.map((w) => ({ value: w.id, label: w.name })),
                ]}
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
          )}
          {modalType === "ward" && (
            <div className="space-y-3">
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
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
