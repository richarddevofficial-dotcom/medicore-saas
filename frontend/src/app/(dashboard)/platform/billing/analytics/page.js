"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Download,
  Loader2,
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


function monthLabel(value) {
  if (!value) {
    return "";
  }

  const [year, month] = String(value).split("-");

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(
    new Date(
      Number(year),
      Number(month) - 1,
      1,
    ),
  );
}


export default function RevenueAnalyticsPage() {
  const currentYear = new Date().getFullYear();

  const [dateFrom, setDateFrom] = useState(
    `${currentYear}-01-01`,
  );

  const [dateTo, setDateTo] = useState(
    `${currentYear}-12-31`,
  );

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [downloading, setDownloading] =
    useState("");

  const [error, setError] = useState("");

  async function loadAnalytics(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await apiClient.get(
        "/billing-center/analytics/",
        {
          params: {
            date_from: dateFrom,
            date_to: dateTo,
          },
        },
      );

      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.detail ||
          "Unable to load revenue analytics.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function downloadCsv(
    type,
    path,
    fallbackFilename,
  ) {
    try {
      setDownloading(type);
      setError("");

      const response = await apiClient.get(path, {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
        },
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
          "Unable to download report.",
      );
    } finally {
      setDownloading("");
    }
  }

  const maximumMonthlyRevenue = useMemo(() => {
    const values = (
      data?.revenue_by_month || []
    ).map((item) =>
      Number(item.revenue || 0),
    );

    return Math.max(...values, 1);
  }, [data]);

  const maximumPlanRevenue = useMemo(() => {
    const values = (
      data?.revenue_by_plan || []
    ).map((item) =>
      Number(item.revenue || 0),
    );

    return Math.max(...values, 1);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={42}
            className="mx-auto animate-spin text-orange-500"
          />

          <p className="mt-4 text-sm text-slate-500">
            Loading revenue analytics...
          </p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const currency = summary.currency || "USD";

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <Link
            href="/platform/billing"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={17} />
            Back to Billing Center
          </Link>

          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
            MediCore Platform
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Revenue Analytics
          </h1>

          <p className="mt-2 text-slate-600">
            Review SaaS revenue, subscription performance,
            payment success and conversion metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadAnalytics(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Date from
            </label>

            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Date to
            </label>

            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => loadAnalytics()}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Apply date range
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Total revenue"
          value={money(
            summary.total_revenue,
            currency,
          )}
        />

        <MetricCard
          icon={TrendingUp}
          label="Estimated MRR"
          value={money(
            summary.estimated_mrr,
            currency,
          )}
        />

        <MetricCard
          icon={BarChart3}
          label="Estimated ARR"
          value={money(
            summary.estimated_arr,
            currency,
          )}
        />

        <MetricCard
          icon={Wallet}
          label="Outstanding balance"
          value={money(
            summary.outstanding_balance,
            currency,
          )}
        />

        <MetricCard
          icon={Wallet}
          label="Revenue this month"
          value={money(
            summary.revenue_this_month,
            currency,
          )}
        />

        <MetricCard
          icon={Wallet}
          label="Service fees"
          value={money(
            summary.service_fee_revenue,
            currency,
          )}
        />

        <MetricCard
          icon={Wallet}
          label="Subscription revenue"
          value={money(
            summary.subscription_revenue,
            currency,
          )}
        />

        <MetricCard
          icon={TrendingUp}
          label="Average revenue per active hospital"
          value={money(
            summary.average_revenue_per_active_hospital,
            currency,
          )}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-xl font-bold text-slate-900">
            Revenue by Month
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Successful payment revenue across the selected range.
          </p>

          <div className="mt-8 flex min-h-72 items-end gap-3 overflow-x-auto border-b border-slate-200 pb-2">
            {data?.revenue_by_month?.length ? (
              data.revenue_by_month.map(
                (item) => {
                  const amount = Number(
                    item.revenue || 0,
                  );

                  const height = Math.max(
                    8,
                    (
                      amount /
                      maximumMonthlyRevenue
                    ) * 220,
                  );

                  return (
                    <div
                      key={item.month}
                      className="flex min-w-24 flex-1 flex-col items-center justify-end"
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
                No monthly revenue data.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Performance Metrics
          </h2>

          <div className="mt-6 space-y-4">
            <ProgressMetric
              label="Payment success rate"
              value={
                summary.payment_success_rate ||
                0
              }
            />

            <ProgressMetric
              label="Trial conversion rate"
              value={
                summary.trial_conversion_rate ||
                0
              }
            />

            <SummaryRow
              label="Active subscriptions"
              value={
                summary.active_subscriptions ||
                0
              }
            />

            <SummaryRow
              label="Trial subscriptions"
              value={
                summary.trial_subscriptions ||
                0
              }
            />

            <SummaryRow
              label="Grace subscriptions"
              value={
                summary.grace_subscriptions ||
                0
              }
            />

            <SummaryRow
              label="Suspended subscriptions"
              value={
                summary.suspended_subscriptions ||
                0
              }
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Revenue by Plan
          </h2>

          <div className="mt-6 space-y-5">
            {data?.revenue_by_plan?.length ? (
              data.revenue_by_plan.map(
                (item) => {
                  const amount = Number(
                    item.revenue || 0,
                  );

                  const width = Math.max(
                    4,
                    (
                      amount /
                      maximumPlanRevenue
                    ) * 100,
                  );

                  return (
                    <div
                      key={
                        item.plan_code ||
                        item.plan_name
                      }
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.plan_name ||
                              "Not configured"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {item.payments || 0} payment(s)
                          </p>
                        </div>

                        <p className="font-bold text-slate-900">
                          {money(
                            amount,
                            currency,
                          )}
                        </p>
                      </div>

                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{
                            width: `${width}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                },
              )
            ) : (
              <p className="text-sm text-slate-500">
                No plan revenue data.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Revenue by Country
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Country
                  </th>

                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payments
                  </th>

                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Revenue
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {data?.revenue_by_country?.map(
                  (item) => (
                    <tr key={item.country}>
                      <td className="py-4 font-semibold text-slate-800">
                        {item.country}
                      </td>

                      <td className="py-4 text-right text-slate-600">
                        {item.payments || 0}
                      </td>

                      <td className="py-4 text-right font-bold text-slate-900">
                        {money(
                          item.revenue,
                          currency,
                        )}
                      </td>
                    </tr>
                  ),
                )}

                {!data?.revenue_by_country?.length && (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      No country revenue data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DistributionCard
          title="Subscription Status Distribution"
          items={
            data?.subscription_distribution ||
            []
          }
          nameKey="status"
        />

        <DistributionCard
          title="Plan Distribution"
          items={data?.plan_distribution || []}
          nameKey="plan_name"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Export Billing Reports
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Reports use the selected date range.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ExportButton
              loading={
                downloading === "revenue"
              }
              label="Revenue CSV"
              onClick={() =>
                downloadCsv(
                  "revenue",
                  "/billing-center/reports/revenue.csv",
                  "medicore-revenue.csv",
                )
              }
            />

            <ExportButton
              loading={
                downloading === "invoices"
              }
              label="Invoices CSV"
              onClick={() =>
                downloadCsv(
                  "invoices",
                  "/billing-center/reports/invoices.csv",
                  "medicore-invoices.csv",
                )
              }
            />

            <ExportButton
              loading={
                downloading === "payments"
              }
              label="Payments CSV"
              onClick={() =>
                downloadCsv(
                  "payments",
                  "/billing-center/reports/payments.csv",
                  "medicore-payments.csv",
                )
              }
            />
          </div>
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


function ProgressMetric({
  label,
  value,
}) {
  const numericValue = Math.max(
    0,
    Math.min(100, Number(value || 0)),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">
          {label}
        </span>

        <span className="font-bold text-slate-900">
          {numericValue.toFixed(1)}%
        </span>
      </div>

      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-orange-500"
          style={{
            width: `${numericValue}%`,
          }}
        />
      </div>
    </div>
  );
}


function SummaryRow({
  label,
  value,
}) {
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


function DistributionCard({
  title,
  items,
  nameKey,
}) {
  const total = items.reduce(
    (sum, item) =>
      sum + Number(item.total || 0),
    0,
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">
        {title}
      </h2>

      <div className="mt-6 space-y-4">
        {items.map((item, index) => {
          const name =
            item[nameKey] ||
            item.plan_code ||
            "Not configured";

          const percentage = total
            ? (
                Number(item.total || 0) /
                total
              ) * 100
            : 0;

          return (
            <div
              key={`${name}-${index}`}
              className="rounded-xl bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize text-slate-800">
                  {String(name).replaceAll(
                    "_",
                    " ",
                  )}
                </span>

                <span className="font-bold text-slate-900">
                  {item.total || 0}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-slate-900"
                  style={{
                    width: `${percentage}%`,
                  }}
                />
              </div>
            </div>
          );
        })}

        {!items.length && (
          <p className="text-sm text-slate-500">
            No distribution data.
          </p>
        )}
      </div>
    </div>
  );
}


function ExportButton({
  label,
  onClick,
  loading,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {loading ? (
        <Loader2
          size={17}
          className="animate-spin"
        />
      ) : (
        <Download size={17} />
      )}

      {label}
    </button>
  );
}
