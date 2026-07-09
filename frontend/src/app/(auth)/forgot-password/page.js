"use client";

import { useState } from "react";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import apiClient from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const { data } = await apiClient.post("/auth/password/setup-request/", {
        email,
      });
      setMessage(
        data?.message ||
          "If your account exists, we have sent a password setup link.",
      );
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to send request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Forgot Password</h1>
        <p className="text-sm text-gray-600 mt-1">
          Enter your email to receive a password setup link.
        </p>

        {message && <Alert type="success" message={message} className="mt-4" />}
        {error && <Alert type="error" message={error} className="mt-4" />}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <Button type="submit" fullWidth isLoading={isSubmitting}>
            Send Setup Link
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
