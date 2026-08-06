"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useHospitalSettings } from "@/hooks/useSettings";
import {
  Activity,
  CalendarDays,
  Clock3,
  FileText,
  Printer,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

const REPORT_GROUPS = [
  {
    title: "Shift & Attendance",
    icon: CalendarDays,
    keys: [
      "report_date",
      "shift",
      "attendance_status",
      "clock_in",
      "clock_out",
    ],
  },
  {
    title: "Hours",
    icon: Clock3,
    keys: ["scheduled_hours", "hours_worked"],
  },
];

const EXCLUDED_KEYS = new Set(["generated_at", "staff_name", "role"]);

const formatLabel = (key) => key.replace(/_/g, " ");

const formatValue = (key, value) => {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }

  if (key === "clock_in" || key === "clock_out") {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (key === "report_date") {
    return new Date(`${value}T00:00:00`).toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (typeof value === "number") {
    const formatted = value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    return key.includes("hours") ? `${formatted} hrs` : formatted;
  }

  return String(value).replace(/_/g, " ");
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getReportSections = (report) => {
  const assignedKeys = new Set(REPORT_GROUPS.flatMap((group) => group.keys));
  const sections = REPORT_GROUPS.map((group) => ({
    ...group,
    metrics: group.keys
      .filter((key) => key in report)
      .map((key) => ({ key, value: report[key] })),
  })).filter((group) => group.metrics.length > 0);

  const activityMetrics = Object.entries(report)
    .filter(([key]) => !EXCLUDED_KEYS.has(key) && !assignedKeys.has(key))
    .map(([key, value]) => ({ key, value }));

  if (activityMetrics.length > 0) {
    sections.push({
      title: "Activity",
      icon: Activity,
      metrics: activityMetrics,
    });
  }

  return sections;
};

export default function ReportGenerator({ endpoint, title }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { data: hospital } = useHospitalSettings();
  const hospitalName = hospital?.name || "Alliance Medical Centre";

  const generateReport = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(endpoint);
      setData(data);
      toast.success("Report generated!");
    } catch (err) {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    const sections = getReportSections(data || {});
    const printWindow = window.open("", "_blank", "width=500,height=700");
    printWindow.document.write(`
      <html><head><title>${title} - ${hospitalName}</title>
      <style>
        body{font-family:Arial;padding:30px;color:#333}
        .header{text-align:center;border-bottom:3px solid #1E3A5F;padding-bottom:15px;margin-bottom:20px}
        .header h1{color:#1E3A5F;margin:0}.header p{color:#666}
        table{width:100%;border-collapse:collapse;margin:20px 0}
        th{background:#1E3A5F;color:#fff;padding:10px;text-align:left}
        td{padding:10px;border-bottom:1px solid #ddd}
        h3{margin:24px 0 0;color:#1E3A5F}
        .footer{text-align:center;margin-top:30px;color:#888;font-size:0.8em}
      </style></head><body>
      <div class="header"><h1>${escapeHtml(hospitalName)}</h1><h2>${escapeHtml(title)}</h2><p>${escapeHtml(data?.staff_name || "")} | ${escapeHtml(data?.role || "")}</p><p>Generated: ${new Date().toLocaleString()}</p></div>
      ${sections
        .map(
          (section) =>
            `<h3>${escapeHtml(section.title)}</h3><table>${section.metrics
              .map(
                ({ key, value }) => `
        <tr><td><strong>${escapeHtml(formatLabel(key).toUpperCase())}</strong></td><td>${escapeHtml(formatValue(key, value))}</td></tr>
      `,
              )
              .join("")}</table>`,
        )
        .join("")}
      <div class="footer"><p>${hospitalName} - MediCore HMS</p></div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const sections = data ? getReportSections(data) : [];

  return (
    <div>
      <Button onClick={generateReport} isLoading={loading} icon={FileText}>
        {loading ? "Generating..." : "Generate Report"}
      </Button>

      {data && (
        <section className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-sm text-gray-500">
                {data.staff_name} | {formatValue("role", data.role)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={Printer}
              onClick={printReport}
            >
              Print
            </Button>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Generated: {new Date(data.generated_at).toLocaleString()}
          </p>
          <div className="space-y-5">
            {sections.map(({ title: sectionTitle, icon: Icon, metrics }) => (
              <div key={sectionTitle}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Icon className="h-4 w-4 text-primary-600" />
                  {sectionTitle}
                </div>
                <dl className="grid gap-x-6 divide-y border-y border-gray-100 sm:grid-cols-2 sm:divide-y-0">
                  {metrics.map(({ key, value }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 py-2.5 sm:border-b sm:border-gray-100"
                    >
                      <dt className="text-sm text-gray-600 capitalize">
                        {formatLabel(key)}
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {formatValue(key, value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
