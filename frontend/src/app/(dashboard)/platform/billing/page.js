"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";

import apiClient from "@/lib/api-client";


function money(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}


function dateValue(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}


function monthLabel(value) {
  if (!value) {
    return "";
  }

  const [year, month] = value.split("-");

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(
    new Date(
      Number(year),
      Number(month) - 1,
      1,
    ),
  );
}


export default function BillingCenterDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadData(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const results = await Promise.allSettled([
        apiClient.get(
          "/billing-center/dashboard/",
        ),
        apiClient.get(
          "/billing-center/analytics/",
        ),
      ]);

      const dashboardResult = results[0];
      const analyticsResult = results[1];

      if (dashboardResult.status === "fulfilled") {
        setDashboard(
          dashboardResult.value.data,
        );
      }

      if (analyticsResult.status === "fulfilled") {
        setAnalytics(
          analyticsResult.value.data,
        );
      }

      const failures = [];

      if (dashboardResult.status === "rejected") {
        const dashboardError =
          dashboardResult.reason;

        failures.push(
          `Dashboard: ${
            dashboardError.response?.data?.error ||
            dashboardError.response?.data?.detail ||
            dashboardError.message ||
            "Request failed"
          }`,
        );
      }

      if (analyticsResult.status === "rejected") {
        const analyticsError =
          analyticsResult.reason;

        failures.push(
          `Analytics: ${
            analyticsError.response?.data?.error ||
            analyticsError.response?.data?.detail ||
            analyticsError.message ||
            "Request failed"
          }`,
        );
      }

      if (failures.length) {
        throw new Error(failures.join(" | "));
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.detail ||
          requestError.message ||
          "Unable to load the billing center.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function downloadCsv(path, fallbackFilename) {
    try {
      setError("");

      const response = await apiClient.get(path, {
        responseType: "blob",
      });

      const disposition =
        response.headers["content-disposition"] ||
        "";

      const filenameMatch =
        disposition.match(/filename="?([^"]+)"?/);

      const filename =
        filenameMatch?.[1] ||
        fallbackFilename;

      const blobUrl =
        window.URL.createObjectURL(
          new Blob([response.data], {
            type: "text/csv",
          }),
        );

      const link =
        document.createElement("a");

      link.href = blobUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to download the report.",
      );
    }
  }

  const maximumRevenue = useMemo(() => {
    const values = (
      analytics?.revenue_by_month || []
    ).map((item) =>
      Number(item.revenue || 0),
    );

    return Math.max(...values, 1);
  }, [analytics]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2
            className="mx-auto animate-spin text-orange-500"
            size={42}
          />

          <p className="mt-4 text-sm text-slate-500">
            Loading billing center...
          </p>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">
            Unable to open Billing Center
          </p>

          <p className="mt-2 text-sm">
            {error}
          </p>

          <button
            type="button"
            onClick={() => loadData()}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const summary =
    dashboard?.summary || {};

  const revenue =
    analytics?.summary ||
    dashboard?.revenue ||
    {};

  const currency =
    revenue.currency || "USD";

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
            MediCore Platform
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Super Admin Billing Center
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Manage hospitals, subscriptions,
            invoices, payments and SaaS revenue.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => loadData(true)}
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

          <Link
            href="/platform/billing/hospitals"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
          >
            <Building2 size={18} />
            Manage Hospitals
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Building2}
          label="Total hospitals"
          value={summary.total_hospitals || 0}
        />

        <MetricCard
          icon={CheckCircle2}
          label="Active subscriptions"
          value={
            summary.active_subscriptions || 0
          }
        />

        <MetricCard
          icon={Clock3}
          label="Trial subscriptions"
          value={
            summary.trial_subscriptions || 0
          }
        />

        <MetricCard
          icon={AlertTriangle}
          label="Suspended"
          value={
            summary.suspended_subscriptions || 0
          }
        />

        <MetricCard
          icon={Wallet}
          label="Revenue this month"
          value={money(
            revenue.revenue_this_month,
            currency,
          )}
        />

        <MetricCard
          icon={TrendingUp}
          label="Estimated MRR"
          value={money(
            revenue.estimated_mrr,
            currency,
          )}
        />

        <MetricCard
          icon={CreditCard}
          label="Pending payments"
          value={summary.pending_payments || 0}
        />

        <MetricCard
          icon={Receipt}
          label="Overdue invoices"
          value={summary.overdue_invoices || 0}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Revenue trend
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Successful payments across the selected period.
              </p>
            </div>

            <BarChart3
              className="text-orange-500"
              size={26}
            />
          </div>

          <div className="mt-8 flex min-h-72 items-end gap-3 overflow-x-auto border-b border-slate-200 pb-2">
            {analytics?.revenue_by_month?.length ? (
              analytics.revenue_by_month.map(
                (item) => {
                  const amount = Number(
                    item.revenue || 0,
                  );

                  const height = Math.max(
                    8,
                    (
                      amount /
                      maximumRevenue
                    ) * 220,
                  );

                  return (
                    <div
                      key={item.month}
                      className="flex min-w-20 flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-2 text-xs font-semibold text-slate-700">
                        {money(
                          amount,
                          currency,
                        )}
                      </span>

                      <div
                        className="w-full rounded-t-xl bg-orange-500"
                        style={{
                          height: `${height}px`,
                        }}
                      />

                      <span className="mt-2 text-xs text-slate-500">
                        {monthLabel(item.month)}
                      </span>
                    </div>
                  );
                },
              )
            ) : (
              <div className="flex w-full items-center justify-center py-20 text-slate-500">
                No revenue data available.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Revenue Summary
          </h2>

          <div className="mt-6 space-y-4">
            <SummaryRow
              label="Total revenue"
              value={money(
                revenue.total_revenue,
                currency,
              )}
            />

            <SummaryRow
              label="Service fees"
              value={money(
                revenue.service_fee_revenue,
                currency,
              )}
            />

            <SummaryRow
              label="Subscription revenue"
              value={money(
                revenue.subscription_revenue,
                currency,
              )}
            />

            <SummaryRow
              label="Estimated ARR"
              value={money(
                revenue.estimated_arr,
                currency,
              )}
            />

            <SummaryRow
              label="Outstanding balance"
              value={money(
                revenue.outstanding_balance,
                currency,
              )}
            />

            <SummaryRow
              label="Payment success"
              value={`${Number(
                revenue.payment_success_rate || 0,
              ).toFixed(1)}%`}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Export Reports
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Download billing information as CSV files.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ExportButton
              label="Revenue CSV"
              onClick={() =>
                downloadCsv(
                  "/billing-center/reports/revenue.csv",
                  "medicore-revenue.csv",
                )
              }
            />

            <ExportButton
              label="Invoices CSV"
              onClick={() =>
                downloadCsv(
                  "/billing-center/reports/invoices.csv",
                  "medicore-invoices.csv",
                )
              }
            />

            <ExportButton
              label="Payments CSV"
              onClick={() =>
                downloadCsv(
                  "/billing-center/reports/payments.csv",
                  "medicore-payments.csv",
                )
              }
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Recent Hospitals
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Latest hospitals registered on MediCore.
              </p>
            </div>

            <Link
              href="/platform/billing/hospitals"
              className="text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {dashboard?.recent_hospitals?.length ? (
              dashboard.recent_hospitals.map(
                (hospital) => (
                  <div
                    key={hospital.id}
                    className="flex items-center justify-between gap-4 p-5"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {hospital.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {hospital.slug}
                      </p>
                    </div>

                    <div className="text-right">
                      <StatusBadge
                        value={
                          hospital.subscription_status
                        }
                      />

                      <p className="mt-2 text-xs text-slate-500">
                        {hospital.subscription_plan ||
                          "No plan"}
                      </p>
                    </div>
                  </div>
                ),
              )
            ) : (
              <p className="p-6 text-sm text-slate-500">
                No hospitals available.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Pending Payments
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Payments requiring review.
              </p>
            </div>

            <Link
              href="/platform/billing/payments"
              className="text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              Review all
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {dashboard?.pending_payments?.length ? (
              dashboard.pending_payments.map(
                (payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-4 p-5"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {payment.hospital.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {payment.invoice.invoice_number}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        {money(
                          payment.amount,
                          payment.currency,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {dateValue(
                          payment.created_at,
                        )}
                      </p>
                    </div>
                  </div>
                ),
              )
            ) : (
              <p className="p-6 text-sm text-slate-500">
                No pending payments.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/platform/billing/hospitals"
          icon={Building2}
          label="Hospital Billing"
        />

        <QuickLink
          href="/platform/billing/invoices"
          icon={FileText}
          label="Invoice Center"
        />

        <QuickLink
          href="/platform/billing/payments"
          icon={CreditCard}
          label="Payment Center"
        />

        <QuickLink
          href="/platform/billing/analytics"
          icon={BarChart3}
          label="Revenue Analytics"
        />
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


function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-600">
        {label}
      </span>

      <span className="font-bold text-slate-900">
        {value}
      </span>
    </div>
  );
}


function ExportButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      <Download size={17} />
      {label}
    </button>
  );
}


function QuickLink({
  href,
  icon: Icon,
  label,
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
        <Icon size={21} />
      </div>

      <span className="font-semibold text-slate-900">
        {label}
      </span>
    </Link>
  );
}


function StatusBadge({ value }) {
  const normalized = String(
    value || "not_configured",
  ).toLowerCase();

  const classes = {
    active:
      "bg-green-100 text-green-700",
    trial:
      "bg-blue-100 text-blue-700",
    grace:
      "bg-amber-100 text-amber-700",
    suspended:
      "bg-red-100 text-red-700",
    expired:
      "bg-slate-200 text-slate-700",
    not_configured:
      "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        classes[normalized] ||
        classes.not_configured
      }`}
    >
      {normalized.replaceAll("_", " ")}
    </span>
  );
}
