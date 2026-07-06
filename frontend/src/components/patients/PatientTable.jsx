"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import {
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { formatDate, calculateAge, getInitials } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const statusConfig = {
  registered: { label: "Registered", color: "#6B7280", bg: "#F3F4F6" },
  waiting: { label: "Waiting", color: "#F97316", bg: "#FFF7ED" },
  in_consultation: {
    label: "In Consultation",
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  lab_requested: { label: "Lab Requested", color: "#8B5CF6", bg: "#F5F3FF" },
  lab_in_progress: {
    label: "Lab In Progress",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  lab_completed: { label: "Results Ready", color: "#10B981", bg: "#ECFDF5" },
  treated: { label: "Treated", color: "#059669", bg: "#D1FAE5" },
};

export default function PatientTable({
  patients = [],
  onDelete,
  onAssignDoctor,
  onReactivate,
}) {
  const router = useRouter();
  const [actionMenu, setActionMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActionMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!patients || patients.length === 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>MRN</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Age/Gender</TableHead>
            <TableHead>Blood Group</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead>Registered</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty colSpan={9} message="No patients found." />
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>MRN</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Age/Gender</TableHead>
          <TableHead>Blood Group</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Doctor</TableHead>
          <TableHead>Registered</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => {
          const status =
            statusConfig[patient.status] || statusConfig.registered;
          return (
            <TableRow
              key={patient.mrn}
              clickable
              onClick={() => router.push(`/patients/${patient.mrn}`)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-orange-700">
                      {getInitials(patient.first_name, patient.last_name)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {patient.first_name} {patient.last_name}
                    </p>
                    {patient.symptoms && (
                      <p className="text-xs text-gray-400 max-w-xs truncate">
                        {patient.symptoms}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {patient.mrn}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">{patient.phone}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">
                  {patient.age || calculateAge(patient.date_of_birth)} yrs •{" "}
                  {patient.gender === "M"
                    ? "M"
                    : patient.gender === "F"
                      ? "F"
                      : "O"}
                </span>
              </TableCell>
              <TableCell>
                {patient.blood_group ? (
                  <Badge variant="primary">{patient.blood_group}</Badge>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: status.bg, color: status.color }}
                >
                  {status.label}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">
                  {patient.doctor_name || (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAssignDoctor) onAssignDoctor(patient);
                      }}
                      className="text-orange-600 hover:underline text-xs"
                    >
                      Assign
                    </button>
                  )}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">
                  {formatDate(patient.created_at, "DD MMM YYYY")}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="relative inline-block" ref={menuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionMenu(
                        actionMenu === patient.mrn ? null : patient.mrn,
                      );
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {actionMenu === patient.mrn && (
                    <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/patients/${patient.mrn}`);
                          setActionMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/patients/${patient.mrn}/edit`);
                          setActionMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      {patient.status === "treated" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReactivate(patient);
                            setActionMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Reactivate
                        </button>
                      )}
                      {patient.status === "registered" && onAssignDoctor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssignDoctor(patient);
                            setActionMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50"
                        >
                          <UserPlus className="h-4 w-4" />
                          Assign Doctor
                        </button>
                      )}
                      <hr className="my-1 border-gray-100" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(patient);
                          setActionMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
