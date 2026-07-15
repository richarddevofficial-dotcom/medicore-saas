"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
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


export default function InvoiceCenterPage() {
  const [data, setData] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [invoiceType, setInvoiceType] =
    useState("");
  const [hospital, setHospital] =
    useState("");
  const [ordering, setOrdering] =
    useState("-created_at");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [actionLoading, setActionLoading] =
    useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] =
    useState("");

  async function loadInvoices(
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
        "/billing-center/invoices/",
        {
          params: {
            page: requestedPage,
            page_size: pageSize,
            search: search || undefined,
            status: status || undefined,
            invoice_type:
              invoiceType || undefined,
            hospital: hospital || undefined,
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
          "Unable to load invoices.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadInvoices(1);
    }, 350);

    return () =>
      window.clearTimeout(timer);
  }, [
    search,
    status,
    invoiceType,
    hospital,
    ordering,
  ]);

  async function downloadInvoice(invoice) {
    try {
      setError("");
      setActionLoading(
        `pdf-${invoice.id}`,
      );

      const response = await apiClient.get(
        `/billing-center/invoices/${invoice.id}/pdf/`,
        {
          responseType: "blob",
        },
      );

      const blobUrl =
        window.URL.createObjectURL(
          new Blob([response.data], {
            type: "application/pdf",
          }),
        );

      const link =
        document.createElement("a");

      link.href = blobUrl;
      link.download =
        `${invoice.invoice_number}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to download invoice.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function markOverdue(invoice) {
    if (
      !window.confirm(
        `Mark ${invoice.invoice_number} as overdue?`,
      )
    ) {
      return;
    }

    try {
      setActionLoading(
        `overdue-${invoice.id}`,
      );
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        `/billing-center/invoices/${invoice.id}/mark-overdue/`,
        {},
      );

      setSuccess(response.data.message);
      await loadInvoices(page);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to update invoice.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function markPaid(invoice) {
    const reference = window.prompt(
      "Enter payment reference:",
      `MANUAL-${invoice.invoice_number}`,
    );

    if (!reference) {
      return;
    }

    try {
      setActionLoading(
        `paid-${invoice.id}`,
      );
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        `/billing-center/invoices/${invoice.id}/mark-paid/`,
        {
          reference,
          notes:
            "Marked paid from Super Admin Invoice Center.",
        },
      );

      setSuccess(response.data.message);
      await loadInvoices(page);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to mark invoice paid.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function voidInvoice(invoice) {
    const reason = window.prompt(
      `Reason for voiding ${invoice.invoice_number}:`,
    );

    if (!reason) {
      return;
    }

    try {
      setActionLoading(
        `void-${invoice.id}`,
      );
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        `/billing-center/invoices/${invoice.id}/void/`,
        {
          reason,
        },
      );

      setSuccess(response.data.message);
      await loadInvoices(page);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to void invoice.",
      );
    } finally {
      setActionLoading(null);
    }
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
            Loading invoices...
          </p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const results = data?.results || [];
  const pagination =
    data?.pagination || {};

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
            Invoice Center
          </h1>

          <p className="mt-2 text-slate-600">
            Search, review, update and download
            hospital invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            loadInvoices(page, true)
          }
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

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Matching invoices"
          value={
            summary.matching_invoices || 0
          }
        />

        <SummaryCard
          label="Pending"
          value={summary.pending || 0}
        />

        <SummaryCard
          label="Overdue"
          value={summary.overdue || 0}
        />

        <SummaryCard
          label="Paid"
          value={summary.paid || 0}
        />

        <SummaryCard
          label="Total amount"
          value={money(
            summary.total_amount,
          )}
        />

        <SummaryCard
          label="Outstanding"
          value={money(
            summary.outstanding_balance,
          )}
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
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search invoice number, hospital or description..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">
              All statuses
            </option>
            <option value="pending">
              Pending
            </option>
            <option value="overdue">
              Overdue
            </option>
            <option value="paid">
              Paid
            </option>
            <option value="void">
              Void
            </option>
          </select>

          <select
            value={invoiceType}
            onChange={(event) =>
              setInvoiceType(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">
              All invoice types
            </option>
            <option value="combined">
              Combined
            </option>
            <option value="subscription">
              Subscription
            </option>
            <option value="service_fee">
              Service fee
            </option>
            <option value="adjustment">
              Adjustment
            </option>
          </select>

          <select
            value={ordering}
            onChange={(event) =>
              setOrdering(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="-created_at">
              Newest invoices
            </option>
            <option value="created_at">
              Oldest invoices
            </option>
            <option value="-total_amount">
              Highest amount
            </option>
            <option value="total_amount">
              Lowest amount
            </option>
            <option value="due_date">
              Due date
            </option>
          </select>
        </div>

        <input
          value={hospital}
          onChange={(event) =>
            setHospital(
              event.target.value,
            )
          }
          placeholder="Filter by hospital name or slug"
          className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:max-w-md"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <TableHeader>
                  Invoice
                </TableHeader>
                <TableHeader>
                  Hospital
                </TableHeader>
                <TableHeader>
                  Type
                </TableHeader>
                <TableHeader>
                  Total
                </TableHeader>
                <TableHeader>
                  Paid
                </TableHeader>
                <TableHeader>
                  Balance
                </TableHeader>
                <TableHeader>
                  Status
                </TableHeader>
                <TableHeader>
                  Due date
                </TableHeader>
                <TableHeader>
                  Actions
                </TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {results.map(
                (invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-slate-50"
                  >
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {
                            invoice.invoice_number
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {dateValue(
                            invoice.created_at,
                          )}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {
                            invoice.hospital
                              ?.name
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            invoice.hospital
                              ?.slug
                          }
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="capitalize">
                        {String(
                          invoice.invoice_type ||
                            "",
                        ).replaceAll(
                          "_",
                          " ",
                        )}
                      </span>
                    </TableCell>

                    <TableCell>
                      {money(
                        invoice.total_amount,
                        invoice.currency,
                      )}
                    </TableCell>

                    <TableCell>
                      {money(
                        invoice.amount_paid,
                        invoice.currency,
                      )}
                    </TableCell>

                    <TableCell>
                      <span
                        className={
                          Number(
                            invoice.balance_due ||
                              0,
                          ) > 0
                            ? "font-bold text-red-600"
                            : "font-semibold text-green-600"
                        }
                      >
                        {money(
                          invoice.balance_due,
                          invoice.currency,
                        )}
                      </span>
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        value={
                          invoice.status
                        }
                      />
                    </TableCell>

                    <TableCell>
                      {dateValue(
                        invoice.due_date,
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            downloadInvoice(
                              invoice,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {actionLoading ===
                          `pdf-${invoice.id}` ? (
                            <Loader2
                              size={14}
                              className="animate-spin"
                            />
                          ) : (
                            <Download
                              size={14}
                            />
                          )}
                          PDF
                        </button>

                        {invoice.status !==
                          "paid" && (
                          <button
                            type="button"
                            onClick={() =>
                              markPaid(
                                invoice,
                              )
                            }
                            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                          >
                            Mark paid
                          </button>
                        )}

                        {invoice.status ===
                          "pending" && (
                          <button
                            type="button"
                            onClick={() =>
                              markOverdue(
                                invoice,
                              )
                            }
                            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
                          >
                            Overdue
                          </button>
                        )}

                        {invoice.status !==
                          "paid" &&
                          invoice.status !==
                            "void" && (
                            <button
                              type="button"
                              onClick={() =>
                                voidInvoice(
                                  invoice,
                                )
                              }
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Void
                            </button>
                          )}
                      </div>
                    </TableCell>
                  </tr>
                ),
              )}

              {!results.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-16 text-center"
                  >
                    <FileText
                      size={42}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-4 font-semibold text-slate-700">
                      No invoices found
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Page {pagination.page || 1} of{" "}
            {pagination.total_pages || 1}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                loadInvoices(page - 1)
              }
              disabled={
                !pagination.has_previous ||
                loading
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              <ChevronLeft size={17} />
              Previous
            </button>

            <button
              type="button"
              onClick={() =>
                loadInvoices(page + 1)
              }
              disabled={
                !pagination.has_next ||
                loading
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
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


function SummaryCard({
  label,
  value,
}) {
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


function TableHeader({
  children,
}) {
  return (
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}


function TableCell({
  children,
}) {
  return (
    <td className="px-5 py-4 align-middle text-sm text-slate-700">
      {children}
    </td>
  );
}


function StatusBadge({
  value,
}) {
  const normalized = String(
    value || "pending",
  ).toLowerCase();

  const classes = {
    paid:
      "bg-green-100 text-green-700",
    pending:
      "bg-blue-100 text-blue-700",
    overdue:
      "bg-amber-100 text-amber-700",
    void:
      "bg-slate-200 text-slate-700",
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
