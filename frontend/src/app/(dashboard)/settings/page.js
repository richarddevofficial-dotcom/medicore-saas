"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AdminBackButton from "@/components/ui/AdminBackButton";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { Save, Building2, Shield, Bell } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [settings, setSettings] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
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
          });
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
      await apiClient.put("/hospitals/settings/", settings);
      toast.success("Settings saved!");
    } catch (err) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      toast.error("Current and new password are required");
      return;
    }

    if (passwordForm.newPassword.length < 12) {
      toast.error("New password must be at least 12 characters");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    setChangingPassword(true);
    try {
      await apiClient.post("/auth/password/change/", {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });
      toast.success("Password changed successfully");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      const errData = err?.response?.data;
      toast.error(
        errData?.error ||
          errData?.detail ||
          Object.values(errData || {})?.[0] ||
          "Failed to change password",
      );
    } finally {
      setChangingPassword(false);
    }
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
          <div className="flex items-center gap-4">
            <AdminBackButton />
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-sm text-gray-500 mt-1">
                For hospital branding & domain settings, visit{" "}
                <Link
                  href="/admin/settings"
                  className="text-orange-500 hover:underline"
                >
                  Admin Settings
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="h-5 w-5 text-orange-500" />
            <h2 className="font-semibold">Hospital Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Hospital Name"
              value={settings.name}
              onChange={(e) =>
                setSettings({ ...settings, name: e.target.value })
              }
            />
            <Input
              label="Email"
              type="email"
              value={settings.email}
              onChange={(e) =>
                setSettings({ ...settings, email: e.target.value })
              }
            />
            <Input
              label="Phone"
              value={settings.phone}
              onChange={(e) =>
                setSettings({ ...settings, phone: e.target.value })
              }
            />
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
              label="Address"
              value={settings.address}
              onChange={(e) =>
                setSettings({ ...settings, address: e.target.value })
              }
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} isLoading={saving}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Bell className="h-5 w-5 text-orange-500" />
              <h2 className="font-semibold">Notifications</h2>
            </div>
            <p className="text-sm text-gray-500">
              Notification preferences are managed by your system administrator.
              Contact support to configure email or SMS alerts.
            </p>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-orange-500" />
              <h2 className="font-semibold">Security</h2>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm">Session Timeout</span>
                <span className="font-medium">5 minutes (idle)</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm">Max Login Attempts</span>
                <span className="font-medium">5</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Two-Factor Authentication</span>
                <span className="text-xs text-gray-400">Coming soon</span>
              </div>

              <div className="pt-2 border-t">
                <h3 className="text-sm font-semibold mb-3">Change Password</h3>
                <div className="space-y-3">
                  <Input
                    label="Current Password"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: e.target.value,
                      })
                    }
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: e.target.value,
                      })
                    }
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                  <Button
                    onClick={handleChangePassword}
                    isLoading={changingPassword}
                  >
                    Update Password
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
