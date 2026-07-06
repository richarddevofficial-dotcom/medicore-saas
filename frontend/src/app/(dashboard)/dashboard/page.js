"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import apiClient from "@/lib/api-client";
import toast from "react-hot-toast";
import {
  Users,
  Calendar,
  Stethoscope,
  DollarSign,
  TrendingUp,
  Activity,
  FlaskConical,
  ArrowRight,
  Clock,
  Shield,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#F97316",
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trialInfo, setTrialInfo] = useState(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    // Check if super admin is impersonating a hospital
    const hospitalId = sessionStorage.getItem("impersonating_hospital_id");
    if (hospitalId) {
      setIsImpersonating(true);
    }
  }, []);

  useEffect(() => {
    apiClient
      .get("/hospitals/my_hospital/")
      .then((res) => setTrialInfo(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [patientRes, billRes, staffRes, chartRes] = await Promise.all([
          apiClient.get("/patients/stats/"),
          apiClient.get("/bills/stats/"),
          apiClient.get("/staff/stats/"),
          apiClient.get("/reports/dashboard-charts/"),
        ]);
        setStats({
          patients: patientRes.data,
          billing: billRes.data,
          staff: staffRes.data,
          charts: chartRes.data,
        });
      } catch (err) {
        console.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleSwitchBack = () => {
    // Restore super admin state from sessionStorage
    const savedState = sessionStorage.getItem("super_admin_state");
    if (savedState) {
      const state = JSON.parse(savedState);
      localStorage.setItem("token", state.token);
      localStorage.setItem("user", state.user);
      localStorage.setItem("role", state.role);
      localStorage.setItem("is_superuser", state.isSuperuser);
    }

    // Clear impersonation data
    sessionStorage.removeItem("super_admin_state");
    sessionStorage.removeItem("impersonating_hospital_id");

    // IMPORTANT: Remove hospital data from localStorage
    localStorage.removeItem("hospital");

    toast.success("Back to Super Admin");
    router.push("/super-admin");
  };

  const monthlyData = stats?.charts?.monthly || [];
  const weeklyData = stats?.charts?.weekly || [];
  const pieData = stats?.charts?.revenue_distribution || [];

  const quickActions = [
    {
      name: "Register Patient",
      icon: Users,
      href: "/patients/add",
      color: "bg-blue-50 text-blue-600",
    },
    {
      name: "Book Appointment",
      icon: Calendar,
      href: "/appointments/book",
      color: "bg-green-50 text-green-600",
    },
    {
      name: "Doctor Queue",
      icon: Stethoscope,
      href: "/doctors/queue",
      color: "bg-purple-50 text-purple-600",
    },
    {
      name: "Billing Desk",
      icon: DollarSign,
      href: "/billing",
      color: "bg-orange-50 text-orange-600",
    },
  ];

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
        {/* Switch Back Banner - Shows only when super admin is impersonating */}
        {isImpersonating && (
          <Card className="border-2 border-blue-400 bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-blue-900">
                    Viewing as Hospital Admin
                  </h3>
                  <p className="text-sm text-blue-700">
                    You are currently logged in as{" "}
                    {(() => {
                      try {
                        const hospitalData = JSON.parse(
                          localStorage.getItem("hospital") || "null",
                        );
                        return hospitalData?.name || "Hospital";
                      } catch {
                        return "Hospital";
                      }
                    })()}
                  </p>
                </div>
              </div>
              <Button onClick={handleSwitchBack} variant="outline" size="sm">
                🛡️ Back to Super Admin
              </Button>
            </div>
          </Card>
        )}

        {/* Trial Banner */}
        {trialInfo?.subscription_plan === "trial" && (
          <Card
            className={`border-2 ${trialInfo.days_left <= 3 ? "border-red-400 bg-red-50" : "border-orange-400 bg-orange-50"}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">
                  {trialInfo.days_left > 0
                    ? "🎉 Free Trial Active"
                    : "⚠️ Trial Expired"}
                </h3>
                <p className="text-sm mt-1">
                  {trialInfo.days_left > 0
                    ? `${trialInfo.days_left} day${trialInfo.days_left !== 1 ? "s" : ""} remaining.`
                    : "Please upgrade to continue."}
                </p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full w-64">
                  <div
                    className={`h-2 rounded-full ${trialInfo.days_left <= 3 ? "bg-red-500" : "bg-orange-500"}`}
                    style={{
                      width: `${Math.max((trialInfo.days_left / 14) * 100, 5)}%`,
                    }}
                  />
                </div>
              </div>
              <Button>Upgrade Now</Button>
            </div>
          </Card>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Welcome back! Here&apos;s your hospital overview.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.name}
                onClick={() => router.push(action.href)}
                className={`flex items-center gap-3 p-4 rounded-xl transition-all hover:shadow-md ${action.color}`}
              >
                <Icon className="h-6 w-6" />
                <div className="text-left">
                  <p className="text-sm font-semibold">{action.name}</p>
                  <p className="text-xs opacity-70">Click to open</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
              </button>
            );
          })}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.patients?.total_patients || 0}
                </p>
                <p className="text-xs text-gray-500">Total Patients</p>
                <p className="text-xs text-green-600">
                  +{stats?.patients?.today_new || 0} today
                </p>
              </div>
            </div>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  SSP {(stats?.billing?.revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="text-xs text-green-600">
                  {stats?.billing?.paid || 0} paid
                </p>
              </div>
            </div>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.patients?.waiting || 0}
                </p>
                <p className="text-xs text-gray-500">Waiting</p>
                <p className="text-xs text-orange-600">
                  {stats?.patients?.in_consultation || 0} in consultation
                </p>
              </div>
            </div>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-orange-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.staff?.doctors || 0}
                </p>
                <p className="text-xs text-gray-500">Doctors Available</p>
                <p className="text-xs text-green-600">
                  {stats?.staff?.active || 0} active staff
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" /> Patient Visits &
              Revenue
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis yAxisId="left" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" fontSize={12} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="patients"
                  stroke="#F97316"
                  strokeWidth={2}
                  name="Patients"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Revenue (SSP)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" /> Weekly Activity
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="consultations"
                  fill="#F97316"
                  name="Consultations"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="lab"
                  fill="#8B5CF6"
                  name="Lab Tests"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="pharmacy"
                  fill="#10B981"
                  name="Pharmacy"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" /> Revenue
              Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" /> Today&apos;s Summary
            </h3>
            <div className="space-y-3">
              {[
                {
                  label: "Patients Registered",
                  value: stats?.patients?.today_new || 0,
                  icon: Users,
                  color: "blue",
                },
                {
                  label: "In Consultation",
                  value: stats?.patients?.in_consultation || 0,
                  icon: Stethoscope,
                  color: "purple",
                },
                {
                  label: "Lab Tests",
                  value: stats?.patients?.lab_requested || 0,
                  icon: FlaskConical,
                  color: "orange",
                },
                {
                  label: "Treated Today",
                  value: stats?.patients?.treated_today || 0,
                  icon: Activity,
                  color: "green",
                },
                {
                  label: "Revenue Today",
                  value: `SSP ${(stats?.billing?.revenue || 0).toLocaleString()}`,
                  icon: DollarSign,
                  color: "green",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 bg-${item.color}-100 rounded-lg flex items-center justify-center`}
                    >
                      <item.icon className={`h-4 w-4 text-${item.color}-600`} />
                    </div>
                    <span className="text-sm text-gray-600">{item.label}</span>
                  </div>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
