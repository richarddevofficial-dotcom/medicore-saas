"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Receipt,
  Send,
  Wallet,
  X,
} from "lucide-react";

import apiClient from "@/lib/api-client";

function money(value, currency = "USD") {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function dateValue(value) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function BillingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  async function loadBilling() {
    try {
      setError("");

      const response = await apiClient.get("/saas-billing/dashboard/");

      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to load billing information.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createInitialInvoice() {
    try {
      setCreatingInvoice(true);
      setError("");
      setSuccessMessage("");

      const response = await apiClient.post(
        "/saas-billing/invoices/generate-initial/",
      );

      setSuccessMessage(response.data.message);
      await loadBilling();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "Unable to create the invoice.",
      );
    } finally {
      setCreatingInvoice(false);
    }
  }

  async function submitPayment(form) {
    try {
      setSubmittingPayment(true);
      setError("");
      setSuccessMessage("");

      const response = await apiClient.post("/saas-billing/payments/manual/", {
        invoice_id: selectedInvoice.id,
        transaction_id: form.transaction_id,
        payment_method: form.payment_method,
        amount: selectedInvoice.balance_due,
        notes: form.notes,
      });

      setSuccessMessage(response.data.message);
      setSelectedInvoice(null);
      await loadBilling();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "Unable to submit payment.",
      );
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function downloadFile(path, fallbackFilename) {
    try {
      setError("");

      const response = await apiClient.get(path, {
        responseType: "blob",
      });

      const contentDisposition =
        response.headers?.["content-disposition"] || "";
      const filenameMatch = contentDisposition.match(
        /filename\*?=(?:UTF-8''|"?)([^";]+)/i,
      );
      const resolvedFilename = filenameMatch
        ? decodeURIComponent(filenameMatch[1].replace(/"/g, "").trim())
        : fallbackFilename;

      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = resolvedFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to download file right now.",
      );
    }
  }

  useEffect(() => {
    loadBilling();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={36} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  const subscription = data?.subscription || {};
  const summary = data?.summary || {};
  const currency = subscription.currency || "USD";

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Billing and Subscription
        </h1>

        <p className="mt-2 text-slate-600">
          Manage your MediCore plan, invoices and payments.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
          {successMessage}
        </div>
      )}

      {subscription.status === "trial" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 text-blue-600" />

            <div>
              <h2 className="font-bold text-blue-900">Free trial active</h2>

              <p className="mt-1 text-blue-700">
                {subscription.trial_days_remaining} day(s) remaining. Trial ends{" "}
                {dateValue(subscription.trial_ends_at)}.
              </p>
            </div>
          </div>
        </div>
      )}

      {subscription.status === "grace" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-900">Grace period active</h2>

          <p className="mt-1 text-amber-700">
            Complete payment within {subscription.grace_days_remaining} day(s).
          </p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={CreditCard}
          label="Current plan"
          value={subscription.plan || "Not configured"}
        />

        <SummaryCard
          icon={Wallet}
          label="Monthly subscription"
          value={money(subscription.monthly_price, currency)}
        />

        <SummaryCard
          icon={Receipt}
          label="Platform service fee"
          value={
            subscription.service_fee_paid
              ? "Paid"
              : money(subscription.service_fee, currency)
          }
        />

        <SummaryCard
          icon={FileText}
          label="Outstanding balance"
          value={money(summary.outstanding_balance, currency)}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Subscription details
            </h2>

            <p className="mt-1 text-slate-600">
              Status:{" "}
              <span className="font-semibold capitalize">
                {subscription.status}
              </span>
            </p>
          </div>

          {!subscription.service_fee_paid &&
            Number(summary.pending_invoices || 0) === 0 && (
              <button
                type="button"
                onClick={createInitialInvoice}
                disabled={creatingInvoice}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {creatingInvoice && (
                  <Loader2 className="animate-spin" size={18} />
                )}
                Generate payment invoice
              </button>
            )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Detail
            label="Trial expiry"
            value={dateValue(subscription.trial_ends_at)}
          />

          <Detail
            label="Next billing date"
            value={dateValue(subscription.next_billing_date)}
          />

          <Detail
            label="Service fee status"
            value={subscription.service_fee_paid ? "Paid" : "Not paid"}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900">Invoices</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <TableHeading>Invoice</TableHeading>
                <TableHeading>Type</TableHeading>
                <TableHeading>Total</TableHeading>
                <TableHeading>Balance</TableHeading>
                <TableHeading>Status</TableHeading>
                <TableHeading>Due date</TableHeading>
                <TableHeading>Action</TableHeading>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data?.invoices?.length ? (
                data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <TableCell>{invoice.invoice_number}</TableCell>

                    <TableCell>{invoice.invoice_type}</TableCell>

                    <TableCell>
                      {money(invoice.total_amount, invoice.currency)}
                    </TableCell>

                    <TableCell>
                      {money(invoice.balance_due, invoice.currency)}
                    </TableCell>

                    <TableCell>
                      <Status value={invoice.status} />
                    </TableCell>

                    <TableCell>{dateValue(invoice.due_date)}</TableCell>

                    <TableCell>
                      {["pending", "overdue"].includes(invoice.status) ? (
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(invoice)}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Submit payment
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          No action
                        </span>
                      )}
                    </TableCell>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    No invoices available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900">Payments</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <TableHeading>Reference</TableHeading>
                <TableHeading>Invoice</TableHeading>
                <TableHeading>Amount</TableHeading>
                <TableHeading>Method</TableHeading>
                <TableHeading>Status</TableHeading>
                <TableHeading>Date</TableHeading>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data?.payments?.length ? (
                data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <TableCell>{payment.payment_reference}</TableCell>

                    <TableCell>{payment.invoice_number}</TableCell>

                    <TableCell>
                      {money(payment.amount, payment.currency)}
                    </TableCell>

                    <TableCell>
                      {payment.payment_method || payment.gateway}
                    </TableCell>

                    <TableCell>
                      <Status value={payment.status} />
                    </TableCell>

                    <TableCell>
                      {dateValue(payment.paid_at || payment.created_at)}
                    </TableCell>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    No payments available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          submitting={submittingPayment}
          onClose={() => setSelectedInvoice(null)}
          onSubmit={submitPayment}
        />
      )}
    </div>
  );
}

function PaymentModal({ invoice, submitting, onClose, onSubmit }) {
  const [form, setForm] = useState({
    transaction_id: "",
    payment_method: "bank_transfer",
    notes: "",
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Submit payment
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Invoice {invoice.invoice_number}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-100 p-5">
          <p className="text-sm text-slate-500">Amount due</p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {money(invoice.balance_due, invoice.currency)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Payment method
            </span>

            <select
              name="payment_method"
              value={form.payment_method}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="bank_transfer">Bank transfer</option>

              <option value="cash">Cash</option>

              <option value="mobile_money">Mobile money</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Transaction or receipt reference
            </span>

            <input
              type="text"
              name="transaction_id"
              value={form.transaction_id}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="Example: BANK-2026-001"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Notes
            </span>

            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="Optional payment details"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-4 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Send size={20} />
            )}
            Submit for approval
          </button>
        </form>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
        <Icon size={22} />
      </div>

      <p className="mt-4 text-sm text-slate-500">{label}</p>

      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>

      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Status({ value }) {
  const success = ["paid", "success", "active"].includes(value);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        success ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {success && <CheckCircle2 size={14} />}
      {value}
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
