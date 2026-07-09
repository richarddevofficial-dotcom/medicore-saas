"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { useDoctors } from "@/hooks/useStaff";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function AddPatientPage() {
  const router = useRouter();
  const { data: doctors } = useDoctors();
  const [isLoading, setIsLoading] = useState(false);
  const [consultationServices, setConsultationServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    blood_group: "",
    phone: "",
    email: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    allergies: "",
    chronic_conditions: "",
    symptoms: "",
    assigned_doctor: "",
    consultation_service_id: "",
  });

  useEffect(() => {
    const loadServices = async () => {
      try {
        const { data } = await apiClient.get("/services/");
        const allServices = data.results || data || [];
        const activeConsultations = allServices.filter(
          (service) =>
            service?.service_type === "consultation" && service?.is_active,
        );
        setConsultationServices(activeConsultations);
        if (activeConsultations.length) {
          setForm((prev) => ({
            ...prev,
            consultation_service_id: String(activeConsultations[0].id),
          }));
        }
      } catch (err) {
        toast.error("Failed to load consultation services");
      } finally {
        setServicesLoading(false);
      }
    };
    loadServices();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.first_name ||
      !form.last_name ||
      !form.date_of_birth ||
      !form.gender ||
      !form.phone
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!form.consultation_service_id) {
      toast.error("Please select consultation type");
      return;
    }

    setIsLoading(true);

    try {
      const selectedConsultation = consultationServices.find(
        (service) =>
          String(service.id) === String(form.consultation_service_id),
      );

      const { data: patient } = await apiClient.post("/patients/", {
        first_name: form.first_name,
        last_name: form.last_name,
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        blood_group: form.blood_group,
        phone: form.phone,
        email: form.email,
        address: form.address,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        emergency_contact_relation: form.emergency_contact_relation,
        allergies: form.allergies,
        chronic_conditions: form.chronic_conditions,
        symptoms: form.symptoms,
      });

      await apiClient.post("/bills/", {
        patient_name:
          `${patient.first_name || ""} ${patient.last_name || ""}`.trim(),
        patient_mrn: patient.mrn,
        payment_method: "cash",
        consultation_fee: parseFloat(selectedConsultation?.price || 0),
        lab_fee: 0,
        medicine_fee: 0,
        room_fee: 0,
        other_fee: 0,
        insurance_company: "",
        insurance_policy: "",
        status: "pending",
        notes: selectedConsultation
          ? `Consultation type: ${selectedConsultation.name}${selectedConsultation.code ? ` (${selectedConsultation.code})` : ""}`
          : "",
      });

      if (form.assigned_doctor && patient.mrn) {
        await apiClient.post(`/patients/${patient.mrn}/assign_doctor/`, {
          assigned_doctor: form.assigned_doctor,
        });
      }

      toast.success(`Patient ${patient.mrn} registered!`);
      router.push("/patients");
    } catch (err) {
      const errorMsg = err.response?.data
        ? JSON.stringify(err.response.data)
        : "Registration failed";
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const doctorOptions = (doctors || []).map((doc) => ({
    value: doc.id,
    label: `Dr. ${doc.user?.first_name || ""} ${doc.user?.last_name || ""}${doc.specialization ? ` (${doc.specialization})` : ""}`,
  }));

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => router.push("/patients")}
          >
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Register New Patient
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Fill in patient details and assign a doctor
            </p>
          </div>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="First Name *"
                  value={form.first_name}
                  onChange={(e) => handleChange("first_name", e.target.value)}
                  placeholder="John"
                  required
                />
                <Input
                  label="Last Name *"
                  value={form.last_name}
                  onChange={(e) => handleChange("last_name", e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <Input
                  label="Date of Birth *"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) =>
                    handleChange("date_of_birth", e.target.value)
                  }
                  required
                />
                <Select
                  label="Gender *"
                  value={form.gender}
                  onChange={(e) => handleChange("gender", e.target.value)}
                  options={[
                    { value: "", label: "Select gender" },
                    { value: "M", label: "Male" },
                    { value: "F", label: "Female" },
                    { value: "O", label: "Other" },
                  ]}
                  required
                />
                <Select
                  label="Blood Group"
                  value={form.blood_group}
                  onChange={(e) => handleChange("blood_group", e.target.value)}
                  options={[
                    { value: "", label: "Select blood group" },
                    ...["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (bg) => ({ value: bg, label: bg }),
                    ),
                  ]}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Phone Number *"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+2119x xxx xxxx"
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="patient@email.com"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Enter full address"
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Contact Name"
                  value={form.emergency_contact_name}
                  onChange={(e) =>
                    handleChange("emergency_contact_name", e.target.value)
                  }
                  placeholder="John Wani majok"
                />
                <Input
                  label="Contact Phone"
                  type="tel"
                  value={form.emergency_contact_phone}
                  onChange={(e) =>
                    handleChange("emergency_contact_phone", e.target.value)
                  }
                  placeholder="+2119X XXX XXXX"
                />
                <Select
                  label="Relationship"
                  value={form.emergency_contact_relation}
                  onChange={(e) =>
                    handleChange("emergency_contact_relation", e.target.value)
                  }
                  options={[
                    { value: "", label: "Select relationship..." },
                    { value: "Spouse", label: "Spouse" },
                    { value: "Parent", label: "Parent" },
                    { value: "Sibling", label: "Sibling" },
                    { value: "Child", label: "Child" },
                    { value: "Grandparent", label: "Grandparent" },
                    { value: "Guardian", label: "Guardian" },
                    { value: "Friend", label: "Friend" },
                    { value: "Other Relative", label: "Other Relative" },
                    { value: "Other", label: "Other" },
                  ]}
                />
              </div>
            </div>

            {/* Medical Information */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Medical Information
              </h3>
              <div className="space-y-4">
                <Select
                  label="Consultation Type *"
                  value={form.consultation_service_id}
                  onChange={(e) =>
                    handleChange("consultation_service_id", e.target.value)
                  }
                  options={consultationServices.map((service) => ({
                    value: String(service.id),
                    label: `${service.name} - SSP ${Number(service.price || 0).toLocaleString()}`,
                  }))}
                  placeholder={
                    servicesLoading
                      ? "Loading consultation services..."
                      : "Select consultation type"
                  }
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Symptoms / Chief Complaint
                  </label>
                  <textarea
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    value={form.symptoms}
                    onChange={(e) => handleChange("symptoms", e.target.value)}
                    placeholder="Describe the patient's symptoms..."
                  />
                </div>
                <Input
                  label="Known Allergies"
                  value={form.allergies}
                  onChange={(e) => handleChange("allergies", e.target.value)}
                  placeholder="e.g., Penicillin, Peanuts"
                />
                <Input
                  label="Chronic Conditions"
                  value={form.chronic_conditions}
                  onChange={(e) =>
                    handleChange("chronic_conditions", e.target.value)
                  }
                  placeholder="e.g., Diabetes, Hypertension"
                />
              </div>
            </div>

            {/* Assign Doctor */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Assign Doctor
              </h3>
              <Select
                label="Select Doctor"
                value={form.assigned_doctor}
                onChange={(e) =>
                  handleChange("assigned_doctor", e.target.value)
                }
                options={[
                  { value: "", label: "Choose a doctor (optional)" },
                  ...doctorOptions,
                ]}
              />
              {(!doctors || doctors.length === 0) && (
                <div className="flex items-center gap-2 mt-2 p-3 bg-orange-50 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <p className="text-xs text-orange-700">
                    No doctors available.{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/doctors")}
                      className="underline font-medium"
                    >
                      Add doctors first
                    </button>
                  </p>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/patients")}
              >
                Cancel
              </Button>
              <Button type="submit" icon={Save} isLoading={isLoading}>
                Register Patient
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
