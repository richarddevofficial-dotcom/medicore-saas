"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useHospitalSettings } from "@/hooks/useSettings";
import { Printer, Users, DollarSign, Calendar, Activity } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartColors = ["#2563eb", "#ec4899", "#16a34a", "#f97316"];

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatNumber = (value) => Number(value || 0).toLocaleString();

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("daily");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const { data: hospitalSettings } = useHospitalSettings();
  const hospitalName = hospitalSettings?.name || "Medical Centre";

  const fetchReport = async (p) => {
    setGenerating(true);
    setError("");
    try {
      const { data } = await apiClient.get(`/reports/detailed/?period=${p}`);
      setData(data);
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Unable to load this report. Please try again.";
      setData(null);
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchReport(period);
  }, [period]);

  const printReport = () => {
    const generatedAt = new Date().toLocaleString();
    const reportPeriod = `${data?.start_date || "Not available"} to ${
      data?.end_date || "Not available"
    }`;
    const printWindow = window.open("", "_blank", "width=800,height=700");
    printWindow.document.write(`
      <html><head><title>${period.toUpperCase()} Report - ${hospitalName}</title>
      <style>
        @page{margin:16mm 14mm 18mm;size:A4}
        body{font-family:Arial,sans-serif;color:#172033;font-size:11px;line-height:1.45}
        .header{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #173b63;padding-bottom:14px;margin-bottom:18px}
        .header h1{color:#173b63;font-size:21px;margin:0}.header h2{font-size:14px;letter-spacing:.4px;margin:4px 0 0}.header p{color:#526075;margin:3px 0}
        .report-meta{text-align:right;color:#526075}.report-meta strong{color:#172033}
        .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 20px}.summary-item{border:1px solid #d9e1ea;border-top:3px solid #e87518;padding:9px}.summary-label{color:#526075;font-size:10px;text-transform:uppercase}.summary-value{color:#172033;font-size:17px;font-weight:bold;margin-top:3px}
        .section{margin:18px 0;break-inside:avoid}.section h2{color:#173b63;font-size:14px;border-bottom:1px solid #cbd5e1;padding-bottom:5px;margin-bottom:7px}
        table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#173b63;color:#fff;padding:8px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:8px;border-bottom:1px solid #d9e1ea}.highlight{font-weight:bold;color:#b45309}
        .notice{border-left:3px solid #e87518;background:#fff7ed;color:#7c2d12;padding:8px 10px;margin-top:20px;font-size:10px}
        .footer{position:fixed;bottom:-11mm;left:0;right:0;border-top:1px solid #cbd5e1;color:#526075;padding-top:5px;font-size:9px}.footer .right{float:right}.page:after{content:counter(page)}
        @media print{.section{break-inside:avoid}}
      </style></head><body>
      <div class="header"><div><h1>${escapeHtml(hospitalName)}</h1><h2>${escapeHtml(period.toUpperCase())} OPERATIONAL REPORT</h2><p>Hospital performance and service activity summary</p></div><div class="report-meta"><p><strong>Reporting period</strong><br>${escapeHtml(reportPeriod)}</p><p><strong>Generated</strong><br>${escapeHtml(generatedAt)}</p></div></div>
      <div class="summary"><div class="summary-item"><div class="summary-label">Total patients</div><div class="summary-value">${formatNumber(data?.patients?.total)}</div></div><div class="summary-item"><div class="summary-label">Revenue collected</div><div class="summary-value">SSP ${formatNumber(data?.billing?.revenue)}</div></div><div class="summary-item"><div class="summary-label">Appointments</div><div class="summary-value">${formatNumber(data?.appointments?.total)}</div></div></div>
      
      <div class="section"><h2>Patient Statistics</h2>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Patients</td><td class="highlight">${formatNumber(data?.patients?.total)}</td></tr>
        <tr><td>New Patients</td><td>${formatNumber(data?.patients?.new)}</td></tr>
        <tr><td>Treated</td><td>${formatNumber(data?.patients?.treated)}</td></tr>
        <tr><td>Male</td><td>${formatNumber(data?.patients?.male)}</td></tr>
        <tr><td>Female</td><td>${formatNumber(data?.patients?.female)}</td></tr></table>
      </div>
      
      <div class="section"><h2>Revenue</h2>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Bills</td><td>${formatNumber(data?.billing?.total_bills)}</td></tr>
        <tr><td>Paid Bills</td><td>${formatNumber(data?.billing?.paid_bills)}</td></tr>
        <tr><td>Revenue</td><td class="highlight">SSP ${formatNumber(data?.billing?.revenue)}</td></tr>
        <tr><td>Pending</td><td>SSP ${formatNumber(data?.billing?.pending)}</td></tr></table>
      </div>
      
      <div class="section"><h2>Appointments</h2>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total</td><td>${formatNumber(data?.appointments?.total)}</td></tr>
        <tr><td>Completed</td><td>${formatNumber(data?.appointments?.completed)}</td></tr></table>
      </div>

      <div class="section"><h2>Clinical Services</h2>
        <table><tr><th>Service</th><th>Completed</th><th>Pending</th><th>Period Revenue</th></tr>
        <tr><td>Laboratory</td><td>${formatNumber(data?.laboratory?.completed)}</td><td>${formatNumber(data?.laboratory?.pending)}</td><td>SSP ${formatNumber(data?.laboratory?.revenue)}</td></tr>
        <tr><td>Imaging</td><td>${formatNumber(data?.imaging?.completed)}</td><td>${formatNumber(data?.imaging?.pending)}</td><td>SSP ${formatNumber(data?.imaging?.revenue)}</td></tr></table>
      </div>

      <div class="section"><h2>Inpatient Services</h2>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Active Admissions</td><td class="highlight">${formatNumber(data?.ipd?.active_admissions)}</td></tr>
        <tr><td>Admissions During Period</td><td>${formatNumber(data?.ipd?.admissions)}</td></tr>
        <tr><td>Discharges During Period</td><td>${formatNumber(data?.ipd?.discharges)}</td></tr></table>
      </div>

      <div class="section"><h2>Pharmacy and Expense Control</h2>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Active Medicines</td><td>${formatNumber(data?.pharmacy?.medicines)}</td></tr>
        <tr><td>Low-Stock Medicines</td><td class="highlight">${formatNumber(data?.pharmacy?.low_stock)}</td></tr>
        <tr><td>Inventory Cost Value</td><td>SSP ${formatNumber(data?.pharmacy?.stock_value)}</td></tr>
        <tr><td>Approved or Paid Expenses</td><td>SSP ${formatNumber(data?.expenses?.approved_or_paid)}</td></tr>
        <tr><td>Expenses Awaiting Approval</td><td>${formatNumber(data?.expenses?.pending_approval)}</td></tr></table>
      </div>
      
      <div class="notice">Confidential hospital information. Print, distribute, and retain this report only in accordance with your hospital's records and privacy policy.</div>
      <div class="footer"><span>${escapeHtml(hospitalName)} | MediCore HMS</span><span class="right">Page <span class="page"></span></span></div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const periods = [
    { id: "daily", label: "📅 Daily" },
    { id: "weekly", label: "📆 Weekly" },
    { id: "monthly", label: "🗓️ Monthly" },
    { id: "quarterly", label: "📊 Quarterly" },
  ];
  const periodLabelMap = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    custom: "Custom",
  };
  const activePeriodLabel = periodLabelMap[data?.period || period] || "Daily";
  const genderData = [
    { name: "Male", value: data?.patients?.male || 0 },
    { name: "Female", value: data?.patients?.female || 0 },
  ];
  const billingData = [
    { name: "Collected", amount: data?.billing?.revenue || 0 },
    { name: "Outstanding", amount: data?.billing?.pending || 0 },
  ];
  const appointmentData = [
    { name: "Completed", value: data?.appointments?.completed || 0 },
    {
      name: "Remaining",
      value: Math.max(
        (data?.appointments?.total || 0) - (data?.appointments?.completed || 0),
        0,
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">📊 Reports & Analytics</h1>
            <p className="text-sm text-gray-500">
              {hospitalName} - View and print reports
            </p>
            {data?.start_date && data?.end_date && (
              <p className="text-xs text-gray-500 mt-1">
                {activePeriodLabel} range: {data.start_date} to {data.end_date}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              icon={Printer}
              onClick={printReport}
              disabled={!data}
            >
              Print
            </Button>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${period === p.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {generating ? (
          <Card>
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          </Card>
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="max-w-md text-sm text-gray-600">{error}</p>
              <Button onClick={() => fetchReport(period)}>Try again</Button>
            </div>
          </Card>
        ) : !data ? (
          <Card>
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-sm text-gray-600">
                No report data is available.
              </p>
              <Button onClick={() => fetchReport(period)}>Load report</Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="text-center">
                <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold">{data?.patients?.new || 0}</p>
                <p className="text-xs text-gray-500">New Patients</p>
              </Card>
              <Card className="text-center">
                <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold">
                  SSP {(data?.billing?.revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Revenue</p>
              </Card>
              <Card className="text-center">
                <Activity className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                <p className="text-2xl font-bold">
                  {data?.patients?.treated || 0}
                </p>
                <p className="text-xs text-gray-500">Treated</p>
              </Card>
              <Card className="text-center">
                <Calendar className="h-6 w-6 text-orange-600 mx-auto mb-1" />
                <p className="text-2xl font-bold">
                  {data?.appointments?.total || 0}
                </p>
                <p className="text-xs text-gray-500">Appointments</p>
              </Card>
              <Card className="text-center">
                <DollarSign className="h-6 w-6 text-red-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-600">
                  SSP {(data?.billing?.pending || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Pending Balance</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="mb-4">
                  <h3 className="font-semibold">Patient Mix</h3>
                  <p className="text-xs text-gray-500">
                    New patient registrations in this period
                  </p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {genderData.map((entry, index) => (
                          <Cell key={entry.name} fill={chartColors[index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <div className="mb-4">
                  <h3 className="font-semibold">Collection Position</h3>
                  <p className="text-xs text-gray-500">
                    Payments received and balances from period bills
                  </p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={billingData} margin={{ top: 8, right: 8 }}>
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={56} />
                      <Tooltip
                        formatter={(value) =>
                          `SSP ${Number(value).toLocaleString()}`
                        }
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {billingData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={chartColors[index + 2]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <div className="mb-4">
                  <h3 className="font-semibold">Appointment Completion</h3>
                  <p className="text-xs text-gray-500">
                    Completed versus remaining appointments in this period
                  </p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={appointmentData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {appointmentData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={chartColors[index + 2]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" /> Patient Statistics
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-500">
                      Total Patients
                    </span>
                    <span className="font-bold">
                      {data?.patients?.total || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-500">
                      New ({activePeriodLabel.toLowerCase()})
                    </span>
                    <span className="font-bold text-blue-600">
                      +{data?.patients?.new || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-500">Treated</span>
                    <span className="font-bold text-green-600">
                      {data?.patients?.treated || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-500">Male</span>
                    <span className="font-medium">
                      {data?.patients?.male || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-500">Female</span>
                    <span className="font-medium">
                      {data?.patients?.female || 0}
                    </span>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" /> Revenue
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-500">Total Bills</span>
                    <span className="font-bold">
                      {data?.billing?.total_bills || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-500">Paid Bills</span>
                    <span className="font-bold text-green-600">
                      {data?.billing?.paid_bills || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-500">Total Revenue</span>
                    <span className="font-bold text-green-600 text-lg">
                      SSP {(data?.billing?.revenue || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-500">Pending</span>
                    <span className="font-bold text-red-600">
                      SSP {(data?.billing?.pending || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-600" /> Appointments
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-500">
                      Total Appointments
                    </span>
                    <span className="font-bold">
                      {data?.appointments?.total || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-500">Completed</span>
                    <span className="font-bold text-green-600">
                      {data?.appointments?.completed || 0}
                    </span>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" /> Gender
                  Distribution
                </h3>
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="h-20 w-20 rounded-full bg-blue-500 flex items-center justify-center mb-2">
                      <span className="text-xl font-bold text-white">
                        {Math.round(
                          ((data?.patients?.male || 0) /
                            (data?.patients?.total || 1)) *
                            100,
                        )}
                        %
                      </span>
                    </div>
                    <p className="text-sm font-medium">Male</p>
                    <p className="text-xs text-gray-500">
                      {data?.patients?.male || 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="h-20 w-20 rounded-full bg-pink-500 flex items-center justify-center mb-2">
                      <span className="text-xl font-bold text-white">
                        {Math.round(
                          ((data?.patients?.female || 0) /
                            (data?.patients?.total || 1)) *
                            100,
                        )}
                        %
                      </span>
                    </div>
                    <p className="text-sm font-medium">Female</p>
                    <p className="text-xs text-gray-500">
                      {data?.patients?.female || 0}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
