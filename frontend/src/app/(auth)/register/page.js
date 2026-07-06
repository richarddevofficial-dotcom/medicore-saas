"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/layout/AuthLayout";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { Building2, Mail, Phone, MapPin, Lock, User } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    name: "",
    hospital_type: "clinic",
    registration_number: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "South Sudan",
    admin_first_name: "",
    admin_last_name: "",
    admin_email: "",
    admin_password: "",
  });

  const handleChange = (field, value) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const { data } = await apiClient.post("/hospitals/", form);
      toast.success("Hospital registered! 14-day free trial started.");
      router.push("/login?registered=true");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Register Your Hospital"
      subtitle="Start your 14-day free trial"
    >
      {error && <Alert type="error" message={error} className="mb-4" />}

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 && (
          <>
            <div className="text-center mb-4 p-3 bg-orange-50 rounded-lg">
              <p className="text-sm font-medium text-orange-700">
                🎉 14-Day Free Trial
              </p>
              <p className="text-xs text-orange-600">
                All features included. No credit card required.
              </p>
            </div>
            <Input
              label="Hospital Name *"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              icon={Building2}
              required
            />
            <Select
              label="Hospital Type"
              value={form.hospital_type}
              onChange={(e) => handleChange("hospital_type", e.target.value)}
              options={[
                { value: "general", label: "General Hospital" },
                { value: "specialty", label: "Specialty Hospital" },
                { value: "clinic", label: "Clinic" },
                { value: "diagnostic", label: "Diagnostic Center" },
              ]}
            />
            <Input
              label="Registration Number *"
              value={form.registration_number}
              onChange={(e) =>
                handleChange("registration_number", e.target.value)
              }
              required
            />
            <Input
              label="Hospital Email *"
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              icon={Mail}
              required
            />
            <Input
              label="Phone *"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              icon={Phone}
              required
            />
            <Input
              label="Address *"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              icon={MapPin}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City *"
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                required
              />
              <Input
                label="State *"
                value={form.state}
                onChange={(e) => handleChange("state", e.target.value)}
                required
              />
            </div>
            <Input
              label="Country"
              value={form.country}
              onChange={(e) => handleChange("country", e.target.value)}
            />
            <Button type="button" fullWidth onClick={() => setStep(2)}>
              Continue →
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-center mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-700">
                👤 Admin Account
              </p>
              <p className="text-xs text-blue-600">
                This will be your hospital administrator account
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name *"
                value={form.admin_first_name}
                onChange={(e) =>
                  handleChange("admin_first_name", e.target.value)
                }
                icon={User}
                required
              />
              <Input
                label="Last Name *"
                value={form.admin_last_name}
                onChange={(e) =>
                  handleChange("admin_last_name", e.target.value)
                }
                icon={User}
                required
              />
            </div>
            <Input
              label="Admin Email *"
              type="email"
              value={form.admin_email}
              onChange={(e) => handleChange("admin_email", e.target.value)}
              icon={Mail}
              required
            />
            <Input
              label="Password *"
              type="password"
              value={form.admin_password}
              onChange={(e) => handleChange("admin_password", e.target.value)}
              icon={Lock}
              required
              placeholder="Min 6 characters"
            />

            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium">📋 Registration Summary:</p>
              <p className="text-gray-600 mt-1">
                {form.name} - {form.city}, {form.country}
              </p>
              <p className="text-gray-600">
                Admin: {form.admin_first_name} {form.admin_last_name}
              </p>
              <p className="text-green-600 font-medium mt-2">
                14-Day Free Trial • All Features
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button type="submit" fullWidth isLoading={isLoading}>
                Start Free Trial
              </Button>
            </div>
          </>
        )}

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-orange-600 font-medium hover:underline"
          >
            Sign In
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
