"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

const initialForm = {
  hospital_name: "",
  hospital_type: "hospital",
  hospital_email: "",
  hospital_phone: "",
  address: "",
  city: "Juba",
  state: "Central Equatoria",
  country: "South Sudan",
  admin_first_name: "",
  admin_last_name: "",
  admin_email: "",
  admin_phone: "",
  password: "",
  confirm_password: "",
};

export default function HospitalRegistrationPage() {
  const router = useRouter();

  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.medicorecloud.com/api/v1";

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess(null);

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${apiBase}/public/register-hospital/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hospital_name: form.hospital_name,
            hospital_type: form.hospital_type,
            hospital_email: form.hospital_email,
            hospital_phone: form.hospital_phone,
            address: form.address,
            city: form.city,
            state: form.state,
            country: form.country,
            admin_first_name: form.admin_first_name,
            admin_last_name: form.admin_last_name,
            admin_email: form.admin_email,
            admin_phone: form.admin_phone,
            password: form.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Hospital registration failed."
        );
      }

      setSuccess(data);

      setTimeout(() => {
        window.location.href = data.login_url;
      }, 2500);
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to register the hospital."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
        <section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={34} />
          </div>

          <h1 className="mt-6 text-3xl font-bold text-slate-900">
            Hospital registered successfully
          </h1>

          <p className="mt-3 text-slate-600">
            Your MediCore tenant has been created.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-100 p-5 text-left">
            <p className="text-sm text-slate-500">
              Hospital
            </p>
            <p className="font-semibold text-slate-900">
              {success.hospital?.name}
            </p>

            <p className="mt-4 text-sm text-slate-500">
              Login address
            </p>
            <p className="break-all font-semibold text-orange-600">
              {success.login_url}
            </p>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Redirecting you to your hospital login...
          </p>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
          >
            Continue to sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-white">
              <Building2 size={26} />
            </div>

            <div className="text-left">
              <p className="text-xl font-bold text-slate-900">
                MediCore HMS
              </p>
              <p className="text-sm text-slate-500">
                Hospital Management SaaS
              </p>
            </div>
          </Link>

          <h1 className="mt-8 text-3xl font-bold text-slate-900 sm:text-4xl">
            Register your hospital
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Create your hospital workspace and receive your
            secure MediCore subdomain.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-white p-6 shadow-xl sm:p-10"
        >
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section>
            <h2 className="text-xl font-bold text-slate-900">
              Hospital information
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field
                label="Hospital name"
                name="hospital_name"
                value={form.hospital_name}
                onChange={handleChange}
                required
              />

              <SelectField
                label="Hospital type"
                name="hospital_type"
                value={form.hospital_type}
                onChange={handleChange}
                options={[
                  ["hospital", "Hospital"],
                  ["clinic", "Clinic"],
                  ["medical_center", "Medical Centre"],
                  ["diagnostic_center", "Diagnostic Centre"],
                ]}
              />

              <Field
                label="Hospital email"
                name="hospital_email"
                type="email"
                value={form.hospital_email}
                onChange={handleChange}
                required
              />

              <Field
                label="Hospital phone"
                name="hospital_phone"
                value={form.hospital_phone}
                onChange={handleChange}
                required
              />

              <Field
                label="Address"
                name="address"
                value={form.address}
                onChange={handleChange}
              />

              <Field
                label="City"
                name="city"
                value={form.city}
                onChange={handleChange}
                required
              />

              <Field
                label="State"
                name="state"
                value={form.state}
                onChange={handleChange}
              />

              <Field
                label="Country"
                name="country"
                value={form.country}
                onChange={handleChange}
                required
              />
            </div>
          </section>

          <section className="mt-10 border-t border-slate-200 pt-8">
            <h2 className="text-xl font-bold text-slate-900">
              Hospital administrator
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field
                label="First name"
                name="admin_first_name"
                value={form.admin_first_name}
                onChange={handleChange}
                required
              />

              <Field
                label="Last name"
                name="admin_last_name"
                value={form.admin_last_name}
                onChange={handleChange}
                required
              />

              <Field
                label="Administrator email"
                name="admin_email"
                type="email"
                value={form.admin_email}
                onChange={handleChange}
                required
              />

              <Field
                label="Administrator phone"
                name="admin_phone"
                value={form.admin_phone}
                onChange={handleChange}
                required
              />

              <PasswordField
                label="Password"
                name="password"
                value={form.password}
                onChange={handleChange}
                visible={showPassword}
                onToggle={() =>
                  setShowPassword((current) => !current)
                }
              />

              <PasswordField
                label="Confirm password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                visible={showPassword}
                onToggle={() =>
                  setShowPassword((current) => !current)
                }
              />
            </div>
          </section>

          <div className="mt-8 flex items-start gap-3">
            <input
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />

            <p className="text-sm text-slate-600">
              I confirm that the information provided is correct
              and I agree to the MediCore terms of service and
              privacy policy.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-4 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Creating hospital...
              </>
            ) : (
              "Create hospital account"
            )}
          </button>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-semibold text-orange-600"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = false,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function PasswordField({
  label,
  name,
  value,
  onChange,
  visible,
  onToggle,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        <span className="ml-1 text-red-500">*</span>
      </span>

      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          required
          minLength={8}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500"
          aria-label="Toggle password visibility"
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </label>
  );
}
