"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import apiClient from "@/lib/api-client";
import {
  ArrowLeft,
  CalendarRange,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatSSP(value) {
  const amount = Number(value || 0);
  return `SSP ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getApiError(error, fallback) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    error?.message ||
    fallback
  );
}

function ChartCard({ title, children }) {
  return (
    <Card className="border-slate-200 p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="h-72">{children}</div>
    </Card>
  );
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);

  const [period, setPeriod] = useState("monthly");
  const [startDate, setStartDate] = useState(toISODate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(toISODate(today));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [detailed, setDetailed] = useState(null);
  const [charts, setCharts] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);

  const buildDetailedParams = useCallback(() => {
    if (period === "custom") {
      return { start_date: startDate, end_date: endDate };
    }
    return { period };
  }, [period, startDate, endDate]);

  const fetchAnalytics = useCallback(
    async (isRefresh = false) => {
      if (period === "custom" && (!startDate || !endDate)) {
        setError("Select both start and end date for custom analytics.");
        return;
      }

      setError("");
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const results = await Promise.allSettled([
        apiClient.get("/reports/detailed/", { params: buildDetailedParams() }),
        apiClient.get("/reports/dashboard-charts/"),
        apiClient.get("/reports/dashboard/"),
        apiClient.get("/reports/pharmacy/"),
      ]);

      const [detailedRes, chartsRes, dashboardRes, pharmacyRes] = results;

      if (detailedRes.status === "fulfilled") {
        setDetailed(detailedRes.value.data || null);
      } else {
        setDetailed(null);
      }

      if (chartsRes.status === "fulfilled") {
        setCharts(chartsRes.value.data || null);
      } else {
        setCharts(null);
      }

      if (dashboardRes.status === "fulfilled") {
        setDashboard(dashboardRes.value.data || null);
      } else {
        setDashboard(null);
      }

      if (pharmacyRes.status === "fulfilled") {
        setPharmacy(pharmacyRes.value.data || null);
      } else {
        setPharmacy(null);
      }

      const errors = [];
      if (detailedRes.status === "rejected") {
        errors.push(
          getApiError(detailedRes.reason, "Detailed report is unavailable."),
        );
      }
      if (chartsRes.status === "rejected") {
        errors.push(
          getApiError(chartsRes.reason, "Chart data is unavailable."),
        );
      }
      if (dashboardRes.status === "rejected") {
        errors.push(
          getApiError(dashboardRes.reason, "Dashboard summary is unavailable."),
        );
      }
      if (pharmacyRes.status === "rejected") {
        errors.push(
          getApiError(pharmacyRes.reason, "Pharmacy insights are unavailable."),
        );
      }

      if (errors.length > 0) {
        setError(errors[0]);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [buildDetailedParams, endDate, period, startDate],
  );

  useEffect(() => {
    fetchAnalytics(false);
  }, [fetchAnalytics]);

  const summary = useMemo(() => {
    const patients = detailed?.patients || {};
    const billing = detailed?.billing || {};
    const appointments = detailed?.appointments || {};
    return {
      patientsTotal: Number(patients.total || dashboard?.patients?.total || 0),
      patientsNew: Number(patients.new || dashboard?.patients?.new_today || 0),
      patientsTreated: Number(patients.treated || 0),
      revenue: Number(
        billing.revenue || dashboard?.billing?.total_revenue || 0,
      ),
      pending: Number(billing.pending || 0),
      totalBills: Number(
        billing.total_bills || dashboard?.billing?.total_bills || 0,
      ),
      paidBills: Number(billing.paid_bills || dashboard?.billing?.paid || 0),
      appointmentsTotal: Number(appointments.total || 0),
      appointmentsCompleted: Number(appointments.completed || 0),
      dispensedToday: Number(pharmacy?.dispensed_today || 0),
      pharmacyPending: Number(pharmacy?.pending || 0),
    };
  }, [dashboard, detailed, pharmacy]);

  const collectionRate = useMemo(() => {
    if (!summary.totalBills) return 0;
    return (summary.paidBills / summary.totalBills) * 100;
  }, [summary.paidBills, summary.totalBills]);

  const appointmentCompletionRate = useMemo(() => {
    if (!summary.appointmentsTotal) return 0;
    return (summary.appointmentsCompleted / summary.appointmentsTotal) * 100;
  }, [summary.appointmentsCompleted, summary.appointmentsTotal]);

  const pieColors = ["#0284c7", "#0ea5e9", "#14b8a6", "#f59e0b"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-sky-900 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="mb-3 inline-flex items-center gap-2 text-sm text-sky-200 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Admin Dashboard
              </button>
              <h1 className="text-2xl font-bold">Hospital Analytics</h1>
              <p className="mt-1 text-sm text-slate-200">
                Explore utilization, patient flow, billing performance and
                service trends.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10"
                onClick={() => router.push("/admin/reports")}
              >
                Open Reports
              </Button>
              <Button
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10"
                icon={RefreshCw}
                isLoading={refreshing}
                onClick={() => fetchAnalytics(true)}
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <Card className="border-slate-200 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reporting period
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["daily", "Daily"],
                  ["weekly", "Weekly"],
                  ["monthly", "Monthly"],
                  ["quarterly", "Quarterly"],
                  ["custom", "Custom"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPeriod(value)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      period === value
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Start date
              </label>
              <input
                type="date"
                disabled={period !== "custom"}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                End date
              </label>
              <input
                type="date"
                disabled={period !== "custom"}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                icon={CalendarRange}
                onClick={() => fetchAnalytics(false)}
              >
                Apply
              </Button>
            </div>
          </div>
          {detailed?.start_date && detailed?.end_date ? (
            <p className="mt-3 text-xs text-slate-500">
              Active range: {detailed.start_date} to {detailed.end_date}
            </p>
          ) : null}
        </Card>

        {error ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Revenue
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatSSP(summary.revenue)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Collected in selected period
                </p>
              </Card>

              <Card className="border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pending Balance
                </p>
                <p className="mt-2 text-2xl font-bold text-red-700">
                  {formatSSP(summary.pending)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Outstanding amount
                </p>
              </Card>

              <Card className="border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  New Patients
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {summary.patientsNew}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Registered in selected period
                </p>
              </Card>

              <Card className="border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Treated Patients
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {summary.patientsTreated}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Clinical progression count
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-700">
                  <DollarSign className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Collection Rate</h3>
                </div>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {collectionRate.toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {summary.paidBills} paid bills out of {summary.totalBills}{" "}
                  total
                </p>
              </Card>

              <Card className="border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-700">
                  <Users className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">
                    Appointment Completion
                  </h3>
                </div>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {appointmentCompletionRate.toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {summary.appointmentsCompleted} completed out of{" "}
                  {summary.appointmentsTotal}
                </p>
              </Card>

              <Card className="border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-700">
                  <TrendingUp className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Pharmacy Throughput</h3>
                </div>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {summary.dispensedToday}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Dispensed today, {summary.pharmacyPending} still pending
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartCard title="Monthly Trend: Patients and Revenue">
                {charts?.monthly?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="patients"
                        name="Patients"
                        fill="#0ea5e9"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#0f172a"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Monthly trend data is unavailable.
                  </div>
                )}
              </ChartCard>

              <ChartCard title="Weekly Service Load">
                {charts?.weekly?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.weekly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="consultations"
                        name="Consultations"
                        fill="#0284c7"
                      />
                      <Bar dataKey="lab" name="Lab" fill="#14b8a6" />
                      <Bar dataKey="pharmacy" name="Pharmacy" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Weekly load data is unavailable.
                  </div>
                )}
              </ChartCard>
            </div>

            <ChartCard title="Revenue Distribution by Service">
              {charts?.revenue_distribution?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.revenue_distribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={90}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {charts.revenue_distribution.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={pieColors[index % pieColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatSSP(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Revenue distribution data is unavailable.
                </div>
              )}
            </ChartCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
