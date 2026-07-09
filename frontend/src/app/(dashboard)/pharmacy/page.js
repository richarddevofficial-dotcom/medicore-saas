"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import apiClient from "@/lib/api-client";
import { exportToExcel } from "@/lib/excelUtils";
import toast from "react-hot-toast";
import {
  Pill,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Receipt,
  ShoppingCart,
  FileBarChart2,
  CalendarDays,
  ArrowRight,
  Activity,
  BarChart3,
  TrendingUp,
  Download,
} from "lucide-react";
import {
  AreaChart,
  Area,
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

export default function PharmacyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dispensingId, setDispensingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [range, setRange] = useState("7d");
  const tabParam = (searchParams.get("tab") || "all").toLowerCase();
  const selectedTab = tabParam === "ready" ? "ready" : "all";

  const getRangeLabel = () =>
    range === "today" ? "Today" : range === "30d" ? "30 Days" : "7 Days";

  const handleExportAnalytics = () => {
    if (!stats) return;

    const rows = [
      {
        Section: "Meta",
        Metric: "Range",
        Value: getRangeLabel(),
      },
      {
        Section: "Meta",
        Metric: "Tab",
        Value: selectedTab,
      },
      {
        Section: "KPI",
        Metric: "Total Prescriptions",
        Value: stats?.kpis?.totalPrescriptions || 0,
      },
      {
        Section: "KPI",
        Metric: "Ready To Dispense",
        Value: stats?.kpis?.readyCount || 0,
      },
      {
        Section: "KPI",
        Metric: "Low Stock Items",
        Value: stats?.kpis?.lowStockCount || 0,
      },
      {
        Section: "KPI",
        Metric: "Estimated Revenue (SSP)",
        Value: stats?.kpis?.estimatedRevenue || 0,
      },
      {
        Section: "KPI",
        Metric: "Out Of Stock",
        Value: stats?.kpis?.outOfStockCount || 0,
      },
      {
        Section: "KPI",
        Metric: "Expiring Soon (30 days)",
        Value: stats?.kpis?.expiringSoonCount || 0,
      },
      ...topMedicines.map((m) => ({
        Section: "Top Medicines",
        Metric: m.name,
        Value: m.quantity,
      })),
      ...topRevenueMedicines.map((m) => ({
        Section: "Top Revenue Medicines",
        Metric: m.name,
        Value: m.revenue,
      })),
      ...activityData.map((d) => ({
        Section: "Activity",
        Metric: d.day,
        Prescriptions: d.prescriptions,
        Dispensed: d.dispensed,
      })),
    ];

    exportToExcel(rows, `pharmacy_analytics_${range}.xlsx`);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [presRes, medRes, billRes, posRes] = await Promise.all([
          apiClient.get("/prescriptions/queue/"),
          apiClient.get("/medicines/"),
          apiClient.get("/bills/stats/"),
          apiClient.get("/pos-receipts/"),
        ]);

        const prescriptions = Array.isArray(presRes.data)
          ? presRes.data.filter(Boolean)
          : [];
        const medicines = Array.isArray(medRes.data?.results)
          ? medRes.data.results
          : Array.isArray(medRes.data)
            ? medRes.data
            : [];
        const posReceipts = Array.isArray(posRes.data?.results)
          ? posRes.data.results
          : Array.isArray(posRes.data)
            ? posRes.data
            : [];

        const now = new Date();
        const dayCount = range === "today" ? 1 : range === "30d" ? 30 : 7;
        const rangeStart = new Date(now);
        rangeStart.setDate(now.getDate() - (dayCount - 1));
        rangeStart.setHours(0, 0, 0, 0);

        const getPrescriptionDate = (item) => {
          const raw =
            item?.created_at ||
            item?.prescribed_at ||
            item?.updated_at ||
            item?.dispensed_at ||
            null;
          if (!raw) return null;
          const parsed = new Date(raw);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const filteredPrescriptions = prescriptions.filter((item) => {
          const date = getPrescriptionDate(item);
          if (!date) return false;
          return date >= rangeStart;
        });

        const readyQueue = prescriptions.filter((item) => {
          const status = String(item?.status || "").toLowerCase();
          return status === "ready" || status === "partial";
        });

        const tabFilteredPrescriptions = filteredPrescriptions.filter(
          (item) => {
            if (selectedTab !== "ready") return true;
            const status = String(item?.status || "").toLowerCase();
            return status === "ready" || status === "partial";
          },
        );

        const statusCounts = tabFilteredPrescriptions.reduce((acc, item) => {
          const status = String(item?.status || "pending").toLowerCase();
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        const pendingCount = statusCounts.pending || 0;
        const readyCount = statusCounts.ready || 0;
        const partialCount = statusCounts.partial || 0;
        const dispensedCount = statusCounts.dispensed || 0;
        const pendingPaymentCount = Math.max(
          Number(billRes?.data?.total_bills || 0) -
            Number(billRes?.data?.paid || 0),
          0,
        );

        const lowStockCount = medicines.filter(
          (m) => Number(m?.quantity || 0) <= Number(m?.reorder_level || 10),
        ).length;
        const outOfStockCount = medicines.filter(
          (m) => Number(m?.quantity || 0) <= 0,
        ).length;

        const expiringSoonCutoff = new Date(now);
        expiringSoonCutoff.setDate(now.getDate() + 30);
        const expiringSoonCount = medicines.filter((m) => {
          if (!m?.expiry_date) return false;
          const expiry = new Date(m.expiry_date);
          if (Number.isNaN(expiry.getTime())) return false;
          return expiry >= now && expiry <= expiringSoonCutoff;
        }).length;

        const estimatedRevenue = tabFilteredPrescriptions.reduce(
          (sum, item) => {
            const amount = Number.parseFloat(item?.medicine_amount || 0);
            return sum + (Number.isFinite(amount) ? amount : 0);
          },
          0,
        );

        const filteredPosReceipts = posReceipts.filter((item) => {
          if (!item?.created_at) return false;
          const date = new Date(item.created_at);
          if (Number.isNaN(date.getTime())) return false;
          return date >= rangeStart;
        });

        const posRevenue = filteredPosReceipts.reduce((sum, item) => {
          const amount = Number.parseFloat(item?.total_amount || 0);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

        const topMedicinesMap = tabFilteredPrescriptions.reduce((acc, item) => {
          const key = item?.medicine_name || "Unknown";
          acc[key] = (acc[key] || 0) + Number(item?.quantity_prescribed || 1);
          return acc;
        }, {});

        const topMedicines = Object.entries(topMedicinesMap)
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 6);

        const topRevenueMap = tabFilteredPrescriptions.reduce((acc, item) => {
          const key = item?.medicine_name || "Unknown";
          const amount = Number.parseFloat(item?.medicine_amount || 0);
          acc[key] = (acc[key] || 0) + (Number.isFinite(amount) ? amount : 0);
          return acc;
        }, {});

        filteredPosReceipts.forEach((item) => {
          const key = item?.medicine_name || "Unknown";
          const amount = Number.parseFloat(item?.total_amount || 0);
          if (Number.isFinite(amount)) {
            topRevenueMap[key] = (topRevenueMap[key] || 0) + amount;
          }
        });

        const topRevenueMedicines = Object.entries(topRevenueMap)
          .map(([name, revenue]) => ({ name, revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 6);

        const getDateKey = (item) => {
          const date = getPrescriptionDate(item);
          if (!date) return null;
          return date.toISOString().slice(0, 10);
        };

        const today = new Date();
        const dayBuckets = Array.from({ length: dayCount }, (_, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() - (dayCount - 1 - i));
          const key = d.toISOString().slice(0, 10);
          const label =
            dayCount <= 7
              ? d.toLocaleDateString("en-US", { weekday: "short" })
              : d.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
          return { key, day: label, prescriptions: 0, dispensed: 0 };
        });

        const bucketIndex = dayBuckets.reduce((acc, row, idx) => {
          acc[row.key] = idx;
          return acc;
        }, {});

        tabFilteredPrescriptions.forEach((item) => {
          const key = getDateKey(item);
          if (!key || bucketIndex[key] === undefined) return;
          const idx = bucketIndex[key];
          dayBuckets[idx].prescriptions += 1;
          if (String(item?.status).toLowerCase() === "dispensed") {
            dayBuckets[idx].dispensed += 1;
          }
        });

        const statusDistribution = [
          { name: "Pending", value: pendingCount },
          { name: "Ready", value: readyCount },
          { name: "Partial", value: partialCount },
          { name: "Dispensed", value: dispensedCount },
        ].filter((x) => x.value > 0);

        const inventoryHealth = [
          {
            name: "Low Stock",
            value: lowStockCount,
          },
          {
            name: "Healthy",
            value: Math.max(medicines.length - lowStockCount, 0),
          },
        ];

        setStats({
          prescriptions,
          medicines,
          billing: billRes.data || {},
          queue: readyQueue,
          kpis: {
            totalPrescriptions: tabFilteredPrescriptions.length,
            pendingCount,
            pendingPaymentCount,
            readyCount,
            dispensedCount,
            lowStockCount,
            outOfStockCount,
            expiringSoonCount,
            totalItems: medicines.length,
            estimatedRevenue: estimatedRevenue + posRevenue,
          },
          charts: {
            topMedicines,
            topRevenueMedicines,
            activity: dayBuckets,
            statusDistribution,
            inventoryHealth,
          },
        });
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [range, selectedTab, refreshKey]);

  const handleDispense = async (item) => {
    const remaining = Math.max(
      Number(item?.quantity_prescribed || 0) -
        Number(item?.quantity_dispensed || 0),
      0,
    );

    if (remaining <= 0) {
      toast.error("Nothing left to dispense for this prescription");
      return;
    }

    setDispensingId(item.id);
    try {
      await apiClient.post(`/prescriptions/${item.id}/dispense/`, {
        quantity: remaining,
      });
      toast.success("Prescription dispensed");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to dispense");
    } finally {
      setDispensingId(null);
    }
  };

  const activityData = stats?.charts?.activity || [];
  const topMedicines = stats?.charts?.topMedicines || [];
  const topRevenueMedicines = stats?.charts?.topRevenueMedicines || [];
  const statusDistribution = stats?.charts?.statusDistribution || [];
  const inventoryHealth = stats?.charts?.inventoryHealth || [];

  const quickActions = [
    {
      name: "Dispense Queue",
      icon: CheckCircle2,
      href: "/pharmacy",
      color: "bg-blue-50 text-blue-600",
    },
    {
      name: "Medicines",
      icon: Pill,
      href: "/admin/medicines",
      color: "bg-green-50 text-green-600",
    },
    {
      name: "Inventory",
      icon: Package,
      href: "/admin/inventory",
      color: "bg-purple-50 text-purple-600",
    },
    {
      name: "Billing Desk",
      icon: Receipt,
      href: "/billing",
      color: "bg-orange-50 text-orange-600",
    },
  ];

  const kpiLinks = {
    totalPrescriptions: "/pharmacy?tab=all",
    readyCount: "/pharmacy?tab=ready",
    lowStockCount: "/admin/inventory?filter=low",
    estimatedRevenue: "/billing",
    outOfStockCount: "/admin/inventory?filter=critical",
    expiringSoonCount: "/admin/medicines?filter=expiring_soon",
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Pharmacy Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Operational overview for prescriptions, dispensing, and stock.
            </p>
            {selectedTab === "ready" && (
              <p className="text-xs text-emerald-600 mt-1">
                Filter active: Ready to dispense
              </p>
            )}
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1">
            <CalendarDays className="h-4 w-4 text-gray-500 ml-2" />
            {[
              { value: "today", label: "Today" },
              { value: "7d", label: "7 Days" },
              { value: "30d", label: "30 Days" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  range === option.value
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            icon={Download}
            onClick={handleExportAnalytics}
          >
            Export Analytics
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <Card
            className="relative overflow-hidden"
            hover
            onClick={() => router.push(kpiLinks.totalPrescriptions)}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.kpis?.totalPrescriptions || 0}
                </p>
                <p className="text-xs text-gray-500">Total Prescriptions</p>
                <p className="text-xs text-green-600">
                  {stats?.kpis?.dispensedCount || 0} dispensed
                </p>
              </div>
            </div>
          </Card>

          <Card
            className="relative overflow-hidden"
            hover
            onClick={() => router.push(kpiLinks.readyCount)}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Clock3 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.kpis?.readyCount || 0}
                </p>
                <p className="text-xs text-gray-500">Ready To Dispense</p>
                <p className="text-xs text-green-600">
                  {stats?.kpis?.pendingPaymentCount || 0} pending payment
                </p>
              </div>
            </div>
          </Card>

          <Card
            className="relative overflow-hidden"
            hover
            onClick={() => router.push(kpiLinks.lowStockCount)}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.kpis?.lowStockCount || 0}
                </p>
                <p className="text-xs text-gray-500">Low Stock Items</p>
                <p className="text-xs text-orange-600">
                  {stats?.kpis?.totalItems || 0} total in inventory
                </p>
              </div>
            </div>
          </Card>

          <Card
            className="relative overflow-hidden"
            hover
            onClick={() => router.push(kpiLinks.estimatedRevenue)}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-orange-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  SSP {(stats?.kpis?.estimatedRevenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Estimated Revenue</p>
                <p className="text-xs text-green-600">
                  {stats?.billing?.paid || 0} paid bills
                </p>
              </div>
            </div>
          </Card>

          <Card
            className="relative overflow-hidden"
            hover
            onClick={() => router.push(kpiLinks.outOfStockCount)}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.kpis?.outOfStockCount || 0}
                </p>
                <p className="text-xs text-gray-500">Out Of Stock</p>
                <p className="text-xs text-red-600">Needs urgent restock</p>
              </div>
            </div>
          </Card>

          <Card
            className="relative overflow-hidden"
            hover
            onClick={() => router.push(kpiLinks.expiringSoonCount)}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-100 rounded-bl-full opacity-20" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock3 className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.kpis?.expiringSoonCount || 0}
                </p>
                <p className="text-xs text-gray-500">Expiring Soon</p>
                <p className="text-xs text-amber-600">Within 30 days</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Ready to Dispense Queue</h3>
            <p className="text-xs text-gray-500">
              {(stats?.queue || []).length} ready item(s)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3">Patient</th>
                  <th className="py-2 pr-3">Medicine</th>
                  <th className="py-2 pr-3">Qty Left</th>
                  <th className="py-2 pr-3">Doctor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.queue || []).slice(0, 12).map((item) => {
                  const remaining = Math.max(
                    Number(item?.quantity_prescribed || 0) -
                      Number(item?.quantity_dispensed || 0),
                    0,
                  );
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 text-gray-700"
                    >
                      <td className="py-2 pr-3">
                        {item.patient_name || "N/A"}
                      </td>
                      <td className="py-2 pr-3">{item.medicine_name || "-"}</td>
                      <td className="py-2 pr-3">{remaining}</td>
                      <td className="py-2 pr-3">{item.doctor_name || "N/A"}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 capitalize">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleDispense(item)}
                          isLoading={dispensingId === item.id}
                        >
                          Dispense
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!(stats?.queue || []).length && (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={6}>
                      No paid prescriptions ready to dispense yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" /> Top Medicines
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topMedicines}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="quantity"
                  stroke="#F97316"
                  fill="#F97316"
                  name="Qty Prescribed"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" /> Top Revenue
              Medicines
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topRevenueMedicines}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value) => `SSP ${Number(value).toLocaleString()}`}
                />
                <Legend />
                <Bar
                  dataKey="revenue"
                  stroke="#10B981"
                  fill="#10B981"
                  name="Revenue (SSP)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              {getRangeLabel()} Activity
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="prescriptions"
                  fill="#F97316"
                  stroke="#F97316"
                  name="Prescriptions"
                />
                <Area
                  type="monotone"
                  dataKey="dispensed"
                  fill="#10B981"
                  stroke="#10B981"
                  name="Dispensed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-orange-600" />
              Prescription Status
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusDistribution.map((entry, index) => (
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
              <ShoppingCart className="h-5 w-5 text-purple-600" />
              Inventory Summary
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={inventoryHealth}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {inventoryHealth.map((entry, index) => (
                    <Cell
                      key={`inv-cell-${index}`}
                      fill={index === 0 ? "#EF4444" : "#10B981"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
