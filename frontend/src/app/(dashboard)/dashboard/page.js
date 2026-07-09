"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
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
  const [endpointHealth, setEndpointHealth] = useState({
    patients: "idle",
    billing: "idle",
    staff: "idle",
    charts: "idle",
  });
  const [fetchErrors, setFetchErrors] = useState([]);

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
      const requests = [
        { key: "patients", path: "/patients/stats/" },
        { key: "billing", path: "/bills/stats/" },
        { key: "staff", path: "/staff/" },
        { key: "charts", path: "/reports/dashboard-charts/" },
      ];

      try {
        const settled = await Promise.allSettled(
          requests.map((request) => apiClient.get(request.path)),
        );

        const nextHealth = {
          patients: "error",
          billing: "error",
          staff: "error",
          charts: "error",
        };
        const nextErrors = [];
        const payload = {
          patients: {},
          billing: {},
          staff: {},
          charts: {},
        };

        settled.forEach((result, index) => {
          const endpoint = requests[index];
          if (result.status === "fulfilled") {
            nextHealth[endpoint.key] = "ok";
            payload[endpoint.key] = result.value?.data || {};
          } else {
            nextHealth[endpoint.key] = "error";
            nextErrors.push(
              `${endpoint.path} failed (${result.reason?.response?.status || "network"})`,
            );
          }
        });

        setEndpointHealth(nextHealth);
        setFetchErrors(nextErrors);

        const staffRows = Array.isArray(payload.staff)
          ? payload.staff
          : Array.isArray(payload.staff?.results)
            ? payload.staff.results
            : [];
        const computedStaff = {
          total_staff: staffRows.length,
          doctors: staffRows.filter((member) => member?.role === "doctor")
            .length,
          active: staffRows.filter((member) => member?.is_active).length,
        };

        setStats({
          patients: payload.patients,
          billing: payload.billing,
          staff: computedStaff,
          charts: payload.charts,
        });
      } catch (err) {
        console.error("Failed to load dashboard", err);
        setFetchErrors(["Dashboard request failed. Please retry."]);
        setEndpointHealth({
          patients: "error",
          billing: "error",
          staff: "error",
          charts: "error",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const isAllEndpointsDown = Object.values(endpointHealth).every(
    (state) => state === "error",
  );

  const isLikelyNoData =
    (stats?.patients?.total_patients || 0) === 0 &&
    (stats?.billing?.total_bills || 0) === 0 &&
    (stats?.staff?.total_staff || 0) === 0;

  const summaryRows = [
    {
      label: "Patients Registered",
      value: stats?.patients?.today_new || 0,
      icon: Users,
      boxClass: "bg-blue-100",
      iconClass: "text-blue-600",
    },
    {
      label: "In Consultation",
      value: stats?.patients?.in_consultation || 0,
      icon: Stethoscope,
      boxClass: "bg-purple-100",
      iconClass: "text-purple-600",
    },
    {
      label: "Lab Tests",
      value: stats?.patients?.lab_requested || 0,
      icon: FlaskConical,
      boxClass: "bg-orange-100",
      iconClass: "text-orange-600",
    },
    {
      label: "Treated Today",
      value: stats?.patients?.treated_today || 0,
      icon: Activity,
      boxClass: "bg-green-100",
      iconClass: "text-green-600",
    },
    {
      label: "Revenue Today",
      value: `SSP ${(stats?.billing?.revenue_today || 0).toLocaleString()}`,
      icon: DollarSign,
      boxClass: "bg-green-100",
      iconClass: "text-green-600",
    },
  ];

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
            <p className="text-xs text-gray-500 mt-1">
              Revenue Today = fully settled bills today; Collected today = cash
              received today (including partial payments).
            </p>
          </div>
        </div>

        {/* Data source health */}
        <Card className="border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Data Source Health
              </h2>
              <p className="text-xs text-gray-500">
                Live status for dashboard backend endpoints
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Patients", key: "patients" },
                { label: "Billing", key: "billing" },
                { label: "Staff", key: "staff" },
                { label: "Charts", key: "charts" },
              ].map((item) => {
                const status = endpointHealth[item.key] || "idle";
                const tone =
                  status === "ok"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : status === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-gray-200 bg-gray-50 text-gray-600";
                return (
                  <span
                    key={item.key}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
                  >
                    {item.label}:{" "}
                    {status === "ok"
                      ? "OK"
                      : status === "error"
                        ? "Error"
                        : "Pending"}
                  </span>
                );
              })}
            </div>
          </div>
          {fetchErrors.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-800">
                Some data failed to load:
              </p>
              <ul className="mt-1 text-xs text-red-700 space-y-1">
                {fetchErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {isAllEndpointsDown ? (
          <Card>
            <EmptyState
              imageSrc="/images/empty-states/reports-empty.svg"
              imageAlt="Dashboard unavailable"
              title="Dashboard data is currently unavailable"
              description="All dashboard endpoints failed. Check backend connectivity, then refresh this page."
              actionLabel="Open Reports"
              onAction={() => router.push("/admin/reports")}
            />
          </Card>
        ) : isLikelyNoData ? (
          <Card>
            <EmptyState
              imageSrc="/images/empty-states/patients-empty.svg"
              imageAlt="No hospital activity"
              title="No hospital activity yet"
              description="Start by registering your first patient or creating your first appointment to populate this dashboard."
              actionLabel="Register Patient"
              onAction={() => router.push("/patients/add")}
            />
          </Card>
        ) : null}

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
                  SSP {(stats?.billing?.collected_today || 0).toLocaleString()}{" "}
                  collected today
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
              {summaryRows.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.boxClass}`}
                    >
                      <item.icon className={`h-4 w-4 ${item.iconClass}`} />
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
