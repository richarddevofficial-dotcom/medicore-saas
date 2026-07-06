"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { ArrowLeft, Save, Hospital, Shield, Bell } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
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
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => router.push("/admin")}
            >
              Back
            </Button>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
          <Button icon={Save} onClick={handleSave} isLoading={saving}>
            Save Changes
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Hospital className="h-5 w-5 text-orange-500" />
              <h2 className="font-semibold">Hospital Information</h2>
            </div>
            <div className="space-y-4">
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
                label="Address"
                value={settings.address}
                onChange={(e) =>
                  setSettings({ ...settings, address: e.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-4">
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
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-orange-500" />
              <h2 className="font-semibold">System Preferences</h2>
            </div>
            <div className="space-y-4">
              <Input label="Currency" value="SSP" disabled />
              <Input label="Timezone" value="Africa/Juba" disabled />
              <Input label="Language" value="English" disabled />
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Bell className="h-5 w-5 text-orange-500" />
              <h2 className="font-semibold">Notifications</h2>
            </div>
            <div className="space-y-3">
              {[
                "Email notifications",
                "SMS alerts",
                "Low stock alerts",
                "Appointment reminders",
              ].map((item) => (
                <label
                  key={item}
                  className="flex items-center justify-between py-2 border-b cursor-pointer"
                >
                  <span className="text-sm">{item}</span>
                  <input type="checkbox" defaultChecked className="rounded" />
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-orange-500" />
              <h2 className="font-semibold">Security</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm">Session Timeout</span>
                <span className="font-medium">30 minutes</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm">Max Login Attempts</span>
                <span className="font-medium">5</span>
              </div>
              <label className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-sm">Two-Factor Authentication</span>
                <input type="checkbox" className="rounded" />
              </label>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
