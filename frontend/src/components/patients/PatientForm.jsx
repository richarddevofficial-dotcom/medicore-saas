"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { patientSchema } from "@/lib/validators";
import { GENDER_OPTIONS, BLOOD_GROUPS } from "@/lib/constants";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import FormSection from "@/components/forms/FormSection";
import { useCreatePatient } from "@/hooks/usePatients";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Save,
  UserPlus,
} from "lucide-react";

const STEPS = [
  { id: 1, name: "Personal Info", icon: User },
  { id: 2, name: "Contact Details", icon: Phone },
  { id: 3, name: "Emergency Contact", icon: AlertTriangle },
  { id: 4, name: "Medical History", icon: Heart },
];

export default function PatientForm({ onSuccess, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1);
  const createPatient = useCreatePatient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    trigger,
    reset,
  } = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      first_name: "",
      middle_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "",
      blood_group: "",
      phone: "",
      alternate_phone: "",
      email: "",
      address: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      emergency_contact_relation: "",
      allergies: "",
      chronic_conditions: "",
    },
  });

  // Validate current step fields before moving to next
  const validateStep = async (step) => {
    let fieldsToValidate = [];

    switch (step) {
      case 1:
        fieldsToValidate = [
          "first_name",
          "last_name",
          "date_of_birth",
          "gender",
        ];
        break;
      case 2:
        fieldsToValidate = ["phone", "email", "address"];
        break;
      case 3:
        fieldsToValidate = [
          "emergency_contact_name",
          "emergency_contact_phone",
        ];
        break;
      case 4:
        fieldsToValidate = []; // Optional fields
        break;
    }

    const isValid = await trigger(fieldsToValidate);
    return isValid;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const onSubmit = async (data) => {
    const result = await createPatient.mutateAsync(data);
    if (result && onSuccess) {
      onSuccess(result);
      reset();
      setCurrentStep(1);
    }
  };

  // Render step indicator
  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-200"
                    : isCompleted
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={`text-xs mt-1 hidden sm:block ${
                  isActive ? "text-primary-600 font-medium" : "text-gray-500"
                }`}
              >
                {step.name}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 sm:w-20 mx-2 ${
                  isCompleted ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <StepIndicator />

      {/* Step 1: Personal Information */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <FormSection
            title="Personal Information"
            description="Enter the patient's basic personal details"
            icon={User}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="First Name *"
                placeholder="Enter first name"
                {...register("first_name")}
                error={errors.first_name?.message}
              />
              <Input
                label="Middle Name"
                placeholder="Enter middle name"
                {...register("middle_name")}
                error={errors.middle_name?.message}
              />
              <Input
                label="Last Name *"
                placeholder="Enter last name"
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
                placeholder="Select blood group"
                {...register("blood_group")}
                error={errors.blood_group?.message}
              />
            </div>
          </FormSection>
        </div>
      )}

      {/* Step 2: Contact Details */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <FormSection
            title="Contact Details"
            description="How can we reach the patient?"
            icon={Phone}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone Number *"
                type="tel"
                placeholder="+91 9876543210"
                icon={Phone}
                {...register("phone")}
                error={errors.phone?.message}
              />
              <Input
                label="Alternate Phone"
                type="tel"
                placeholder="+91 9876543211"
                icon={Phone}
                {...register("alternate_phone")}
                error={errors.alternate_phone?.message}
              />
            </div>

            <Input
              label="Email"
              type="email"
              placeholder="patient@example.com"
              icon={Mail}
              {...register("email")}
              error={errors.email?.message}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                rows={3}
                placeholder="Enter full address"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                {...register("address")}
              />
              {errors.address?.message && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.address.message}
                </p>
              )}
            </div>
          </FormSection>
        </div>
      )}

      {/* Step 3: Emergency Contact */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <FormSection
            title="Emergency Contact"
            description="Who should we contact in case of emergency?"
            icon={AlertTriangle}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Contact Name"
                placeholder="Enter emergency contact name"
                {...register("emergency_contact_name")}
                error={errors.emergency_contact_name?.message}
              />
              <Input
                label="Relationship"
                placeholder="e.g., Spouse, Parent, Sibling"
                {...register("emergency_contact_relation")}
                error={errors.emergency_contact_relation?.message}
              />
            </div>

            <Input
              label="Contact Phone"
              type="tel"
              placeholder="+91 9876543210"
              icon={Phone}
              {...register("emergency_contact_phone")}
              error={errors.emergency_contact_phone?.message}
            />
          </FormSection>
        </div>
      )}

      {/* Step 4: Medical History */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <FormSection
            title="Medical History"
            description="Record any known medical conditions or allergies"
            icon={Heart}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Known Allergies
              </label>
              <textarea
                rows={3}
                placeholder="List any known allergies (medications, food, environmental)"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                {...register("allergies")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chronic Conditions
              </label>
              <textarea
                rows={3}
                placeholder="List any chronic conditions (diabetes, hypertension, asthma, etc.)"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                {...register("chronic_conditions")}
              />
            </div>

            {/* Summary Preview */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Patient Summary
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>
                  <span className="ml-2 text-gray-900 font-medium">
                    {watch("first_name")} {watch("last_name")}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Gender:</span>
                  <span className="ml-2 text-gray-900 font-medium">
                    {watch("gender") || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Phone:</span>
                  <span className="ml-2 text-gray-900 font-medium">
                    {watch("phone") || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Blood Group:</span>
                  <span className="ml-2 text-gray-900 font-medium">
                    {watch("blood_group") || "-"}
                  </span>
                </div>
              </div>
            </div>
          </FormSection>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
        <div>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={handlePrevious}
              icon={ChevronLeft}
            >
              Previous
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}

          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={handleNext}
              icon={ChevronRight}
              iconPosition="right"
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              icon={Save}
              isLoading={isSubmitting || createPatient.isPending}
            >
              Save Patient
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
