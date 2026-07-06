"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { patientSchema } from "@/lib/validators";
import { GENDER_OPTIONS, BLOOD_GROUPS } from "@/lib/constants";
import { usePatient, useUpdatePatient } from "@/hooks/usePatients";
import { ArrowLeft, Save } from "lucide-react";

export default function EditPatientPage({ params }) {
  const router = useRouter();
  const { data: patient, isLoading } = usePatient(params.mrn);
  const updatePatient = useUpdatePatient(params.mrn);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(patientSchema),
    values: patient
      ? {
          first_name: patient.first_name || "",
          middle_name: patient.middle_name || "",
          last_name: patient.last_name || "",
          date_of_birth: patient.date_of_birth || "",
          gender: patient.gender || "",
          blood_group: patient.blood_group || "",
          phone: patient.phone || "",
          alternate_phone: patient.alternate_phone || "",
          email: patient.email || "",
          address: patient.address || "",
          emergency_contact_name: patient.emergency_contact_name || "",
          emergency_contact_phone: patient.emergency_contact_phone || "",
          emergency_contact_relation: patient.emergency_contact_relation || "",
          allergies: patient.allergies || "",
          chronic_conditions: patient.chronic_conditions || "",
        }
      : undefined,
  });

  const onSubmit = async (data) => {
    await updatePatient.mutateAsync(data);
    router.push(`/patients/${params.mrn}`);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => router.back()}
          >
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Patient</h1>
            <p className="text-sm text-gray-500">MRN: {params.mrn}</p>
          </div>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="First Name *"
                {...register("first_name")}
                error={errors.first_name?.message}
              />
              <Input label="Middle Name" {...register("middle_name")} />
              <Input
                label="Last Name *"
                {...register("last_name")}
                error={errors.last_name?.message}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Date of Birth *"
                type="date"
                {...register("date_of_birth")}
                error={errors.date_of_birth?.message}
              />
              <Select
                label="Gender *"
                options={GENDER_OPTIONS}
                {...register("gender")}
                error={errors.gender?.message}
              />
              <Select
                label="Blood Group"
                options={BLOOD_GROUPS.map((bg) => ({ value: bg, label: bg }))}
                {...register("blood_group")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone *"
                {...register("phone")}
                error={errors.phone?.message}
              />
              <Input label="Alternate Phone" {...register("alternate_phone")} />
            </div>

            <Input
              label="Email"
              type="email"
              {...register("email")}
              error={errors.email?.message}
            />
            <Input label="Address" {...register("address")} />

            <h3 className="text-lg font-semibold pt-4 border-t">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Contact Name"
                {...register("emergency_contact_name")}
              />
              <Input label="Phone" {...register("emergency_contact_phone")} />
              <Input
                label="Relation"
                {...register("emergency_contact_relation")}
              />
            </div>

            <h3 className="text-lg font-semibold pt-4 border-t">
              Medical History
            </h3>
            <Input label="Allergies" {...register("allergies")} />
            <Input
              label="Chronic Conditions"
              {...register("chronic_conditions")}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                type="submit"
                icon={Save}
                isLoading={updatePatient.isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
