"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useCreateAppointment } from "@/hooks/useAppointments";
import { usePatients } from "@/hooks/usePatients";
import { useDoctors } from "@/hooks/useStaff";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

export default function BookAppointmentPage() {
  const router = useRouter();
  const createAppointment = useCreateAppointment();
  const { data: patientsData } = usePatients("", 1);
  const { data: doctors } = useDoctors();

  const [form, setForm] = useState({
    patient: "",
    doctor: "",
    appointment_date: "",
    appointment_time: "",
    reason: "",
    status: "scheduled",
  });

  const patients = patientsData?.results || [];
  const patientOptions = patients.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name} (${p.mrn})`,
  }));

  const doctorOptions = (doctors || []).map((doc) => ({
    value: doc.id,
    label: `Dr. ${doc.user?.first_name} ${doc.user?.last_name}${doc.specialization ? ` (${doc.specialization})` : ""}`,
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patient || !form.appointment_date || !form.appointment_time) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      await createAppointment.mutateAsync(form);
      toast.success("Appointment booked!");
      router.push("/appointments");
    } catch (err) {
      toast.error("Failed to book appointment");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => router.back()}
          >
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Book Appointment</h1>
            <p className="text-sm text-gray-500">
              Schedule a patient appointment
            </p>
          </div>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              label="Select Patient *"
              value={form.patient}
              onChange={(e) => setForm({ ...form, patient: e.target.value })}
              options={[
                { value: "", label: "Choose a patient..." },
                ...patientOptions,
              ]}
              required
            />

            <Select
              label="Assign Doctor"
              value={form.doctor}
              onChange={(e) => setForm({ ...form, doctor: e.target.value })}
              options={[
                { value: "", label: "Select doctor (optional)..." },
                ...doctorOptions,
              ]}
              hint="Patient will be sent to doctor queue when confirmed"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Date *"
                type="date"
                value={form.appointment_date}
                onChange={(e) =>
                  setForm({ ...form, appointment_date: e.target.value })
                }
                required
              />
              <Input
                label="Time *"
                type="time"
                value={form.appointment_time}
                onChange={(e) =>
                  setForm({ ...form, appointment_time: e.target.value })
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Visit *
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Describe the reason for the appointment"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" isLoading={createAppointment.isPending}>
                Book Appointment
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
