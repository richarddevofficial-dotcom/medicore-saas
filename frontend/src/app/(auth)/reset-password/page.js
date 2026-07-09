"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import apiClient from "@/lib/api-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = useMemo(() => searchParams.get("uid") || "", [searchParams]);
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!uid || !token) {
      setError("Invalid or missing password setup link.");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await apiClient.post("/auth/password/setup-confirm/", {
        uid,
        token,
        new_password: newPassword,
      });
      setMessage(data?.message || "Password set successfully.");
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to set password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Reset Password</h1>
        <p className="text-sm text-gray-600 mt-1">
          Set your new account password.
        </p>

        {message && <Alert type="success" message={message} className="mt-4" />}
        {error && <Alert type="error" message={error} className="mt-4" />}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            required
          />

          <Button type="submit" fullWidth isLoading={isSubmitting}>
            Set Password
          </Button>

          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Sign In
          </Link>
        </form>
      </div>
    </div>
  );
}
