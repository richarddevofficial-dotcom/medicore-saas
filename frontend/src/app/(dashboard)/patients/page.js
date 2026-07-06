"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import PatientSearch from "@/components/patients/PatientSearch";
import PatientTable from "@/components/patients/PatientTable";
import Pagination from "@/components/shared/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Spinner from "@/components/ui/Spinner";
import { usePatients, useDeletePatient } from "@/hooks/usePatients";
import { useDoctors } from "@/hooks/useStaff";
import { UserPlus, Users } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function PatientsPage() {
  const router = useRouter();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletePatient, setDeletePatient] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [assignPatient, setAssignPatient] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState("");

  // Hooks
  const { data, isLoading } = usePatients(searchTerm, currentPage);
  const { data: doctors } = useDoctors();
  const deleteMutation = useDeletePatient();

  // Handlers
  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  }, []);

  const handleReactivate = async (patient) => {
    try {
      await apiClient.post(`/patients/${patient.mrn}/reactivate/`);
      toast.success(`${patient.first_name} reactivated!`);
    } catch (err) {
      toast.error("Failed to reactivate");
    }
  };

  const handlePageChange = (page) => setCurrentPage(page);

  const handleDeleteClick = (patient) => {
    setDeletePatient(patient);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletePatient) {
      await deleteMutation.mutateAsync(deletePatient.mrn);
      setShowDeleteDialog(false);
      setDeletePatient(null);
    }
  };

  const handleAssignDoctor = (patient) => {
    setAssignPatient(patient);
    setSelectedDoctor("");
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async () => {
    if (assignPatient && selectedDoctor) {
      try {
        await apiClient.post(`/patients/${assignPatient.mrn}/assign_doctor/`, {
          assigned_doctor: selectedDoctor,
        });
        toast.success(`Doctor assigned to ${assignPatient.first_name}!`);
        setShowAssignModal(false);
        setAssignPatient(null);
        setSelectedDoctor("");
      } catch (err) {
        toast.error("Failed to assign doctor");
      }
    }
  };

  const patients = data?.results || [];
  const totalCount = data?.count || 0;

  const doctorOptions = (doctors || []).map((doc) => ({
    value: doc.id,
    label: `Dr. ${doc.user?.first_name} ${doc.user?.last_name}${doc.specialization ? ` (${doc.specialization})` : ""}`,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalCount} patients registered
            </p>
          </div>
          <Button icon={UserPlus} onClick={() => router.push("/patients/add")}>
            Add Patient
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              <p className="text-sm text-gray-500">Total Patients</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {patients.filter((p) => p.is_active).length}
              </p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {data?.today_new || 0}
              </p>
              <p className="text-sm text-gray-500">New Today</p>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card padding={false}>
          <div className="p-4 border-b">
            <PatientSearch onSearch={handleSearch} />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <PatientTable
                  patients={patients}
                  onDelete={handleDeleteClick}
                  onAssignDoctor={handleAssignDoctor}
                  onReactivate={handleReactivate}
                />
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalCount / 10) || 1}
                totalItems={totalCount}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </Card>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Patient"
          message={`Are you sure you want to delete ${deletePatient?.first_name} ${deletePatient?.last_name}?`}
          confirmLabel="Delete"
          variant="danger"
          isLoading={deleteMutation.isPending}
        />

        {/* Assign Doctor Modal */}
        <Modal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title={`Assign Doctor: ${assignPatient?.first_name} ${assignPatient?.last_name}`}
          size="sm"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowAssignModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAssignSubmit} disabled={!selectedDoctor}>
                Assign Doctor
              </Button>
            </div>
          }
        >
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Select a doctor for{" "}
              <strong>
                {assignPatient?.first_name} {assignPatient?.last_name}
              </strong>{" "}
              (MRN: {assignPatient?.mrn})
            </p>
            <Select
              label="Select Doctor"
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              options={[
                { value: "", label: "Choose a doctor..." },
                ...doctorOptions,
              ]}
            />
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
