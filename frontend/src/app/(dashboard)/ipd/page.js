"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bed,
  Building2,
  Clock3,
  Loader2,
  RefreshCw,
  UserPlus,
  Users,
} from "lucide-react";

import apiClient from "@/lib/api-client";


function dateValue(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}


export default function IpdDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(
    isRefresh = false,
  ) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await apiClient.get(
        "/ipd/dashboard/",
      );

      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.detail ||
          "Unable to load the IPD dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={42}
            className="mx-auto animate-spin text-orange-500"
          />

          <p className="mt-4 text-sm text-slate-500">
            Loading IPD dashboard...
          </p>
        </div>
      </div>
    );
  }

  const recentAdmissions =
    data?.recent_admissions || [];

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
            Inpatient Department
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            IPD Dashboard
          </h1>

          <p className="mt-2 text-slate-600">
            Monitor admissions, current inpatients,
            emergency cases, and discharges.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/ipd/admissions"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600"
          >
            <UserPlus size={18} />
            Manage Admissions
          </Link>

          <button
            type="button"
            onClick={() =>
              loadDashboard(true)
            }
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              size={18}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={Building2}
          label="Total Admissions"
          value={
            data?.total_admissions || 0
          }
        />

        <MetricCard
          icon={Clock3}
          label="Pending Admissions"
          value={
            data?.pending_admissions || 0
          }
        />

        <MetricCard
          icon={Bed}
          label="Current Inpatients"
          value={
            data?.current_inpatients || 0
          }
        />

        <MetricCard
          icon={UserPlus}
          label="Admitted Today"
          value={
            data?.admitted_today || 0
          }
        />

        <MetricCard
          icon={Activity}
          label="Discharged Today"
          value={
            data?.discharged_today || 0
          }
        />
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={22}
            className="mt-0.5 text-amber-600"
          />

          <div>
            <p className="text-sm font-semibold text-amber-900">
              Emergency Admissions
            </p>

            <p className="mt-1 text-3xl font-bold text-amber-950">
              {data?.emergency_admissions ||
                0}
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Recent Admissions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Latest inpatient admission records.
            </p>
          </div>

          <Link
            href="/ipd/admissions"
            className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <TableHeader>
                  Admission
                </TableHeader>

                <TableHeader>
                  Patient
                </TableHeader>

                <TableHeader>
                  Type
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Ward / Bed
                </TableHeader>

                <TableHeader>
                  Date
                </TableHeader>

                <TableHeader>
                  Action
                </TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {recentAdmissions.map(
                (admission) => (
                  <tr key={admission.id}>
                    <TableCell>
                      <span className="font-semibold text-slate-900">
                        {
                          admission.admission_number
                        }
                      </span>
                    </TableCell>

                    <TableCell>
                      {admission.patient_detail
                        ?.name || "Unknown"}
                    </TableCell>

                    <TableCell>
                      <span className="capitalize">
                        {String(
                          admission.admission_type ||
                            "",
                        ).replaceAll(
                          "_",
                          " ",
                        )}
                      </span>
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        value={
                          admission.status
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <div>
                        <p>
                          {admission.ward_detail
                            ?.name ||
                            "Not assigned"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Bed:{" "}
                          {admission.bed_detail
                            ?.name || "None"}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      {dateValue(
                        admission.admitted_at ||
                          admission.created_at,
                      )}
                    </TableCell>

                    <TableCell>
                      <Link
                        href={`/ipd/admissions/${admission.id}`}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        View
                      </Link>
                    </TableCell>
                  </tr>
                ),
              )}

              {!recentAdmissions.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-14 text-center"
                  >
                    <Users
                      size={40}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-4 font-semibold text-slate-700">
                      No admissions found
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


function MetricCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
        <Icon size={22} />
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}


function TableHeader({ children }) {
  return (
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}


function TableCell({ children }) {
  return (
    <td className="px-5 py-4 text-sm text-slate-700">
      {children}
    </td>
  );
}


function StatusBadge({ value }) {
  const normalized = String(
    value || "pending",
  ).toLowerCase();

  const classes = {
    pending:
      "bg-blue-100 text-blue-700",
    admitted:
      "bg-green-100 text-green-700",
    transferred:
      "bg-purple-100 text-purple-700",
    discharged:
      "bg-slate-200 text-slate-700",
    cancelled:
      "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        classes[normalized] ||
        classes.pending
      }`}
    >
      {normalized}
    </span>
  );
}
