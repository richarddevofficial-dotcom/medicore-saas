"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import {
  useAppointments,
  useDeleteAppointment,
  useConfirmAppointment,
  useUpdateAppointment,
} from "@/hooks/useAppointments";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Calendar, Plus, Trash2, Check, X } from "lucide-react";

const statusConfig = {
  scheduled: { label: "Scheduled", variant: "warning", color: "#F97316" },
  confirmed: { label: "Confirmed", variant: "info", color: "#2563EB" },
  in_progress: { label: "In Progress", variant: "default", color: "#8B5CF6" },
  completed: { label: "Completed", variant: "success", color: "#10B981" },
  cancelled: { label: "Cancelled", variant: "danger", color: "#EF4444" },
  no_show: { label: "No Show", variant: "danger", color: "#6B7280" },
};

export default function AppointmentsPage() {
  const router = useRouter();
  const { data, isLoading } = useAppointments();
  const deleteAppointment = useDeleteAppointment();
  const confirmAppointment = useConfirmAppointment();
  const updateAppointment = useUpdateAppointment();

  const [deleteId, setDeleteId] = useState(null);
  const [showDelete, setShowDelete] = useState(false);

  const appointments = data?.results || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage patient appointments
            </p>
          </div>
          <Button icon={Plus} onClick={() => router.push("/appointments/book")}>
            Book Appointment
          </Button>
        </div>

        <Card padding={false}>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No appointments
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Schedule your first patient appointment
              </p>
              <Button
                icon={Plus}
                onClick={() => router.push("/appointments/book")}
              >
                Book Now
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {appointments.map((apt) => {
                    const status =
                      statusConfig[apt.status] || statusConfig.scheduled;
                    return (
                      <tr key={apt.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">
                          {apt.patient_name || `#${apt.patient}`}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {apt.appointment_date}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {apt.appointment_time}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {apt.reason}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: status.color + "20",
                              color: status.color,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Confirm - sends patient to doctor queue */}
                            {apt.status === "scheduled" && (
                              <button
                                onClick={() =>
                                  confirmAppointment.mutate(apt.id)
                                }
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Confirm & Send to Doctor"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            {/* Complete */}
                            {apt.status === "confirmed" && (
                              <button
                                onClick={() =>
                                  updateAppointment.mutate({
                                    id: apt.id,
                                    status: "completed",
                                  })
                                }
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Complete"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            {/* Cancel */}
                            {(apt.status === "scheduled" ||
                              apt.status === "confirmed") && (
                              <button
                                onClick={() => {
                                  setDeleteId(apt.id);
                                  setShowDelete(true);
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <ConfirmDialog
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          onConfirm={() => {
            deleteAppointment.mutate(deleteId);
            setShowDelete(false);
          }}
          title="Cancel Appointment"
          message="Are you sure you want to cancel this appointment?"
          confirmLabel="Yes, Cancel"
          variant="danger"
          isLoading={deleteAppointment.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
