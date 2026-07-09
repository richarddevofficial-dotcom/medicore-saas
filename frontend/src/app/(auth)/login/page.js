"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import toast from "react-hot-toast";
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
  const [otp, setOtp] = useState("");
  const [otpSessionId, setOtpSessionId] = useState("");
  const [otpDestination, setOtpDestination] = useState("");
  const [step, setStep] = useState("credentials");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [rememberDevice, setRememberDevice] = useState(true);

  const justRegistered = searchParams.get("registered");
  const normalizedCredential = credential.trim();
  const looksLikePhone = /^[+]?[-\d\s()]{6,}$/.test(normalizedCredential);
  const credentialType = looksLikePhone ? "phone" : "username";

  const buildLoginPayload = () => {
    const payload = { password };
    const trustedDeviceToken = localStorage.getItem("trusted_device_token");

    if (credentialType === "phone") {
      payload.phone = normalizedCredential.replace(/[\s()-]/g, "");
    } else {
      payload.email = normalizedCredential;
    }

    if (trustedDeviceToken) {
      payload.trusted_device_token = trustedDeviceToken;
    }

    return payload;
  };

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const finalizeLogin = (data) => {
    sessionStorage.removeItem("impersonating_hospital_id");
    sessionStorage.removeItem("super_admin_state");
    if (data.trusted_device_token) {
      localStorage.setItem("trusted_device_token", data.trusted_device_token);
    }
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    if (data.hospital) {
      localStorage.setItem("hospital", JSON.stringify(data.hospital));
    } else {
      localStorage.removeItem("hospital");
    }
    localStorage.setItem("role", data.user.role);
    localStorage.setItem("is_superuser", data.user?.is_superuser || false);
    login(data.token, data.user, data.hospital || null);

    if (data.user.role === "doctor") router.push("/doctors/queue");
    else if (data.user.role === "receptionist") router.push("/reception");
    else router.push("/dashboard");
  };

  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data } = await apiClient.post(
        "/auth/login/initiate/",
        buildLoginPayload(),
      );
      if (data.mfa_required === false && data.token) {
        toast.success("Trusted device recognized. Signed in.");
        finalizeLogin(data);
        return;
      }

      setOtpSessionId(data.otp_session_id);
      setOtpDestination(data.destination || "your email");
      setResendCountdown(data.resend_after_seconds || 60);
      setOtp("");
      setStep("otp");
      if (data.debug_otp) {
        toast.success(`OTP generated: ${data.debug_otp}`);
      } else {
        toast.success("OTP sent successfully");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to start OTP login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data } = await apiClient.post("/auth/login/verify/", {
        otp_session_id: otpSessionId,
        otp,
        remember_device: rememberDevice,
      });
      finalizeLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setIsResending(true);
    try {
      const payload = buildLoginPayload();

      const { data } = await apiClient.post("/auth/login/initiate/", payload);
      setOtpSessionId(data.otp_session_id);
      setOtpDestination(data.destination || otpDestination);
      setResendCountdown(data.resend_after_seconds || 60);
      if (data.debug_otp) {
        toast.success(`New OTP: ${data.debug_otp}`);
      } else {
        toast.success("OTP resent");
      }
    } catch (err) {
      const retryAfter = err.response?.data?.retry_after_seconds;
      if (retryAfter) setResendCountdown(retryAfter);
      setError(err.response?.data?.error || "Failed to resend OTP");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to MediCore"
      subtitle={
        step === "credentials"
          ? "Enter your username, email or phone number"
          : `Enter the OTP sent to ${otpDestination}`
      }
    >
      {justRegistered && (
        <Alert
          type="success"
          message="Registration successful! Please sign in."
          className="mb-4"
        />
      )}
      {error && <Alert type="error" message={error} className="mb-4" />}

      {step === "credentials" ? (
        <form onSubmit={handleCredentialSubmit} className="space-y-4">
          <Input
            label="Username, Email or Phone Number"
            type="text"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="username, example@gmail.com, or 09XX XXX XXX"
            icon={credentialType === "phone" ? Phone : Mail}
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

          <div className="flex justify-end -mt-1">
            <Link
              href="/forgot-password"
              className="text-xs text-orange-600 font-medium hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" fullWidth isLoading={isLoading}>
            Continue
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
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <Input
            label="One-Time Password (OTP)"
            type="text"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="Enter 6-digit code"
            icon={Lock}
            required
          />

          <Button type="submit" fullWidth isLoading={isLoading}>
            Verify OTP & Sign In
          </Button>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            Remember this device for faster future sign-in
          </label>

          <Button
            type="button"
            variant="outline"
            fullWidth
            isLoading={isResending}
            disabled={resendCountdown > 0}
            onClick={handleResendOtp}
          >
            {resendCountdown > 0
              ? `Resend OTP in ${resendCountdown}s`
              : "Resend OTP"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setOtp("");
              setError("");
            }}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Back to credentials
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
