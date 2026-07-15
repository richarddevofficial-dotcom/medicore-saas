"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  Search,
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


export default function HospitalBillingListPage() {
  const [data, setData] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [country, setCountry] = useState("");
  const [ordering, setOrdering] =
    useState("-created_at");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");

  async function loadHospitals(
    requestedPage = page,
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
        "/billing-center/hospitals/",
        {
          params: {
            page: requestedPage,
            page_size: pageSize,
            search: search || undefined,
            status: status || undefined,
            plan: plan || undefined,
            country: country || undefined,
            ordering,
          },
        },
      );

      setData(response.data);
      setPage(
        response.data?.pagination?.page ||
          requestedPage,
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.detail ||
          "Unable to load hospital billing records.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadHospitals(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    search,
    status,
    plan,
    country,
    ordering,
  ]);

  function handlePreviousPage() {
    if (!data?.pagination?.has_previous) {
      return;
    }

    loadHospitals(page - 1);
  }

  function handleNextPage() {
    if (!data?.pagination?.has_next) {
      return;
    }

    loadHospitals(page + 1);
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={42}
            className="mx-auto animate-spin text-orange-500"
          />

          <p className="mt-4 text-sm text-slate-500">
            Loading hospital billing records...
          </p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const results = data?.results || [];
  const pagination = data?.pagination || {};

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
            Hospital Billing Management
          </h1>

          <p className="mt-2 text-slate-600">
            Search and manage hospital subscriptions,
            invoices, balances and payment status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadHospitals(page, true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw
            size={18}
            className={
              refreshing ? "animate-spin" : ""
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Total hospitals"
          value={summary.total_hospitals || 0}
        />

        <SummaryCard
          label="Active"
          value={summary.active || 0}
        />

        <SummaryCard
          label="Trial"
          value={summary.trial || 0}
        />

        <SummaryCard
          label="Grace"
          value={summary.grace || 0}
        />

        <SummaryCard
          label="Suspended"
          value={summary.suspended || 0}
        />

        <SummaryCard
          label="Not configured"
          value={summary.unconfigured || 0}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search hospital name, slug, email or phone..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All statuses</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="grace">Grace</option>
            <option value="expired">Expired</option>
            <option value="suspended">
              Suspended
            </option>
          </select>

          <select
            value={plan}
            onChange={(event) =>
              setPlan(event.target.value)
            }
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All plans</option>
            <option value="starter">Starter</option>
            <option value="pro">Professional</option>
            <option value="enterprise">
              Enterprise
            </option>
          </select>

          <select
            value={ordering}
            onChange={(event) =>
              setOrdering(event.target.value)
            }
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="-created_at">
              Newest hospitals
            </option>
            <option value="created_at">
              Oldest hospitals
            </option>
            <option value="name">
              Name A–Z
            </option>
            <option value="-name">
              Name Z–A
            </option>
            <option value="next_billing_date">
              Next billing
            </option>
            <option value="trial_ends_at">
              Trial ending
            </option>
          </select>
        </div>

        <div className="mt-4">
          <input
            value={country}
            onChange={(event) =>
              setCountry(event.target.value)
            }
            placeholder="Filter by exact country, for example South Sudan"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:max-w-md"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <TableHeader>
                  Hospital
                </TableHeader>

                <TableHeader>
                  Plan
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Monthly fee
                </TableHeader>

                <TableHeader>
                  Outstanding
                </TableHeader>

                <TableHeader>
                  Invoices
                </TableHeader>

                <TableHeader>
                  Payments
                </TableHeader>

                <TableHeader>
                  Next billing
                </TableHeader>

                <TableHeader>
                  Action
                </TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {results.map((hospital) => {
                const subscription =
                  hospital.subscription;

                const billing =
                  hospital.billing || {};

                const currency =
                  subscription?.currency ||
                  "USD";

                return (
                  <tr
                    key={hospital.id}
                    className="hover:bg-slate-50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                          <Building2 size={20} />
                        </div>

                        <div>
                          <p className="font-semibold text-slate-900">
                            {hospital.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {hospital.slug}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {hospital.country ||
                              "Country not set"}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {subscription?.plan?.name ||
                        "Not configured"}
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        value={
                          subscription?.status ||
                          "not_configured"
                        }
                      />
                    </TableCell>

                    <TableCell>
                      {subscription
                        ? money(
                            subscription.monthly_price,
                            currency,
                          )
                        : "—"}
                    </TableCell>

                    <TableCell>
                      <span
                        className={
                          Number(
                            billing.outstanding_balance ||
                              0,
                          ) > 0
                            ? "font-bold text-red-600"
                            : "font-semibold text-slate-700"
                        }
                      >
                        {money(
                          billing.outstanding_balance,
                          currency,
                        )}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <p className="text-slate-700">
                          Pending:{" "}
                          {billing.pending_invoices ||
                            0}
                        </p>

                        <p className="mt-1 text-red-600">
                          Overdue:{" "}
                          {billing.overdue_invoices ||
                            0}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <p className="text-slate-700">
                          Pending:{" "}
                          {billing.pending_payments ||
                            0}
                        </p>

                        <p className="mt-1 text-green-600">
                          Paid:{" "}
                          {billing.successful_payments ||
                            0}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      {dateValue(
                        subscription?.next_billing_date,
                      )}
                    </TableCell>

                    <TableCell>
                      <Link
                        href={`/platform/billing/hospitals/${hospital.id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        <Eye size={16} />
                        View Details
                      </Link>
                    </TableCell>
                  </tr>
                );
              })}

              {!results.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-16 text-center"
                  >
                    <Building2
                      size={42}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-4 font-semibold text-slate-700">
                      No hospitals found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your filters or search term.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Showing page {pagination.page || 1} of{" "}
            {pagination.total_pages || 1}. Total{" "}
            {pagination.total_items || 0} hospitals.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePreviousPage}
              disabled={
                !pagination.has_previous ||
                loading
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={17} />
              Previous
            </button>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={
                !pagination.has_next ||
                loading
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}


function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
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
    <td className="px-5 py-4 align-middle text-sm text-slate-700">
      {children}
    </td>
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
    expired:
      "bg-slate-200 text-slate-700",
    suspended:
      "bg-red-100 text-red-700",
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
