"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import apiClient from "@/lib/api-client";
import {
  Users,
  UserCog,
  Building2,
  Bed,
  Pill,
  FlaskConical,
  Camera,
  Shield,
  Settings,
  FileText,
  Database,
  Activity,
  ArrowRight,
  Stethoscope,
} from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [staffRes, patientRes, deptRes] = await Promise.all([
          apiClient.get("/staff/stats/"),
          apiClient.get("/patients/stats/"),
          apiClient.get("/departments/"),
        ]);

        setStats({
          totalStaff: staffRes.data.total_staff || 0,
          doctors: staffRes.data.doctors || 0,
          nurses: staffRes.data.nurses || 0,
          active: staffRes.data.active || 0,
          totalPatients: patientRes.data.total_patients || 0,
          todayNew: patientRes.data.today_new || 0,
          departments: deptRes.data.results?.length || deptRes.data.length || 0,
        });
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  const adminModules = [
    {
      name: "Manage Users",
      icon: Users,
      desc: "Add, edit, remove staff accounts",
      color: "bg-blue-50 text-blue-600",
      href: "/admin/users",
    },
    {
      name: "Manage Roles",
      icon: UserCog,
      desc: "Define roles & permissions",
      color: "bg-purple-50 text-purple-600",
      href: "/admin/roles",
    },
    {
      name: "Departments",
      icon: Building2,
      desc: "Manage hospital departments",
      color: "bg-green-50 text-green-600",
      href: "/admin/departments",
    },
    {
      name: "Doctors",
      icon: Stethoscope,
      desc: "Manage doctor profiles",
      color: "bg-orange-50 text-orange-600",
      href: "/doctors",
    },
    {
      name: "Rooms & Wards",
      icon: Bed,
      desc: "Manage rooms, wards, beds",
      color: "bg-pink-50 text-pink-600",
      href: "/admin/rooms",
    },
    {
      name: "Medicines",
      icon: Pill,
      desc: "Pharmacy inventory",
      color: "bg-teal-50 text-teal-600",
      href: "/admin/medicines",
    },
    {
      name: "Lab Tests",
      icon: FlaskConical,
      desc: "Manage laboratory tests",
      color: "bg-indigo-50 text-indigo-600",
      href: "/admin/lab",
    },
    {
      name: "Imaging",
      icon: Camera,
      desc: "X-Ray, MRI, CT Scan",
      color: "bg-cyan-50 text-cyan-600",
      href: "/admin/imaging",
    },
    {
      name: "Insurance",
      icon: Shield,
      desc: "Insurance companies",
      color: "bg-yellow-50 text-yellow-600",
      href: "/admin/insurance",
    },
    {
      name: "Reports",
      icon: FileText,
      desc: "View all reports",
      color: "bg-red-50 text-red-600",
      href: "/admin/reports",
    },
    {
      name: "Audit Logs",
      icon: Database,
      desc: "System activity logs",
      color: "bg-gray-50 text-gray-600",
      href: "/admin/logs",
    },
    {
      name: "Settings",
      icon: Settings,
      desc: "System configuration",
      color: "bg-slate-50 text-slate-600",
      href: "/admin/settings",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            System management & configuration
          </p>
        </div>

        {/* Stats Overview */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center">
              <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalStaff || 0}
              </p>
              <p className="text-xs text-gray-500">Total Users</p>
            </Card>
            <Card className="text-center">
              <Building2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">
                {stats?.departments || 0}
              </p>
              <p className="text-xs text-gray-500">Departments</p>
            </Card>
            <Card className="text-center">
              <Stethoscope className="h-6 w-6 text-orange-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">
                {stats?.doctors || 0}
              </p>
              <p className="text-xs text-gray-500">Doctors</p>
            </Card>
            <Card className="text-center">
              <Activity className="h-6 w-6 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalPatients || 0}
              </p>
              <p className="text-xs text-gray-500">Patients</p>
            </Card>
          </div>
        )}

        {/* Admin Modules Grid */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Management Modules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminModules.map((module) => {
              const Icon = module.icon;
              return (
                <Card
                  key={module.name}
                  hover
                  onClick={() => router.push(module.href)}
                  className="cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${module.color.split(" ")[0]}`}
                    >
                      <Icon
                        className={`h-5 w-5 ${module.color.split(" ")[1]}`}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {module.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {module.desc}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
