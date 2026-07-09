"use client";

import AuthProvider from "@/providers/AuthProvider";
import { useBranding } from "@/hooks/useBranding";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import RoleGuard from "@/components/auth/RoleGuard";
import TrialBanner from "@/components/ui/TrialBanner";
import { useState } from "react";

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: branding } = useBranding();

  return (
    <AuthProvider>
      <RoleGuard>
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
      </RoleGuard>
    </AuthProvider>
  );
}
