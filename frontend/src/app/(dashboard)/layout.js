"use client";

import AuthProvider from "@/providers/AuthProvider";
import { useBranding } from "@/hooks/useBranding";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import RoleGuard from "@/components/auth/RoleGuard";
import TrialBanner from "@/components/ui/TrialBanner";
import useIdleTimeout from "@/hooks/useIdleTimeout";
import useAuthStore from "@/stores/auth-store";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, AlertTriangle } from "lucide-react";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 60 * 1000; // warn at 1 minute remaining

function IdleWarningModal({ secondsLeft, onStayLoggedIn, onLogoutNow }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Session Expiring Soon
        </h2>
        <p className="text-gray-500 text-sm mb-1">
          You have been inactive. You will be automatically logged out in:
        </p>
        <p className="text-4xl font-bold text-orange-500 my-4">
          {secondsLeft}s
        </p>
        <p className="text-gray-400 text-xs mb-6">
          Click &quot;Stay Logged In&quot; to continue your session.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onLogoutNow}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Logout Now
          </button>
          <button
            onClick={onStayLoggedIn}
            className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const { data: branding } = useBranding();
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const handleLogout = useCallback(() => {
    setShowWarning(false);
    logout();
    router.replace("/login");
  }, [logout, router]);

  const handleWarning = useCallback(() => {
    setShowWarning(true);
    setSecondsLeft(60);
  }, []);

  const { resetTimers } = useIdleTimeout({
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: WARNING_MS,
    onWarning: handleWarning,
    onLogout: handleLogout,
  });

  // Countdown timer when warning is shown
  useEffect(() => {
    if (!showWarning) return;
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWarning, secondsLeft]);

  const handleStayLoggedIn = useCallback(() => {
    setShowWarning(false);
    setSecondsLeft(60);
    resetTimers();
  }, [resetTimers]);

  return (
    <>
      {showWarning && (
        <IdleWarningModal
          secondsLeft={secondsLeft}
          onStayLoggedIn={handleStayLoggedIn}
          onLogoutNow={handleLogout}
        />
      )}
      <div className="min-h-screen bg-gray-50">
        <TrialBanner />
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((previous) => !previous)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          branding={branding}
        />

        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar overlay"
          />
        )}

        <div
          className={`transition-all duration-300 ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}
        >
          <Header
            branding={branding}
            onMenuToggle={() => setMobileOpen((previous) => !previous)}
          />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      <RoleGuard>
        <DashboardShell>{children}</DashboardShell>
      </RoleGuard>
    </AuthProvider>
  );
}
