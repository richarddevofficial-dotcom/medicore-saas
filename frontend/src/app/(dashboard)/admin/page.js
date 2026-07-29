"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import apiClient from "@/lib/api-client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bed,
  Building,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Minus,
  Pill,
  RefreshCw,
  Settings,
  Settings2,
  Shield,
  ShieldCheck,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

function formatSSP(amount) {
  const value = Number(amount || 0);
  return `SSP ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getSeverityClass(level) {
  if (level === "high") return "border-red-200 bg-red-50 text-red-800";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function buildTrend(current, previous) {
  const curr = Number(current || 0);
  const prev = Number(previous || 0);
  const diff = curr - prev;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const percent = prev === 0 ? null : (diff / prev) * 100;
  return { current: curr, previous: prev, diff, direction, percent };
}

function TrendPill({ trend, positiveWhenUp = true }) {
  const isFlat = trend.direction === "flat";
  const isPositive = isFlat
    ? false
    : positiveWhenUp
      ? trend.direction === "up"
      : trend.direction === "down";

  const toneClass = isFlat
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : isPositive
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-red-200 bg-red-50 text-red-700";

  const Icon =
    trend.direction === "up"
      ? TrendingUp
      : trend.direction === "down"
        ? TrendingDown
        : Minus;

  const deltaText =
    trend.direction === "flat"
      ? "No change vs yesterday"
      : trend.percent !== null
        ? `${trend.diff > 0 ? "+" : ""}${trend.percent.toFixed(1)}% vs yesterday`
        : `${trend.diff > 0 ? "+" : ""}${Math.abs(trend.diff)} vs yesterday`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {deltaText}
    </span>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshIntervalSeconds, setAutoRefreshIntervalSeconds] =
    useState(60);
  const [endpointHealth, setEndpointHealth] = useState({
    staff: "idle",
    patients: "idle",
    departments: "idle",
    reportsDaily: "idle",
    reportsYesterday: "idle",
    billing: "idle",
    pharmacy: "idle",
  });
  const [fetchErrors, setFetchErrors] = useState([]);

  const fetchAdminData = useCallback(async (mountedRef = { current: true }) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = toISODate(yesterday);

      const [
        staffRes,
        patientRes,
        deptRes,
        detailedRes,
        detailedYesterdayRes,
        billingStatsRes,
        pharmacyRes,
      ] = await Promise.all([
        apiClient.get("/staff/"),
        apiClient.get("/patients/stats/"),
        apiClient.get("/departments/"),
        apiClient.get("/reports/detailed/?period=daily"),
        apiClient.get(
          `/reports/detailed/?start_date=${yesterdayISO}&end_date=${yesterdayISO}`,
        ),
        apiClient.get("/bills/stats/"),
        apiClient.get("/reports/pharmacy/"),
      ]);

      setEndpointHealth({
        staff: "ok",
        patients: "ok",
        departments: "ok",
        reportsDaily: "ok",
        reportsYesterday: "ok",
        billing: "ok",
        pharmacy: "ok",
      });
      setFetchErrors([]);

      if (!mountedRef.current) return;

      const staffData = staffRes.data || {};
      const patientData = patientRes.data || {};
      const departmentsData = deptRes.data || [];
      const detailedData = detailedRes.data || {};
      const detailedYesterdayData = detailedYesterdayRes.data || {};
      const billingStats = billingStatsRes.data || {};
      const pharmacyData = pharmacyRes.data || {};

      const staffRows = Array.isArray(staffData)
        ? staffData
        : Array.isArray(staffData?.results)
          ? staffData.results
          : [];

      const totalStaff = staffRows.length;
      const activeStaff = staffRows.filter(
        (member) => member?.is_active,
      ).length;
      const doctorsCount = staffRows.filter(
        (member) => member?.role === "doctor",
      ).length;
      const nursesCount = staffRows.filter(
        (member) => member?.role === "nurse",
      ).length;
      const activeRate =
        totalStaff > 0 ? Math.round((activeStaff / totalStaff) * 100) : 0;

      setStats({
        totalStaff,
        activeStaff,
        activeRate,
        doctors: doctorsCount,
        nurses: nursesCount,
        totalPatients: patientData.total_patients || 0,
        todayNewPatients: patientData.today_new || 0,
        waitingPatients: patientData.waiting || 0,
        departments:
          departmentsData.results?.length || departmentsData.length || 0,
        pendingBillingAmount: detailedData?.billing?.pending || 0,
        previousPendingBillingAmount:
          detailedYesterdayData?.billing?.pending || 0,
        pendingBills:
          Math.max(
            (billingStats.total_bills || 0) - (billingStats.paid || 0),
            0,
          ) || 0,
        dailyRevenue: detailedData?.billing?.revenue || 0,
        previousDailyRevenue: detailedYesterdayData?.billing?.revenue || 0,
        previousTodayNewPatients: detailedYesterdayData?.patients?.new || 0,
        pharmacyPending: pharmacyData.pending || 0,
        pharmacyDispensedToday: pharmacyData.dispensed_today || 0,
      });

      const computedAlerts = [];
      const pendingAmount = Number(detailedData?.billing?.pending || 0);
      const pendingBillsCount = Math.max(
        (billingStats.total_bills || 0) - (billingStats.paid || 0),
        0,
      );
      const waitingCount = Number(patientData.waiting || 0);
      const pharmacyPendingCount = Number(pharmacyData.pending || 0);

      if (pendingAmount > 0) {
        computedAlerts.push({
          title: "Outstanding Billing Balance",
          message: `${formatSSP(pendingAmount)} pending across ${pendingBillsCount} bill(s).`,
          level: pendingAmount > 50000 ? "high" : "medium",
          href: "/billing",
        });
      }

      if (waitingCount > 0) {
        computedAlerts.push({
          title: "Patients Waiting for Clinical Progress",
          message: `${waitingCount} patient(s) are still marked as waiting.`,
          level: waitingCount > 10 ? "high" : "medium",
          href: "/reception",
        });
      }

      if (pharmacyPendingCount > 0) {
        computedAlerts.push({
          title: "Pharmacy Queue Requires Attention",
          message: `${pharmacyPendingCount} prescription(s) pending payment or dispensing readiness.`,
          level: pharmacyPendingCount > 20 ? "high" : "medium",
          href: "/pharmacy",
        });
      }

      if (computedAlerts.length === 0) {
        computedAlerts.push({
          title: "Operational Health Stable",
          message:
            "No critical operational bottlenecks detected for the current period.",
          level: "low",
          href: "/admin/reports",
        });
      }

      setAlerts(computedAlerts);

      setHighlights([
        {
          title: "Revenue Collected (Today)",
          value: formatSSP(detailedData?.billing?.revenue || 0),
          description: "Daily confirmed paid revenue",
          href: "/admin/reports",
          icon: Wallet,
          trend: buildTrend(
            detailedData?.billing?.revenue || 0,
            detailedYesterdayData?.billing?.revenue || 0,
          ),
          positiveWhenUp: true,
        },
        {
          title: "Patients Registered (Today)",
          value: String(patientData.today_new || 0),
          description: "New registrations within the active reporting window",
          href: "/patients",
          icon: Users,
          trend: buildTrend(
            patientData.today_new || 0,
            detailedYesterdayData?.patients?.new || 0,
          ),
          positiveWhenUp: true,
        },
        {
          title: "Prescriptions Dispensed (Today)",
          value: String(pharmacyData.dispensed_today || 0),
          description: "Completed pharmacy handovers today",
          href: "/pharmacy",
          icon: Pill,
          trend: buildTrend(pharmacyData.dispensed_today || 0, 0),
          positiveWhenUp: true,
        },
        {
          title: "Staff Utilization",
          value: `${activeRate}%`,
          description: `${activeStaff} out of ${totalStaff} staff currently active`,
          href: "/admin/users",
          icon: Activity,
          trend: buildTrend(activeRate, activeRate),
          positiveWhenUp: true,
        },
      ]);

      setLastSync(new Date(detailedData?.generated_at || Date.now()));
    } catch (error) {
      console.error("Failed to load admin command center data:", error);
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        "Unknown fetch error";
      setFetchErrors([`Admin dashboard data fetch failed: ${message}`]);

      // Mark endpoints as failed to make outages visible to users.
      setEndpointHealth({
        staff: "error",
        patients: "error",
        departments: "error",
        reportsDaily: "error",
        reportsYesterday: "error",
        billing: "error",
        pharmacy: "error",
      });
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const mountedRef = { current: true };
    fetchAdminData(mountedRef);

    return () => {
      mountedRef.current = false;
    };
  }, [fetchAdminData]);

  useEffect(() => {
    if (!autoRefreshEnabled || isLoading) return;

    const interval = setInterval(() => {
      setIsRefreshing(true);
      fetchAdminData({ current: true });
    }, autoRefreshIntervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [
    autoRefreshEnabled,
    autoRefreshIntervalSeconds,
    isLoading,
    fetchAdminData,
  ]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAdminData({ current: true });
  };

  const quickActions = [
    {
      name: "Create Staff Account",
      desc: "Onboard doctor, nurse, pharmacist or receptionist.",
      icon: UserPlus,
      href: "/admin/users",
      accent: "from-cyan-500 to-blue-600",
    },
    {
      name: "Review Reports",
      desc: "Check finance, utilization and service trend snapshots.",
      icon: ClipboardCheck,
      href: "/admin/reports",
      accent: "from-emerald-500 to-teal-600",
    },
    {
      name: "Audit Security Logs",
      desc: "Inspect authentication and critical system events.",
      icon: ShieldCheck,
      href: "/admin/logs",
      accent: "from-amber-500 to-orange-600",
    },
    {
      name: "Tune Hospital Settings",
      desc: "Update operational defaults and organization profile.",
      icon: Settings2,
      href: "/admin/settings",
      accent: "from-violet-500 to-indigo-600",
    },
  ];

  const adminSections = useMemo(
    () => [
      {
        title: "Operations",
        subtitle: "Team setup, structure and day-to-day administration",
        modules: [
          {
            name: "Manage Users",
            icon: Users,
            desc: "Add, edit and manage all staff accounts.",
            tag: "Identity",
            href: "/admin/users",
          },
          {
            name: "Manage Roles",
            icon: UserCog,
            desc: "Configure role responsibilities and controls.",
            tag: "Access",
            href: "/admin/roles",
          },
          {
            name: "Departments",
            icon: Building2,
            desc: "Organize and maintain hospital departments.",
            tag: "Structure",
            href: "/admin/departments",
          },
          {
            name: "Doctors",
            icon: Stethoscope,
            desc: "Manage doctor profiles, shifts and assignment.",
            tag: "Clinical",
            href: "/doctors",
          },
        ],
      },
      {
        title: "Clinical Services",
        subtitle: "Core service modules that drive patient care",
        modules: [
          {
            name: "Rooms & Wards",
            icon: Bed,
            desc: "Maintain wards, rooms and bed capacity.",
            tag: "Capacity",
            href: "/admin/rooms",
          },
          {
            name: "Medicines",
            icon: Pill,
            desc: "Control medicine catalog and stock details.",
            tag: "Pharmacy",
            href: "/admin/medicines",
          },
          {
            name: "Lab Tests",
            icon: FlaskConical,
            desc: "Configure and maintain laboratory services.",
            tag: "Diagnostics",
            href: "/admin/lab",
          },
          {
            name: "Imaging",
            icon: Camera,
            desc: "Manage X-Ray, MRI and radiology workflows.",
            tag: "Radiology",
            href: "/admin/imaging",
          },
          {
            name: "Insurance",
            icon: Shield,
            desc: "Manage insurance providers and coverage setup.",
            tag: "Coverage",
            href: "/admin/insurance",
          },
        ],
      },
      {
        title: "Governance",
        subtitle: "Visibility, control and compliance oversight",
        modules: [
          {
            name: "Reports",
            icon: FileText,
            desc: "View executive and operational performance data.",
            tag: "Analytics",
            href: "/admin/reports",
          },
          {
            name: "Audit Logs",
            icon: Database,
            desc: "Review system actions and security events.",
            tag: "Security",
            href: "/admin/logs",
          },
          {
            name: "Settings",
            icon: Settings,
            desc: "Configure global hospital administration settings.",
            tag: "System",
            href: "/admin/settings",
          },
        ],
      },
    ],
    [],
  );

  const totalModules = useMemo(() => {
    return adminSections.reduce(
      (count, section) => count + section.modules.length,
      0,
    );
  }, [adminSections]);

  const overviewCards = useMemo(() => {
    return [
      {
        label: "Total Staff",
        value: stats?.totalStaff || 0,
        hint: `${stats?.activeRate || 0}% currently active`,
        icon: Users,
      },
      {
        label: "Departments",
        value: stats?.departments || 0,
        hint: "Service coverage map",
        icon: Building,
      },
      {
        label: "Doctors",
        value: stats?.doctors || 0,
        hint: `${stats?.nurses || 0} nurses supporting care`,
        icon: Stethoscope,
      },
      {
        label: "Total Patients",
        value: stats?.totalPatients || 0,
        hint: `${stats?.todayNewPatients || 0} registered today`,
        icon: Activity,
      },
    ];
  }, [stats]);

  return (
    <DashboardLayout>
      <div className="space-y-6 lg:space-y-8">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-sm sm:p-8">
          <div className="absolute right-0 top-0 h-56 w-56 -translate-y-16 translate-x-16 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="absolute bottom-0 left-0 h-36 w-36 -translate-x-10 translate-y-8 rounded-full bg-blue-500/20 blur-2xl" />

          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Admin Command Center
                </p>
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                  Professional Hospital Administration Hub
                </h1>
                <p className="text-sm text-slate-200 sm:text-base">
                  Control operations, monitor clinical services and secure
                  governance from a single executive dashboard.
                </p>
              </div>

              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Button
                  variant={autoRefreshEnabled ? "secondary" : "outline"}
                  className={
                    autoRefreshEnabled
                      ? "bg-white/15 text-white hover:bg-white/25"
                      : "border-white/40 bg-transparent text-white hover:bg-white/10"
                  }
                  onClick={() => setAutoRefreshEnabled((prev) => !prev)}
                >
                  Auto Refresh: {autoRefreshEnabled ? "ON" : "OFF"}
                </Button>
                <select
                  value={autoRefreshIntervalSeconds}
                  onChange={(e) =>
                    setAutoRefreshIntervalSeconds(Number(e.target.value))
                  }
                  className="rounded-lg border border-white/40 bg-transparent px-3 py-2 text-sm text-white outline-none"
                >
                  <option value={30} className="text-slate-900">
                    30s
                  </option>
                  <option value={60} className="text-slate-900">
                    60s
                  </option>
                  <option value={120} className="text-slate-900">
                    120s
                  </option>
                </select>
                <Button
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white/10"
                  onClick={handleRefresh}
                  icon={RefreshCw}
                  isLoading={isRefreshing}
                >
                  Refresh
                </Button>
                <Button
                  variant="secondary"
                  className="bg-white/15 text-white hover:bg-white/25"
                  onClick={() => router.push("/admin/reports")}
                >
                  Open Reports
                </Button>
                <Button
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white/10"
                  onClick={() => router.push("/admin/settings")}
                >
                  Configuration
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-100">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                {totalModules} modules available
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                End-to-end administrative coverage
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                Last sync:{" "}
                {lastSync ? lastSync.toLocaleTimeString() : "--:--:--"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-100">
              {[
                { key: "staff", label: "Staff" },
                { key: "patients", label: "Patients" },
                { key: "departments", label: "Departments" },
                { key: "reportsDaily", label: "Report Daily" },
                { key: "billing", label: "Billing" },
                { key: "pharmacy", label: "Pharmacy" },
              ].map((item) => {
                const state = endpointHealth[item.key] || "idle";
                const tone =
                  state === "ok"
                    ? "border-emerald-300/40 bg-emerald-300/20"
                    : state === "error"
                      ? "border-red-300/40 bg-red-300/20"
                      : "border-white/20 bg-white/10";

                return (
                  <span
                    key={item.key}
                    className={`rounded-full border px-2 py-1 ${tone}`}
                  >
                    {item.label}:{" "}
                    {state === "ok"
                      ? "OK"
                      : state === "error"
                        ? "Error"
                        : "Pending"}
                  </span>
                );
              })}
            </div>

            {fetchErrors.length > 0 && (
              <div className="mt-4 rounded-lg border border-red-300/50 bg-red-400/20 p-3 text-xs text-red-50">
                <p className="font-semibold">Data fetch warning</p>
                <ul className="mt-1 space-y-1">
                  {fetchErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overviewCards.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="border-slate-200 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {item.label}
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                          {item.value}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.hint}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <Icon className="h-5 w-5 text-slate-700" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {alerts.map((alert) => (
                <button
                  key={alert.title}
                  type="button"
                  onClick={() => router.push(alert.href)}
                  className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${getSeverityClass(alert.level)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <p className="mt-1 text-xs leading-relaxed">
                        {alert.message}
                      </p>
                    </div>
                    {alert.level === "low" ? (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="border-red-200 bg-red-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Pending Balance Exposure
                </p>
                <p className="mt-2 text-2xl font-bold text-red-900">
                  {formatSSP(stats?.pendingBillingAmount || 0)}
                </p>
                <p className="mt-1 text-xs text-red-700">
                  {stats?.pendingBills || 0} unpaid bill(s) currently open.
                </p>
                <div className="mt-2">
                  <TrendPill
                    trend={buildTrend(
                      stats?.pendingBillingAmount || 0,
                      stats?.previousPendingBillingAmount || 0,
                    )}
                    positiveWhenUp={false}
                  />
                </div>
              </Card>
              <Card className="border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Patient Flow Pressure
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-900">
                  {stats?.waitingPatients || 0}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Patients waiting for next clinical action.
                </p>
              </Card>
              <Card className="border-cyan-200 bg-cyan-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  Pharmacy Queue Risk
                </p>
                <p className="mt-2 text-2xl font-bold text-cyan-900">
                  {stats?.pharmacyPending || 0}
                </p>
                <p className="mt-1 text-xs text-cyan-700">
                  Prescriptions awaiting payment or dispensing readiness.
                </p>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Operational Highlights
                </h2>
                <p className="text-xs text-slate-500">
                  Live data from billing, patient and pharmacy endpoints
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card
                      key={item.title}
                      hover
                      onClick={() => router.push(item.href)}
                      className="cursor-pointer border-slate-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {item.title}
                          </p>
                          <p className="mt-2 text-2xl font-bold text-slate-900">
                            {item.value}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.description}
                          </p>
                          {item.trend ? (
                            <div className="mt-2">
                              <TrendPill
                                trend={item.trend}
                                positiveWhenUp={item.positiveWhenUp !== false}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <Icon className="h-5 w-5 text-slate-700" />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Priority Actions
            </h2>
            <p className="text-xs text-slate-500">
              Fast access to your highest impact admin tasks
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.name}
                  type="button"
                  onClick={() => router.push(action.href)}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`inline-flex rounded-xl bg-gradient-to-r p-2.5 text-white ${action.accent}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-700" />
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">
                    {action.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{action.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          {adminSections.map((section) => (
            <section key={section.title} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {section.title}
                  </h2>
                  <p className="text-sm text-slate-500">{section.subtitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <Card
                      key={module.name}
                      hover
                      onClick={() => router.push(module.href)}
                      className="cursor-pointer border-slate-200 p-5"
                    >
                      <div className="flex items-start gap-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <Icon className="h-5 w-5 text-slate-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {module.tag}
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {module.name}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {module.desc}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
