"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, UserPlus, Users } from "lucide-react";
import HRDashboardCards from "@/components/hr/hr-dashboard-cards";
import { getHRDashboard } from "@/lib/api/hr";

export default function HRDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
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
            : "Unable to load HR dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading HR dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        <AlertCircle className="mt-0.5" size={20} />

        <div>
          <h2 className="font-semibold">Unable to load dashboard</h2>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HRDashboardCards dashboard={dashboard || {}} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Employee Management
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                View, search and manage hospital employees.
              </p>
            </div>

            <Users className="text-orange-500" size={28} />
          </div>

          <Link
            href="/hr/employees"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            View employees
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Add New Employee
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Register a staff member in the HR system.
              </p>
            </div>

            <UserPlus className="text-orange-500" size={28} />
          </div>

          <Link
            href="/hr/employees/new"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            Register employee
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
