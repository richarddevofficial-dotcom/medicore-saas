"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import apiClient from "@/lib/api-client";
import useAuthStore from "@/stores/auth-store";
import { Mail, Phone, Lock } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);

  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const justRegistered = searchParams.get("registered");
  const isEmail = credential.includes("@");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const payload = { password };
      if (isEmail) {
        payload.email = credential;
      } else {
        payload.phone = credential;
      }

      const { data } = await apiClient.post("/hospitals/login/", payload);

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("hospital", JSON.stringify(data.hospital));
        localStorage.setItem("role", data.user.role);
        localStorage.setItem("is_superuser", data.user?.is_superuser || false);
        login(data.token, data.user, data.hospital);

        if (data.user.role === "doctor") router.push("/doctors/queue");
        else if (data.user.role === "receptionist") router.push("/reception");
        else router.push("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to MediCore"
      subtitle="Enter your username, email or phone number"
    >
      {justRegistered && (
        <Alert
          type="success"
          message="Registration successful! Please sign in."
          className="mb-4"
        />
      )}
      {error && <Alert type="error" message={error} className="mb-4" />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email or Phone Number"
          type="text"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          placeholder="example@gmail.com or 09XX XXX XXX"
          icon={isEmail ? Mail : Phone}
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          icon={Lock}
          required
        />

        <Button type="submit" fullWidth isLoading={isLoading}>
          Sign In
        </Button>

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-orange-600 font-medium hover:underline"
          >
            Register Hospital
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
