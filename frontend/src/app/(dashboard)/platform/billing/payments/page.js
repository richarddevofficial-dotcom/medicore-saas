"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import Modal from "@/components/ui/Modal";

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function PaymentCenterPage() {
  const [data, setData] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [gateway, setGateway] = useState("");
  const [billingCycle, setBillingCycle] = useState("");
  const [hospital, setHospital] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ordering, setOrdering] = useState("-created_at");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentToApprove, setPaymentToApprove] = useState(null);
  const [paymentToReject, setPaymentToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  async function loadPayments(requestedPage = page, isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await apiClient.get("/billing-center/payments/", {
        params: {
          page: requestedPage,
          page_size: pageSize,
          search: search || undefined,
          status: status || undefined,
          payment_type: paymentType || undefined,
          gateway: gateway || undefined,
          billing_cycle: billingCycle || undefined,
          hospital: hospital || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          ordering,
        },
      });

      setData(response.data);
      setPage(response.data?.pagination?.page || requestedPage);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.detail ||
          "Unable to load payments.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPayments(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    search,
    status,
    paymentType,
    gateway,
    billingCycle,
    hospital,
    dateFrom,
    dateTo,
    ordering,
  ]);

  async function approvePayment(payment) {
    try {
      setActionLoading(`approve-${payment.id}`);
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        `/billing-center/payments/${payment.id}/approve/`,
        {},
      );

      const message =
        response.data?.message || "Payment approved successfully.";

      setSuccess(message);
      toast.success(message);
      setPaymentToApprove(null);
      await loadPayments(page);
    } catch (requestError) {
      const responseData = requestError.response?.data;
      const message =
        responseData?.error ||
        responseData?.detail ||
        responseData?.message ||
        "Unable to approve payment. Check that backend migrations are applied.";

      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  function closeApprovalModal() {
    if (actionLoading !== null) {
      return;
    }

    setPaymentToApprove(null);
  }

  async function rejectPayment(payment) {
    const reason = rejectionReason.trim();

    if (!reason) {
      toast.error("Enter a reason for rejecting this payment.");
      return;
    }

    try {
      setActionLoading(`reject-${payment.id}`);
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        `/billing-center/payments/${payment.id}/reject/`,
        {
          reason,
        },
      );

      const message = response.data?.message || "Payment rejected.";

      setSuccess(message);
      toast.success(message);
      setPaymentToReject(null);
      setRejectionReason("");
      await loadPayments(page);
    } catch (requestError) {
      const responseData = requestError.response?.data;
      const message =
        responseData?.error ||
        responseData?.detail ||
        responseData?.message ||
        "Unable to reject payment.";

      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  function closeRejectionModal() {
    if (actionLoading !== null) {
      return;
    }

    setPaymentToReject(null);
    setRejectionReason("");
  }

  async function downloadReceipt(payment) {
    try {
      setActionLoading(`receipt-${payment.id}`);
      setError("");

      const response = await apiClient.get(
        `/billing-center/payments/${payment.id}/receipt-pdf/`,
        {
          responseType: "blob",
        },
      );

      const blobUrl = window.URL.createObjectURL(
        new Blob([response.data], {
          type: "application/pdf",
        }),
      );

      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = `receipt-${payment.payment_reference}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "Unable to download receipt.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function downloadProof(payment) {
    try {
      setActionLoading(`proof-${payment.id}`);
      setError("");

      const response = await apiClient.get(payment.proof_of_payment_url, {
        responseType: "blob",
      });
      const disposition = response.headers["content-disposition"] || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download =
        filenameMatch?.[1] || `proof-${payment.payment_reference}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError) {
      const message =
        requestError.response?.data?.error ||
        "Unable to download payment proof.";
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2 size={42} className="mx-auto animate-spin text-orange-500" />

          <p className="mt-4 text-sm text-slate-500">Loading payments...</p>
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
            Payment Center
          </h1>

          <p className="mt-2 text-slate-600">
            Review submitted payments, approve or reject requests, and download
            receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadPayments(page, true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
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
          label="Matching payments"
          value={summary.matching_payments || 0}
        />

        <SummaryCard label="Pending" value={summary.pending || 0} />

        <SummaryCard label="Confirmed" value={summary.successful || 0} />

        <SummaryCard label="Rejected" value={summary.failed || 0} />

        <SummaryCard
          label="Confirmed amount"
          value={money(summary.successful_amount)}
        />

        <SummaryCard
          label="Pending amount"
          value={money(summary.pending_amount)}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference, transaction, invoice or hospital..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="success">Confirmed</option>
            <option value="failed">Rejected</option>
          </select>

          <select
            value={paymentType}
            onChange={(event) => setPaymentType(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All payment types</option>
            <option value="combined">Combined</option>
            <option value="subscription">Subscription</option>
            <option value="service_fee">Service fee</option>
          </select>

          <select
            value={billingCycle}
            onChange={(event) => setBillingCycle(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All billing cycles</option>
            <option value="monthly">Monthly</option>
            <option value="six_months">Six months</option>
            <option value="annual">Annual</option>
          </select>

          <select
            value={gateway}
            onChange={(event) => setGateway(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All gateways</option>
            <option value="manual">Manual</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
          </select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={hospital}
            onChange={(event) => setHospital(event.target.value)}
            placeholder="Filter by hospital name or slug"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />

          <select
            value={ordering}
            onChange={(event) => setOrdering(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="-created_at">Newest payments</option>
            <option value="created_at">Oldest payments</option>
            <option value="-amount">Highest amount</option>
            <option value="amount">Lowest amount</option>
            <option value="-paid_at">Recently paid</option>
          </select>

          <label className="text-xs font-semibold text-slate-600">
            Submitted from
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="text-xs font-semibold text-slate-600">
            Submitted to
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1350px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <TableHeader>Payment</TableHeader>
                <TableHeader>Hospital</TableHeader>
                <TableHeader>Invoice</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Method</TableHeader>
                <TableHeader>Gateway</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Actions</TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {results.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {payment.payment_reference}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Transaction: {payment.transaction_id || "Not provided"}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {payment.hospital?.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {payment.hospital?.slug}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    {payment.invoice_number || "Not available"}
                  </TableCell>

                  <TableCell>
                    <span className="capitalize">
                      {String(payment.payment_type || "").replaceAll("_", " ")}
                    </span>
                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {String(payment.billing_cycle || "monthly").replaceAll(
                        "_",
                        " ",
                      )}
                    </p>
                  </TableCell>

                  <TableCell>
                    <span className="font-semibold text-slate-900">
                      {money(payment.amount, payment.currency)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="capitalize">
                      {String(payment.payment_method || "").replaceAll(
                        "_",
                        " ",
                      )}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="capitalize">
                      {String(payment.gateway || "").replaceAll("_", " ")}
                    </span>
                  </TableCell>

                  <TableCell>
                    <StatusBadge
                      value={payment.status_label || payment.status}
                    />
                  </TableCell>

                  <TableCell>
                    {dateValue(payment.payment_date || payment.created_at)}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {payment.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPaymentToApprove(payment)}
                            disabled={actionLoading !== null}
                            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === `approve-${payment.id}` ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPaymentToReject(payment);
                              setRejectionReason("");
                            }}
                            disabled={actionLoading !== null}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {actionLoading === `reject-${payment.id}` ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <XCircle size={14} />
                            )}
                            Reject
                          </button>
                        </>
                      )}

                      {payment.status === "success" && (
                        <button
                          type="button"
                          onClick={() => downloadReceipt(payment)}
                          disabled={actionLoading !== null}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {actionLoading === `receipt-${payment.id}` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          Receipt
                        </button>
                      )}

                      {payment.has_proof_of_payment && (
                        <button
                          type="button"
                          onClick={() => downloadProof(payment)}
                          disabled={actionLoading !== null}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {actionLoading === `proof-${payment.id}` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          Proof
                        </button>
                      )}
                    </div>
                  </TableCell>
                </tr>
              ))}

              {!results.length && (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <CreditCard size={42} className="mx-auto text-slate-300" />

                    <p className="mt-4 font-semibold text-slate-700">
                      No payments found
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Page {pagination.page || 1} of {pagination.total_pages || 1}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadPayments(page - 1)}
              disabled={!pagination.has_previous || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              <ChevronLeft size={17} />
              Previous
            </button>

            <button
              type="button"
              onClick={() => loadPayments(page + 1)}
              disabled={!pagination.has_next || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>

      <Modal
        isOpen={Boolean(paymentToApprove)}
        onClose={closeApprovalModal}
        title="Approve Payment"
        size="md"
        showClose={actionLoading === null}
        footer={
          <>
            <button
              type="button"
              onClick={closeApprovalModal}
              disabled={actionLoading !== null}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => approvePayment(paymentToApprove)}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === `approve-${paymentToApprove?.id}` ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <ShieldCheck size={17} />
              )}
              Approve Payment
            </button>
          </>
        }
      >
        {paymentToApprove && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <ShieldCheck
                size={22}
                className="mt-0.5 shrink-0 text-green-700"
              />
              <div>
                <p className="font-semibold text-green-900">
                  Confirm this payment is verified
                </p>
                <p className="mt-1 text-sm text-green-800">
                  Approval marks the invoice paid, updates the subscription,
                  sends a receipt, and records the decision in the audit log.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <PaymentDetail
                label="Hospital"
                value={paymentToApprove.hospital?.name}
              />
              <PaymentDetail
                label="Amount"
                value={money(
                  paymentToApprove.amount,
                  paymentToApprove.currency,
                )}
                emphasize
              />
              <PaymentDetail
                label="Payment reference"
                value={paymentToApprove.payment_reference}
              />
              <PaymentDetail
                label="Invoice"
                value={paymentToApprove.invoice_number}
              />
              <PaymentDetail
                label="Transaction ID"
                value={paymentToApprove.transaction_id || "Not provided"}
              />
              <PaymentDetail
                label="Payment method"
                value={String(
                  paymentToApprove.payment_method ||
                    paymentToApprove.gateway ||
                    "Not provided",
                ).replaceAll("_", " ")}
              />
              <PaymentDetail
                label="Billing cycle"
                value={String(
                  paymentToApprove.billing_cycle || "monthly",
                ).replaceAll("_", " ")}
              />
              <PaymentDetail
                label="Current expiry"
                value={dateValue(paymentToApprove.current_subscription_expiry)}
              />
            </dl>

            {paymentToApprove.has_proof_of_payment && (
              <button
                type="button"
                onClick={() => downloadProof(paymentToApprove)}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download size={17} />
                Download Payment Proof
              </button>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(paymentToReject)}
        onClose={closeRejectionModal}
        title="Reject Payment"
        size="md"
        showClose={actionLoading === null}
        footer={
          <>
            <button
              type="button"
              onClick={closeRejectionModal}
              disabled={actionLoading !== null}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => rejectPayment(paymentToReject)}
              disabled={actionLoading !== null || !rejectionReason.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === `reject-${paymentToReject?.id}` ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <XCircle size={17} />
              )}
              Reject Payment
            </button>
          </>
        }
      >
        {paymentToReject && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <XCircle size={22} className="mt-0.5 shrink-0 text-red-700" />
              <div>
                <p className="font-semibold text-red-900">
                  Confirm this payment should be rejected
                </p>
                <p className="mt-1 text-sm text-red-800">
                  The payment will be marked as failed and the reason will be
                  recorded in the audit log.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <PaymentDetail
                label="Hospital"
                value={paymentToReject.hospital?.name}
              />
              <PaymentDetail
                label="Amount"
                value={money(paymentToReject.amount, paymentToReject.currency)}
                emphasize
              />
              <PaymentDetail
                label="Payment reference"
                value={paymentToReject.payment_reference}
              />
              <PaymentDetail
                label="Invoice"
                value={paymentToReject.invoice_number}
              />
            </dl>

            <div>
              <label
                htmlFor="payment-rejection-reason"
                className="text-sm font-semibold text-slate-800"
              >
                Rejection reason
              </label>
              <textarea
                id="payment-rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                disabled={actionLoading !== null}
                maxLength={500}
                rows={4}
                autoFocus
                placeholder="Explain why this payment cannot be approved"
                className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100"
              />
              <p className="mt-1 text-right text-xs text-slate-500">
                {rejectionReason.length}/500
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PaymentDetail({ label, value, emphasize = false }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words capitalize ${
          emphasize
            ? "text-lg font-bold text-slate-900"
            : "font-medium text-slate-800"
        }`}
      >
        {value || "Not available"}
      </dd>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
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
  const normalized = String(value || "pending").toLowerCase();

  const classes = {
    success: "bg-green-100 text-green-700",
    confirmed: "bg-green-100 text-green-700",
    pending: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        classes[normalized] || classes.pending
      }`}
    >
      {normalized}
    </span>
  );
}
