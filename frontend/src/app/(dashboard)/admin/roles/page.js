"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AdminBackButton from "@/components/ui/AdminBackButton";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Shield, Check, X } from "lucide-react";

const rolesData = [
  {
    role: "admin",
    label: "Administrator",
    color: "danger",
    permissions: ["all"],
    description:
      "Full system access. Can manage users, settings, and all modules.",
  },
  {
    role: "doctor",
    label: "Doctor",
    color: "success",
    permissions: [
      "view_patients",
      "treat_patients",
      "prescribe",
      "request_lab",
      "view_lab_results",
    ],
    description:
      "Can view assigned patients, diagnose, prescribe, and request lab tests.",
  },
  {
    role: "nurse",
    label: "Nurse",
    color: "info",
    permissions: ["view_patients", "record_vitals", "administer_medication"],
    description:
      "Can view patients, record vitals, and administer medications.",
  },
  {
    role: "receptionist",
    label: "Receptionist",
    color: "warning",
    permissions: ["register_patient", "view_patients", "assign_doctor"],
    description: "Can register new patients and assign them to doctors.",
  },
  {
    role: "pharmacist",
    label: "Pharmacist",
    color: "default",
    permissions: [
      "view_prescriptions",
      "dispense_medicine",
      "manage_inventory",
    ],
    description:
      "Can view prescriptions, dispense medicines, and manage inventory.",
  },
  {
    role: "lab_technician",
    label: "Lab Technician",
    color: "default",
    permissions: ["view_lab_requests", "perform_tests", "submit_results"],
    description: "Can view lab requests, perform tests, and submit results.",
  },
  {
    role: "accountant",
    label: "Accountant",
    color: "default",
    permissions: ["view_billing", "manage_payments", "insurance_claims"],
    description: "Can manage billing, payments, and insurance claims.",
  },
  {
    role: "radiographer",
    label: "Radiographer",
    color: "default",
    permissions: [
      "view_imaging_requests",
      "perform_imaging",
      "submit_imaging_results",
    ],
    description:
      "Can view imaging requests, perform scans, and submit results.",
  },
];

const allPermissions = [
  { key: "all", label: "Full Access" },
  { key: "register_patient", label: "Register Patients" },
  { key: "view_patients", label: "View Patients" },
  { key: "assign_doctor", label: "Assign Doctor" },
  { key: "treat_patients", label: "Treat Patients" },
  { key: "prescribe", label: "Prescribe Medicine" },
  { key: "request_lab", label: "Request Lab Tests" },
  { key: "view_lab_results", label: "View Lab Results" },
  { key: "perform_tests", label: "Perform Lab Tests" },
  { key: "submit_results", label: "Submit Lab Results" },
  { key: "view_prescriptions", label: "View Prescriptions" },
  { key: "dispense_medicine", label: "Dispense Medicine" },
  { key: "manage_inventory", label: "Manage Inventory" },
  { key: "record_vitals", label: "Record Vitals" },
  { key: "administer_medication", label: "Administer Medication" },
  { key: "request_imaging", label: "Request Imaging" },
  { key: "view_imaging_requests", label: "View Imaging Requests" },
  { key: "perform_imaging", label: "Perform Imaging" },
  { key: "submit_imaging_results", label: "Submit Imaging Results" },
  { key: "view_billing", label: "View Billing" },
  { key: "manage_payments", label: "Manage Payments" },
  { key: "insurance_claims", label: "Insurance Claims" },
  { key: "manage_users", label: "Manage Users" },
  { key: "view_reports", label: "View Reports" },
  { key: "manage_settings", label: "Manage Settings" },
];

export default function ManageRolesPage() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [showModal, setShowModal] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <AdminBackButton />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Manage Roles & Permissions
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Define what each role can access
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rolesData.map((role) => (
            <Card
              key={role.role}
              hover
              onClick={() => {
                setSelectedRole(role);
                setShowModal(true);
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <Badge variant={role.color}>{role.label}</Badge>
                <Shield className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 mb-3">{role.description}</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 4).map((perm) => (
                  <span
                    key={perm}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                  >
                    {perm.replace("_", " ")}
                  </span>
                ))}
                {role.permissions.length > 4 && (
                  <span className="text-xs text-gray-400">
                    +{role.permissions.length - 4} more
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={`${selectedRole?.label} - Permissions`}
          size="lg"
          footer={<Button onClick={() => setShowModal(false)}>Close</Button>}
        >
          {selectedRole && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                {selectedRole.description}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {allPermissions.map((perm) => {
                  const hasPermission = selectedRole.permissions.includes(
                    perm.key,
                  );
                  return (
                    <div
                      key={perm.key}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        hasPermission
                          ? "bg-green-50 border border-green-200"
                          : "bg-gray-50 border border-gray-200"
                      }`}
                    >
                      <span
                        className={`text-sm ${hasPermission ? "text-green-700 font-medium" : "text-gray-400"}`}
                      >
                        {perm.label}
                      </span>
                      {hasPermission ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-gray-300" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
