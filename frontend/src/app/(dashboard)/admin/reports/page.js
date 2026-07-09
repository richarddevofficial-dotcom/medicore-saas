"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useHospitalSettings } from "@/hooks/useSettings";
import { Printer, Users, DollarSign, Calendar, Activity } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function ReportsPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("daily");
  const [generating, setGenerating] = useState(false);
  const { data: hospitalSettings } = useHospitalSettings();
  const hospitalName = hospitalSettings?.name || "Medical Centre";

  const fetchReport = async (p) => {
    setGenerating(true);
    try {
      const { data } = await apiClient.get(`/reports/detailed/?period=${p}`);
      setData(data);
    } catch (err) {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchReport(period);
  }, [period]);

  const printReport = () => {
    const printWindow = window.open("", "_blank", "width=800,height=700");
    printWindow.document.write(`
      <html><head><title>${period.toUpperCase()} Report - ${hospitalName}</title>
      <style>
        body{font-family:Arial;padding:30px;color:#333}
        .header{text-align:center;border-bottom:3px solid #1E3A5F;padding-bottom:15px;margin-bottom:20px}
        .header h1{color:#1E3A5F;margin:0}.header p{color:#666}
        .section{margin:20px 0;page-break-inside:avoid}
        .section h2{color:#F97316;border-bottom:1px solid #ddd;padding-bottom:5px}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th{background:#1E3A5F;color:#fff;padding:10px;text-align:left}
        td{padding:10px;border-bottom:1px solid #ddd}
        .highlight{font-size:1.2em;font-weight:bold;color:#F97316}
        .footer{text-align:center;margin-top:30px;color:#888;font-size:0.8em;border-top:1px solid #ddd;padding-top:15px}
        @media print{body{padding:10px}}
      </style></head><body>
      <div class="header"><h1>${hospitalName}</h1><h2>${period.toUpperCase()} REPORT</h2><p>Period: ${data?.start_date || ""} to ${data?.end_date || ""} | Generated: ${new Date().toLocaleString()}</p></div>
      
      <div class="section"><h2>Patient Statistics</h2>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Patients</td><td class="highlight">${data?.patients?.total || 0}</td></tr>
        <tr><td>New Patients</td><td>${data?.patients?.new || 0}</td></tr>
        <tr><td>Treated</td><td>${data?.patients?.treated || 0}</td></tr>
        <tr><td>Male</td><td>${data?.patients?.male || 0}</td></tr>
        <tr><td>Female</td><td>${data?.patients?.female || 0}</td></tr></table>
      </div>
      
      <div class="section"><h2>Revenue</h2>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Bills</td><td>${data?.billing?.total_bills || 0}</td></tr>
        <tr><td>Paid Bills</td><td>${data?.billing?.paid_bills || 0}</td></tr>
        <tr><td>Revenue</td><td class="highlight">SSP ${(data?.billing?.revenue || 0).toLocaleString()}</td></tr>
        <tr><td>Pending</td><td>SSP ${(data?.billing?.pending || 0).toLocaleString()}</td></tr></table>
      </div>
      
      <div class="section"><h2>Appointments</h2>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total</td><td>${data?.appointments?.total || 0}</td></tr>
        <tr><td>Completed</td><td>${data?.appointments?.completed || 0}</td></tr></table>
      </div>
      
      <div class="footer"><p>${hospitalName} - MediCore HMS</p><p>Printed: ${new Date().toLocaleString()}</p></div>
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

        {generating || !data ? (
          <Card>
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
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
