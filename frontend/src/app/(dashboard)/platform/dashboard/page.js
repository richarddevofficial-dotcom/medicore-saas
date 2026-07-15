"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Loader2,
  Receipt,
  TrendingUp,
  Users,
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
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}


function monthValue(value) {
  if (!value) return "";

  const [year, month] = value.split("-");

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(
    new Date(Number(year), Number(month) - 1, 1)
  );
}


export default function PlatformDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setError("");

      const response = await apiClient.get(
        "/saas-admin/dashboard/"
      );

      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to load the platform dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const maximumRevenue = useMemo(() => {
    const values = (
      data?.revenue_by_month || []
    ).map((item) => Number(item.total || 0));

    return Math.max(...values, 1);
  }, [data]);

  const maximumRegistrations = useMemo(() => {
    const values = (
      data?.registrations_by_month || []
    ).map((item) => Number(item.total || 0));

    return Math.max(...values, 1);
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <Loader2
          className="animate-spin text-orange-500"
          size={38}
        />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  const summary = data?.summary || {};
  const revenue = data?.revenue || {};
  const currency = revenue.currency || "USD";

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
            MediCore Platform
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            SaaS Administration Dashboard
          </h1>

          <p className="mt-2 text-slate-600">
            Monitor hospitals, subscriptions, revenue,
            invoices and payments.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Activity size={18} />
          Refresh dashboard
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Building2}
          label="Total hospitals"
          value={summary.total_hospitals || 0}
        />

        <MetricCard
          icon={CheckCircle2}
          label="Active hospitals"
          value={summary.active_hospitals || 0}
        />

        <MetricCard
          icon={Clock3}
          label="Trial hospitals"
          value={summary.trial_hospitals || 0}
        />

        <MetricCard
          icon={AlertTriangle}
          label="Grace and expired"
          value={
            Number(summary.grace_hospitals || 0) +
            Number(summary.expired_hospitals || 0)
          }
        />

        <MetricCard
          icon={Wallet}
          label="Monthly revenue"
          value={money(
            revenue.monthly_revenue,
            currency
          )}
        />

        <MetricCard
          icon={TrendingUp}
          label="Estimated MRR"
          value={money(
            revenue.estimated_mrr,
            currency
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
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Revenue trend
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Successful payments during the last year.
            </p>
          </div>

          <div className="mt-8 flex min-h-72 items-end gap-3 overflow-x-auto border-b border-slate-200 pb-2">
            {data?.revenue_by_month?.length ? (
              data.revenue_by_month.map((item) => {
                const amount = Number(item.total || 0);

                const height = Math.max(
                  8,
                  (amount / maximumRevenue) * 220
                );

                return (
                  <div
                    key={item.month}
                    className="flex min-w-16 flex-1 flex-col items-center justify-end"
                  >
                    <span className="mb-2 text-xs font-semibold text-slate-700">
                      {money(amount, currency)}
                    </span>

                    <div
                      className="w-full rounded-t-lg bg-orange-500"
                      style={{
                        height: `${height}px`,
                      }}
                    />

                    <span className="mt-2 text-xs text-slate-500">
                      {monthValue(item.month)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex w-full items-center justify-center py-20 text-slate-500">
                No revenue data available.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Revenue summary
          </h2>

          <div className="mt-6 space-y-4">
            <RevenueRow
              label="Total revenue"
              value={money(
                revenue.total_revenue,
                currency
              )}
            />

            <RevenueRow
              label="Monthly revenue"
              value={money(
                revenue.monthly_revenue,
                currency
              )}
            />

            <RevenueRow
              label="Service fees"
              value={money(
                revenue.service_fee_revenue,
                currency
              )}
            />

            <RevenueRow
              label="Estimated MRR"
              value={money(
                revenue.estimated_mrr,
                currency
              )}
            />

            <RevenueRow
              label="Estimated ARR"
              value={money(
                revenue.estimated_arr,
                currency
              )}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Subscription plans
          </h2>

          <div className="mt-6 space-y-5">
            {data?.plan_distribution?.length ? (
              data.plan_distribution.map((plan) => {
                const total = Number(plan.total || 0);

                const percentage =
                  summary.total_hospitals > 0
                    ? Math.round(
                        (
                          total /
                          summary.total_hospitals
                        ) * 100
                      )
                    : 0;

                return (
                  <div key={plan.code}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {plan.name}
                      </span>

                      <span className="text-sm text-slate-500">
                        {total} hospital(s)
                      </span>
                    </div>

                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-orange-500"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-slate-500">
                No subscription data available.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Hospital registrations
          </h2>

          <div className="mt-8 flex min-h-56 items-end gap-3 overflow-x-auto border-b border-slate-200 pb-2">
            {data?.registrations_by_month?.length ? (
              data.registrations_by_month.map(
                (item) => {
                  const total = Number(
                    item.total || 0
                  );

                  const height = Math.max(
                    8,
                    (
                      total /
                      maximumRegistrations
                    ) * 160
                  );

                  return (
                    <div
                      key={item.month}
                      className="flex min-w-14 flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-2 text-xs font-semibold text-slate-700">
                        {total}
                      </span>

                      <div
                        className="w-full rounded-t-lg bg-slate-800"
                        style={{
                          height: `${height}px`,
                        }}
                      />

                      <span className="mt-2 text-xs text-slate-500">
                        {monthValue(item.month)}
                      </span>
                    </div>
                  );
                }
              )
            ) : (
              <div className="flex w-full items-center justify-center py-16 text-slate-500">
                No registration data available.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900">
            Recent hospitals
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <TableHeading>Hospital</TableHeading>
                <TableHeading>Plan</TableHeading>
                <TableHeading>Status</TableHeading>
                <TableHeading>Trial ends</TableHeading>
                <TableHeading>Created</TableHeading>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data?.recent_hospitals?.length ? (
                data.recent_hospitals.map(
                  (hospital) => (
                    <tr key={hospital.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {hospital.name}
                          </p>

                          <p className="text-xs text-slate-500">
                            {hospital.slug}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        {hospital.plan ||
                          "Not configured"}
                      </TableCell>

                      <TableCell>
                        <StatusBadge
                          value={
                            hospital.subscription_status
                          }
                        />
                      </TableCell>

                      <TableCell>
                        {dateValue(
                          hospital.trial_ends_at
                        )}
                      </TableCell>

                      <TableCell>
                        {dateValue(
                          hospital.created_at
                        )}
                      </TableCell>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    No hospitals available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900">
            Pending payments
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <TableHeading>Hospital</TableHeading>
                <TableHeading>Invoice</TableHeading>
                <TableHeading>Reference</TableHeading>
                <TableHeading>Plan</TableHeading>
                <TableHeading>Amount</TableHeading>
                <TableHeading>Submitted</TableHeading>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data?.pending_payment_items?.length ? (
                data.pending_payment_items.map(
                  (payment) => (
                    <tr key={payment.id}>
                      <TableCell>
                        {payment.hospital.name}
                      </TableCell>

                      <TableCell>
                        {payment.invoice_number}
                      </TableCell>

                      <TableCell>
                        {payment.transaction_id ||
                          payment.payment_reference}
                      </TableCell>

                      <TableCell>
                        {payment.plan}
                      </TableCell>

                      <TableCell>
                        {money(
                          payment.amount,
                          payment.currency
                        )}
                      </TableCell>

                      <TableCell>
                        {dateValue(
                          payment.created_at
                        )}
                      </TableCell>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    No pending payments.
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


function MetricCard({ icon: Icon, label, value }) {
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


function RevenueRow({ label, value }) {
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


function StatusBadge({ value }) {
  const success = value === "active";

  const warning = [
    "trial",
    "grace",
  ].includes(value);

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        success
          ? "bg-green-100 text-green-700"
          : warning
            ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-700"
      }`}
    >
      {String(value || "").replaceAll("_", " ")}
    </span>
  );
}


function TableHeading({ children }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}


function TableCell({ children }) {
  return (
    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
      {children}
    </td>
  );
}
