"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [domainSetupLoading, setDomainSetupLoading] = useState(false);
  const [domainVerifyLoading, setDomainVerifyLoading] = useState(false);
  const [domainVerification, setDomainVerification] = useState(null);

  const [settings, setSettings] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    primary_color: "#F97316",
    secondary_color: "#1E3A5F",
    custom_domain: "",
    domain_status: "unconfigured",
    domain_verification_token: "",
    domain_verified_at: null,
    domain_last_checked_at: null,
    platform_subdomain: "",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await apiClient.get("/hospitals/settings/");
        if (data) {
          setSettings({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            country: data.country || "",
            primary_color: data.primary_color || "#F97316",
            secondary_color: data.secondary_color || "#1E3A5F",
            custom_domain: data.custom_domain || "",
            domain_status: data.domain_status || "unconfigured",
            domain_verification_token: data.domain_verification_token || "",
            domain_verified_at: data.domain_verified_at || null,
            domain_last_checked_at: data.domain_last_checked_at || null,
            platform_subdomain: data.platform_subdomain || "",
          });

          if (data.custom_domain && data.domain_verification_token) {
            setDomainVerification({
              type: "dns-txt",
              name: `_medicore-verify.${data.custom_domain}`,
              value: data.domain_verification_token,
              instruction: "Create this TXT record in your DNS zone.",
            });
          }
        }
      } catch (err) {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put("/hospitals/settings/", {
        ...settings,
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        custom_domain: settings.custom_domain,
      });
      await queryClient.invalidateQueries({ queryKey: ["hospital-branding"] });
      toast.success("Settings saved!");

      // Refresh local settings so domain status/token UI stays in sync.
      const refreshed = await apiClient.get("/hospitals/settings/");
      const data = refreshed.data || {};
      setSettings((previous) => ({
        ...previous,
        custom_domain: data.custom_domain || "",
        domain_status: data.domain_status || "unconfigured",
        domain_verification_token: data.domain_verification_token || "",
        domain_verified_at: data.domain_verified_at || null,
        domain_last_checked_at: data.domain_last_checked_at || null,
        platform_subdomain: data.platform_subdomain || "",
      }));

      if (data.custom_domain && data.domain_verification_token) {
        setDomainVerification({
          type: "dns-txt",
          name: `_medicore-verify.${data.custom_domain}`,
          value: data.domain_verification_token,
          instruction: "Create this TXT record in your DNS zone.",
        });
      }
    } catch (err) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDomainSetup = async () => {
    const domain = (settings.custom_domain || "").trim().toLowerCase();
    if (!domain) {
      toast.error("Enter a custom domain first");
      return;
    }

    setDomainSetupLoading(true);
    try {
      const { data } = await apiClient.post("/hospitals/domain_setup/", {
        custom_domain: domain,
      });

      setSettings((previous) => ({
        ...previous,
        custom_domain: data.custom_domain || domain,
        domain_status: data.domain_status || "pending",
      }));
      setDomainVerification(data.verification || null);
      toast.success("Domain setup created. Add DNS TXT record to continue.");
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.custom_domain?.[0] ||
        "Failed to setup domain";
      toast.error(message);
    } finally {
      setDomainSetupLoading(false);
    }
  };

  const handleDomainVerify = async () => {
    const domain = (settings.custom_domain || "").trim().toLowerCase();
    if (!domain) {
      toast.error("Enter a custom domain first");
      return;
    }

    setDomainVerifyLoading(true);
    try {
      const { data } = await apiClient.post("/hospitals/domain_verify/", {
        custom_domain: domain,
      });

      setSettings((previous) => ({
        ...previous,
        domain_status: data.domain_status || "verified",
        domain_verified_at: data.domain_verified_at || null,
      }));
      toast.success("Domain verified successfully");
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Domain verification failed";
      toast.error(message);
      setSettings((previous) => ({
        ...previous,
        domain_status: "failed",
      }));
    } finally {
      setDomainVerifyLoading(false);
    }
  };

  const statusTone = {
    unconfigured: "bg-slate-100 text-slate-700 border-slate-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    verified: "bg-emerald-100 text-emerald-700 border-emerald-200",
    failed: "bg-red-100 text-red-700 border-red-200",
  };

  if (loading)
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hospital Settings</h1>
            <p className="text-sm text-gray-500">Manage hospital information</p>
          </div>
          <Button onClick={handleSave} isLoading={saving}>
            Save Changes
          </Button>
        </div>
        <Card>
          <h2 className="font-semibold mb-4">🎨 White Labeling / Branding</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.primary_color || "#F97316"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        primary_color: e.target.value,
                      })
                    }
                    className="h-10 w-16 rounded border cursor-pointer"
                  />
                  <Input
                    value={settings.primary_color || "#F97316"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        primary_color: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.secondary_color || "#1E3A5F"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        secondary_color: e.target.value,
                      })
                    }
                    className="h-10 w-16 rounded border cursor-pointer"
                  />
                  <Input
                    value={settings.secondary_color || "#1E3A5F"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        secondary_color: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <Input
              label="Custom Domain"
              value={settings.custom_domain || ""}
              onChange={(e) =>
                setSettings({ ...settings, custom_domain: e.target.value })
              }
              placeholder="e.g., nile.medicore.com"
            />

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-emerald-800">
                Managed Subdomain (Recommended)
              </p>
              <p className="text-xs text-emerald-700">
                Your hospital can use a managed subdomain under medicore.com.
              </p>
              <div className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900">
                {settings.platform_subdomain || "Not available"}
              </div>
              <p className="text-xs text-emerald-700">
                This is automatically generated from your hospital slug and does
                not require external DNS setup.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-700">
                  Domain Verification
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[settings.domain_status] || statusTone.unconfigured}`}
                >
                  {(settings.domain_status || "unconfigured").toUpperCase()}
                </span>
              </div>

              <p className="text-xs text-gray-600">
                1. Save your domain, 2. click Setup DNS Instructions, 3. add the
                TXT record at your DNS provider, 4. click Verify Domain.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleDomainSetup}
                  isLoading={domainSetupLoading}
                >
                  Setup DNS Instructions
                </Button>
                <Button
                  onClick={handleDomainVerify}
                  isLoading={domainVerifyLoading}
                  disabled={!settings.custom_domain}
                >
                  Verify Domain
                </Button>
              </div>

              {domainVerification && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
                  <p>
                    <span className="font-semibold">Type:</span>{" "}
                    {domainVerification.type || "dns-txt"}
                  </p>
                  <p>
                    <span className="font-semibold">Name:</span>{" "}
                    {domainVerification.name}
                  </p>
                  <p>
                    <span className="font-semibold">Value:</span>{" "}
                    {domainVerification.value}
                  </p>
                  <p>{domainVerification.instruction}</p>
                </div>
              )}

              {settings.domain_verified_at && (
                <p className="text-xs text-emerald-700">
                  Verified at:{" "}
                  {new Date(settings.domain_verified_at).toLocaleString()}
                </p>
              )}
            </div>

            <div
              className="p-4 rounded-lg border"
              style={{ backgroundColor: settings.primary_color || "#F97316" }}
            >
              <p className="text-white font-bold">Primary Color Preview</p>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{ backgroundColor: settings.secondary_color || "#1E3A5F" }}
            >
              <p className="text-white font-bold">Secondary Color Preview</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Hospital Information</h2>
          <div className="space-y-4">
            <Input
              label="Hospital Name"
              value={settings.name}
              onChange={(e) =>
                setSettings({ ...settings, name: e.target.value })
              }
            />
            <Input
              label="Email Address"
              type="email"
              value={settings.email}
              onChange={(e) =>
                setSettings({ ...settings, email: e.target.value })
              }
            />
            <Input
              label="Phone Number"
              value={settings.phone}
              onChange={(e) =>
                setSettings({ ...settings, phone: e.target.value })
              }
            />
            <Input
              label="Address"
              value={settings.address}
              onChange={(e) =>
                setSettings({ ...settings, address: e.target.value })
              }
            />
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="City"
                value={settings.city}
                onChange={(e) =>
                  setSettings({ ...settings, city: e.target.value })
                }
              />
              <Input
                label="State"
                value={settings.state}
                onChange={(e) =>
                  setSettings({ ...settings, state: e.target.value })
                }
              />
              <Input
                label="Country"
                value={settings.country}
                onChange={(e) =>
                  setSettings({ ...settings, country: e.target.value })
                }
              />
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
