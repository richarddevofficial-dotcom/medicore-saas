"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff, Lock, Mail, Phone } from "lucide-react";

import AuthLayout from "@/components/layout/AuthLayout";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import apiClient, { setCsrfToken } from "@/lib/api-client";
import useAuthStore from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);

  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [otp, setOtp] = useState("");
  const [otpSessionId, setOtpSessionId] = useState("");
  const [otpDestination, setOtpDestination] = useState("");

  const [step, setStep] = useState("credentials");
  const [error, setError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [rememberDevice, setRememberDevice] = useState(false);

  const justRegistered = searchParams.get("registered");

  const normalizedCredential = credential.trim();

  const looksLikePhone = /^[+]?[-\d\s()]{6,}$/.test(normalizedCredential);

  const credentialType = looksLikePhone ? "phone" : "username";

  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = setTimeout(() => {
      setResendCountdown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const buildLoginPayload = () => {
    const payload = {
      password,
    };

    if (credentialType === "phone") {
      payload.phone = normalizedCredential.replace(/[\s()-]/g, "");
    } else {
      payload.email = normalizedCredential;
    }

    return payload;
  };

  const getErrorMessage = (err, fallbackMessage) => {
    return (
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.message ||
      fallbackMessage
    );
  };

  const finalizeLogin = (data) => {
    if (!data?.user) {
      setError("Login response did not include user information.");
      return;
    }

    sessionStorage.removeItem("impersonating_hospital_id");
    sessionStorage.removeItem("super_admin_state");

    localStorage.removeItem("token");
    localStorage.removeItem("refresh");
    localStorage.removeItem("trusted_device_token");

    if (data.csrf_token) {
      setCsrfToken(data.csrf_token);
    }

    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("role", data.user.role);

    localStorage.setItem(
      "is_superuser",
      String(Boolean(data.user?.is_superuser)),
    );

    if (data.hospital) {
      localStorage.setItem("hospital", JSON.stringify(data.hospital));
    } else {
      localStorage.removeItem("hospital");
    }

    login(data.user, data.hospital || null);

    toast.success("Signed in successfully");

    if (data.user.role === "doctor") {
      router.replace("/doctors/queue");
    } else if (data.user.role === "receptionist") {
      router.replace("/reception");
    } else if (["hr", "hr_officer", "hr_manager"].includes(data.user.role)) {
      router.replace("/hr");
    } else {
      router.replace("/dashboard");
    }
  };

  const handleCredentialSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!normalizedCredential) {
      setError("Enter your email");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await apiClient.post(
        "/auth/login/initiate/",
        buildLoginPayload(),
      );

      if (data.mfa_required === false) {
        toast.success("Trusted device recognized.");
        finalizeLogin(data);
        return;
      }

      if (!data.otp_session_id) {
        setError("The server did not return an OTP session. Please try again.");
        return;
      }

      setOtpSessionId(data.otp_session_id);

      setOtpDestination(
        data.destination || "your registered email or phone number",
      );

      setResendCountdown(data.resend_after_seconds ?? 60);
      setOtp("");
      setStep("otp");

      if (data.debug_otp) {
        toast.success(`OTP generated: ${data.debug_otp}`);
      } else {
        toast.success("OTP sent successfully");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to start the login process."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!otpSessionId) {
      setError("Your OTP session is missing. Please return and sign in again.");
      return;
    }

    if (otp.length !== 6) {
      setError("Enter the complete 6-digit OTP.");
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await apiClient.post("/auth/login/verify/", {
        otp_session_id: otpSessionId,
        otp,
        remember_device: rememberDevice,
      });

      finalizeLogin(data);
    } catch (err) {
      setError(getErrorMessage(err, "Invalid or expired OTP."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isResending) return;

    setError("");
    setIsResending(true);

    try {
      const { data } = await apiClient.post(
        "/auth/login/initiate/",
        buildLoginPayload(),
      );

      if (!data.otp_session_id) {
        setError("The server did not return a new OTP session.");
        return;
      }

      setOtpSessionId(data.otp_session_id);

      setOtpDestination(
        data.destination ||
          otpDestination ||
          "your registered email or phone number",
      );

      setResendCountdown(data.resend_after_seconds ?? 60);
      setOtp("");

      if (data.debug_otp) {
        toast.success(`New OTP: ${data.debug_otp}`);
      } else {
        toast.success("OTP resent successfully");
      }
    } catch (err) {
      const retryAfter = err?.response?.data?.retry_after_seconds;

      if (retryAfter) {
        setResendCountdown(retryAfter);
      }

      setError(getErrorMessage(err, "Failed to resend OTP."));
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep("credentials");
    setOtp("");
    setOtpSessionId("");
    setOtpDestination("");
    setRememberDevice(false);
    setResendCountdown(0);
    setError("");
  };

  return (
    <AuthLayout
      title="Sign in to MediCore"
      subtitle={
        step === "credentials"
          ? "Enter your email"
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
        <form
          onSubmit={handleCredentialSubmit}
          className="space-y-4 sm:space-y-5"
        >
          <Input
            label="Email"
            type="text"
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            placeholder="example@gmail.com"
            icon={credentialType === "phone" ? Phone : Mail}
            className="h-11 text-base sm:text-sm"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Password
            </label>

            <div className="relative">
              <Lock
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
              />

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-12 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 sm:text-sm"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {showPassword ? (
                  <EyeOff size={19} aria-hidden="true" />
                ) : (
                  <Eye size={19} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="-mt-1 flex justify-end">
            <Link
              href="/forgot-password"
              className="inline-block py-1 text-sm font-medium text-orange-600 hover:underline sm:text-xs"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            fullWidth
            isLoading={isLoading}
            disabled={isLoading}
          >
            Continue
          </Button>

          <p className="text-center text-sm leading-relaxed text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="inline-block py-1 font-medium text-orange-600 hover:underline"
            >
              Register Hospital
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-4 sm:space-y-5">
          <Input
            label="One-Time Password (OTP)"
            type="text"
            value={otp}
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="Enter 6-digit code"
            icon={Lock}
            className="h-11 text-base tracking-[0.35em] sm:text-sm"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />

          <Button
            type="submit"
            size="lg"
            fullWidth
            isLoading={isLoading}
            disabled={isLoading || otp.length !== 6}
          >
            Verify OTP & Sign In
          </Button>

          <label className="flex cursor-pointer items-start gap-2 text-sm leading-relaxed text-gray-600">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />

            <span>Remember this device for faster future sign-in</span>
          </label>

          <Button
            type="button"
            variant="outline"
            size="lg"
            fullWidth
            isLoading={isResending}
            disabled={resendCountdown > 0 || isResending}
            onClick={handleResendOtp}
          >
            {resendCountdown > 0
              ? `Resend OTP in ${resendCountdown}s`
              : "Resend OTP"}
          </Button>

          <button
            type="button"
            onClick={handleBackToCredentials}
            className="w-full rounded-md py-2 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            Back to credentials
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
