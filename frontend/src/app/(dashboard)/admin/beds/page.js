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
import EmptyState from "@/components/ui/EmptyState";
import {
  Plus,
  Search,
  Bed,
  CheckCircle,
  Activity,
  Building2,
  Users,
  AlertCircle,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function BedManagementPage() {
  const [wards, setWards] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalType, setModalType] = useState("bed");
  const [editing, setEditing] = useState(null);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [workflowType, setWorkflowType] = useState("assign");
  const [workflowBed, setWorkflowBed] = useState(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowForm, setWorkflowForm] = useState({
    patient_id: "",
    notes: "",
    release_reason: "",
    next_status: "available",
    target_bed_id: "",
  });

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
      const results = await Promise.allSettled([
        apiClient.get("/wards/"),
        apiClient.get("/rooms/"),
        apiClient.get("/beds/"),
        apiClient.get("/beds/assignments/"),
        apiClient.get("/patients/"),
        apiClient.get("/beds/occupancy_analytics/"),
      ]);

      const [
        wardRes,
        roomRes,
        bedRes,
        assignmentRes,
        patientRes,
        analyticsRes,
      ] = results;

      if (wardRes.status === "fulfilled") {
        setWards(wardRes.value.data.results || wardRes.value.data || []);
      }
      if (roomRes.status === "fulfilled") {
        setRooms(roomRes.value.data.results || roomRes.value.data || []);
      }
      if (bedRes.status === "fulfilled") {
        setBeds(bedRes.value.data.results || bedRes.value.data || []);
      }
      if (assignmentRes.status === "fulfilled") {
        setAssignments(
          assignmentRes.value.data.results || assignmentRes.value.data || [],
        );
      }
      if (patientRes.status === "fulfilled") {
        setPatients(
          patientRes.value.data.results || patientRes.value.data || [],
        );
      }
      if (analyticsRes.status === "fulfilled") {
        setAnalytics(analyticsRes.value.data || null);
      }

      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        toast.error(`Some data failed to load (${failedCount})`);
      }
    } catch (err) {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getErrorMessage = (err, fallback = "Failed") => {
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    const firstKey = Object.keys(data)[0];
    const firstVal = firstKey ? data[firstKey] : null;
    if (Array.isArray(firstVal) && firstVal.length) return firstVal[0];
    if (typeof firstVal === "string") return firstVal;
    return fallback;
  };

  const buildPayload = () => {
    if (modalType === "bed") {
      if (!bedForm.bed_number.trim()) {
        throw new Error("Bed number is required");
      }
      if (!bedForm.room) {
        throw new Error("Please select a room");
      }
      return {
        bed_number: bedForm.bed_number.trim(),
        room: Number(bedForm.room),
        bed_type: bedForm.bed_type,
        status: bedForm.status,
        price_per_day: bedForm.price_per_day
          ? Number(bedForm.price_per_day)
          : 0,
      };
    }

    if (modalType === "room") {
      if (!roomForm.room_number.trim()) {
        throw new Error("Room number is required");
      }
      if (!roomForm.ward) {
        throw new Error("Please select a ward");
      }
      return {
        room_number: roomForm.room_number.trim(),
        ward: Number(roomForm.ward),
        room_type: roomForm.room_type,
        floor: Number(roomForm.floor || 1),
        capacity: Number(roomForm.capacity || 1),
        price_per_day: roomForm.price_per_day
          ? Number(roomForm.price_per_day)
          : 0,
      };
    }

    if (!wardForm.name.trim()) {
      throw new Error("Ward name is required");
    }

    const normalizedName = wardForm.name.trim().toLowerCase();
    const duplicateWard = wards.some(
      (w) =>
        String(w.name || "")
          .trim()
          .toLowerCase() === normalizedName &&
        (!editing || w.id !== editing.id),
    );
    if (duplicateWard) {
      throw new Error("Ward with this name already exists");
    }

    return {
      name: wardForm.name.trim(),
      ward_type: wardForm.ward_type,
      floor: Number(wardForm.floor || 1),
    };
  };

  const handleSave = async () => {
    try {
      setModalError("");
      const payload = buildPayload();
      if (modalType === "bed") {
        if (editing) await apiClient.patch(`/beds/${editing.id}/`, payload);
        else await apiClient.post("/beds/", payload);
      } else if (modalType === "ward") {
        if (editing) await apiClient.patch(`/wards/${editing.id}/`, payload);
        else await apiClient.post("/wards/", payload);
      } else if (modalType === "room") {
        if (editing) await apiClient.patch(`/rooms/${editing.id}/`, payload);
        else await apiClient.post("/rooms/", payload);
      }
      toast.success("Saved!");
      setShowModal(false);
      setEditing(null);
      setModalError("");
      fetchData();
    } catch (err) {
      const isRequestError = Boolean(err?.response);
      const message = isRequestError
        ? getErrorMessage(err)
        : err.message || "Failed";
      setModalError(message);
      toast.error(message);
    }
  };

  const handleBedStatus = async (bed, newStatus) => {
    try {
      await apiClient.post(`/beds/${bed.id}/update_status/`, {
        status: newStatus,
      });
      toast.success(`Bed ${newStatus}`);
      fetchData();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const openWorkflowModal = (type, bed) => {
    setWorkflowType(type);
    setWorkflowBed(bed);
    setWorkflowForm({
      patient_id: "",
      notes: "",
      release_reason: "",
      next_status: "available",
      target_bed_id: "",
    });
    setWorkflowModalOpen(true);
  };

  const handleWorkflowSubmit = async () => {
    if (!workflowBed) return;

    try {
      setWorkflowLoading(true);
      if (workflowType === "assign") {
        if (!workflowForm.patient_id) {
          throw new Error("Please select a patient");
        }
        await apiClient.post(`/beds/${workflowBed.id}/assign/`, {
          patient_id: Number(workflowForm.patient_id),
          notes: workflowForm.notes,
        });
        toast.success("Bed assigned");
      }

      if (workflowType === "release") {
        await apiClient.post(`/beds/${workflowBed.id}/release/`, {
          release_reason: workflowForm.release_reason,
          next_status: workflowForm.next_status,
        });
        toast.success("Bed released");
      }

      if (workflowType === "transfer") {
        if (!workflowForm.target_bed_id) {
          throw new Error("Please select target bed");
        }
        await apiClient.post(`/beds/${workflowBed.id}/transfer/`, {
          target_bed_id: Number(workflowForm.target_bed_id),
          notes: workflowForm.notes,
        });
        toast.success("Bed transferred");
      }

      setWorkflowModalOpen(false);
      setWorkflowBed(null);
      fetchData();
    } catch (err) {
      const isRequestError = Boolean(err?.response);
      toast.error(
        isRequestError ? getErrorMessage(err) : err.message || "Failed",
      );
    } finally {
      setWorkflowLoading(false);
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
        (b.ward_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.active_assignment?.patient_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
    );

  const filteredAssignments = assignments
    .filter((a) => {
      if (assignmentFilter === "active") return !a.released_at;
      if (assignmentFilter === "released") return a.status === "released";
      if (assignmentFilter === "transferred") return a.status === "transferred";
      return true;
    })
    .filter((a) => {
      const q = searchTerm.toLowerCase();
      return (
        (a.patient_name || "").toLowerCase().includes(q) ||
        (a.patient_mrn || "").toLowerCase().includes(q) ||
        (a.bed_number || "").toLowerCase().includes(q) ||
        (a.room_number || "").toLowerCase().includes(q)
      );
    });

  const availableTargetBeds = beds.filter(
    (b) => b.id !== workflowBed?.id && b.status === "available",
  );

  const unassignedPatients = patients.filter((p) => p.status !== "admitted");

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
    {
      id: "assignments",
      label: "🧾 Assignments",
      count: assignments.length,
    },
    { id: "rooms", label: "🚪 Rooms", count: rooms.length },
    { id: "wards", label: "🏥 Wards", count: wards.length },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AdminBackButton />
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
              disabled={rooms.length === 0}
              onClick={() => {
                setModalError("");
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
              disabled={wards.length === 0}
              onClick={() => {
                setModalError("");
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
                setModalError("");
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

        {analytics?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center">
              <Activity className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
              <p className="text-xl font-bold">
                {analytics.summary.occupancy_rate || 0}%
              </p>
              <p className="text-xs text-gray-500">Occupancy Rate</p>
            </Card>
            <Card className="text-center">
              <p className="text-xl font-bold">
                {analytics.summary.active_assignments || 0}
              </p>
              <p className="text-xs text-gray-500">Active Assignments</p>
            </Card>
            <Card className="text-center">
              <p className="text-xl font-bold">
                {analytics.summary.transferred_today || 0}
              </p>
              <p className="text-xs text-gray-500">Transfers Today</p>
            </Card>
            <Card className="text-center">
              <p className="text-xl font-bold">
                {analytics.summary.maintenance_or_cleaning || 0}
              </p>
              <p className="text-xs text-gray-500">Maint/Cleaning</p>
            </Card>
          </div>
        )}

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
                    <p className="text-[11px] mt-1 min-h-[18px]">
                      {bed.active_assignment?.patient_name
                        ? `Patient: ${bed.active_assignment.patient_name}`
                        : "No active patient"}
                    </p>
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
                      <div className="mt-2 flex justify-center gap-1">
                        <button
                          onClick={() => openWorkflowModal("assign", bed)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => handleBedStatus(bed, "reserved")}
                          className="text-xs text-yellow-700 hover:underline"
                        >
                          Reserve
                        </button>
                      </div>
                    )}
                    {bed.status === "occupied" && (
                      <div className="mt-2 flex justify-center gap-1">
                        <button
                          onClick={() => openWorkflowModal("release", bed)}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Release
                        </button>
                        <button
                          onClick={() => openWorkflowModal("transfer", bed)}
                          className="text-xs text-purple-700 hover:underline"
                        >
                          Transfer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "assignments" && (
          <>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patient, MRN, bed, room..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                {[
                  { id: "all", label: "All" },
                  { id: "active", label: "Active" },
                  { id: "released", label: "Released" },
                  { id: "transferred", label: "Transferred" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setAssignmentFilter(f.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium ${assignmentFilter === f.id ? "bg-white shadow-sm" : "text-gray-500"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <Card className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Patient</th>
                    <th className="text-left px-4 py-3 font-medium">MRN</th>
                    <th className="text-left px-4 py-3 font-medium">Bed</th>
                    <th className="text-left px-4 py-3 font-medium">Room</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">
                      Assigned
                    </th>
                    <th className="text-left px-4 py-3 font-medium">
                      Released
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        <EmptyState
                          imageSrc="/images/empty-states/appointments-empty.svg"
                          imageAlt="No bed assignments"
                          title="No assignments found"
                          className="py-2 px-0"
                          titleClassName="text-sm font-normal text-gray-500 mb-0"
                        />
                      </td>
                    </tr>
                  )}
                  {filteredAssignments.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-medium">
                        {item.patient_name || "N/A"}
                      </td>
                      <td className="px-4 py-3">{item.patient_mrn || "N/A"}</td>
                      <td className="px-4 py-3">{item.bed_number || "N/A"}</td>
                      <td className="px-4 py-3">{item.room_number || "N/A"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            item.status === "active"
                              ? "success"
                              : item.status === "transferred"
                                ? "warning"
                                : "default"
                          }
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {item.assigned_at
                          ? new Date(item.assigned_at).toLocaleString()
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        {item.released_at
                          ? new Date(item.released_at).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
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
          onClose={() => {
            setShowModal(false);
            setModalError("");
          }}
          title={`Add ${modalType}`}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowModal(false);
                  setModalError("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </>
          }
        >
          {modalError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {modalError}
            </div>
          )}
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
                  { value: "cleaning", label: "Cleaning" },
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

        <Modal
          isOpen={workflowModalOpen}
          onClose={() => setWorkflowModalOpen(false)}
          title={
            workflowType === "assign"
              ? `Assign ${workflowBed?.bed_number || "Bed"}`
              : workflowType === "release"
                ? `Release ${workflowBed?.bed_number || "Bed"}`
                : `Transfer ${workflowBed?.bed_number || "Bed"}`
          }
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setWorkflowModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleWorkflowSubmit}
                isLoading={workflowLoading}
              >
                Submit
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {workflowType === "assign" && (
              <>
                <Select
                  label="Patient"
                  value={workflowForm.patient_id}
                  onChange={(e) =>
                    setWorkflowForm({
                      ...workflowForm,
                      patient_id: e.target.value,
                    })
                  }
                  options={unassignedPatients.map((p) => ({
                    value: p.id,
                    label: `${p.first_name} ${p.last_name} (${p.mrn})`,
                  }))}
                />
                <Input
                  label="Notes"
                  value={workflowForm.notes}
                  onChange={(e) =>
                    setWorkflowForm({ ...workflowForm, notes: e.target.value })
                  }
                />
              </>
            )}

            {workflowType === "release" && (
              <>
                <Select
                  label="Next Status"
                  value={workflowForm.next_status}
                  onChange={(e) =>
                    setWorkflowForm({
                      ...workflowForm,
                      next_status: e.target.value,
                    })
                  }
                  options={[
                    { value: "available", label: "Available" },
                    { value: "cleaning", label: "Cleaning" },
                    { value: "maintenance", label: "Maintenance" },
                  ]}
                />
                <Input
                  label="Release Reason"
                  value={workflowForm.release_reason}
                  onChange={(e) =>
                    setWorkflowForm({
                      ...workflowForm,
                      release_reason: e.target.value,
                    })
                  }
                />
              </>
            )}

            {workflowType === "transfer" && (
              <>
                <Select
                  label="Target Bed"
                  value={workflowForm.target_bed_id}
                  onChange={(e) =>
                    setWorkflowForm({
                      ...workflowForm,
                      target_bed_id: e.target.value,
                    })
                  }
                  options={availableTargetBeds.map((b) => ({
                    value: b.id,
                    label: `${b.bed_number} (${b.room_number || "N/A"})`,
                  }))}
                />
                <Input
                  label="Transfer Notes"
                  value={workflowForm.notes}
                  onChange={(e) =>
                    setWorkflowForm({ ...workflowForm, notes: e.target.value })
                  }
                />
              </>
            )}
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
