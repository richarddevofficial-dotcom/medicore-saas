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
    country: "",
    primary_color: "#F97316",
    secondary_color: "#1E3A5F",
    custom_domain: "",
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
      await apiClient.put("/hospitals/settings/", {
        ...settings,
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        custom_domain: settings.custom_domain,
      });
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
