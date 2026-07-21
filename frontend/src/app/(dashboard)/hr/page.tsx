"use client";

import { useEffect, useState } from "react";
import HRDashboardCards from "@/components/hr/hr-dashboard-cards";
import { getHRDashboard } from "@/lib/api/hr";
import type { HRDashboard } from "@/types/hr";

export default function HRDashboardPage() {
  const [dashboard, setDashboard] = useState<HRDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");
        const data = await getHRDashboard();
        setDashboard(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load HR dashboard.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
        Loading HR dashboard...
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        <p className="font-semibold">Unable to load HR dashboard</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HRDashboardCards dashboard={dashboard} />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Today&apos;s Attendance
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm font-medium text-green-700">
                Present
              </p>
              <p className="mt-2 text-3xl font-bold text-green-800">
                {dashboard.present_today}
              </p>
            </div>

            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">
                Absent
              </p>
              <p className="mt-2 text-3xl font-bold text-red-800">
                {dashboard.absent_today}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Employees by Department
          </h2>

          <div className="mt-4 space-y-3">
            {dashboard.departments.length === 0 ? (
              <p className="text-sm text-gray-500">
                No department data is available.
              </p>
            ) : (
              dashboard.departments.map((department) => (
                <div
                  key={department.department_id ?? "unassigned"}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {department.department__name || "Unassigned"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
                    {department.total}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
