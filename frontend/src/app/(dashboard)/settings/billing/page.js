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
import DashboardLayout from "@/components/layout/DashboardLayout";

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
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [renewalCycle, setRenewalCycle] = useState("monthly");
  const [plans, setPlans] = useState([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState("");

  async function loadBilling() {
    try {
      setError("");
      setSubscriptionRequired(false);

      const [response, plansResponse] = await Promise.all([
        apiClient.get("/saas-billing/dashboard/"),
        apiClient.get("/saas-billing/plan-changes/"),
      ]);

      setData(response.data);
      const paidPlans = (plansResponse.data?.plans || []).filter((plan) =>
        ["basic", "pro", "enterprise"].includes(plan.code),
      );
      setPlans(paidPlans);
      setSelectedPlanCode((current) => {
        if (paidPlans.some((plan) => plan.code === current)) {
          return current;
        }
        const currentCode = plansResponse.data?.current_plan?.code;
        return paidPlans.some((plan) => plan.code === currentCode)
          ? currentCode
          : paidPlans[0]?.code || "";
      });
    } catch (requestError) {
      if (requestError.response?.data?.subscription_required) {
        setSubscriptionRequired(true);
        setError(
          requestError.response?.data?.error ||
            "Subscription not configured. Please set up a plan first.",
        );
      } else {
        setError(
          requestError.response?.data?.error ||
            "Unable to load billing information.",
        );
      }
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
        {
          plan_code: selectedPlanCode,
          billing_cycle: renewalCycle,
        },
      );

      setSuccessMessage(response.data.message);
      setSelectedInvoice(response.data.invoice || null);
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

      const payload = new FormData();
      payload.append("invoice_id", selectedInvoice.id);
      payload.append("transaction_id", form.transaction_id);
      payload.append("payment_method", form.payment_method);
      payload.append("payment_date", form.payment_date);
      payload.append("notes", form.notes);
      if (form.proof_of_payment) {
        payload.append("proof_of_payment", form.proof_of_payment);
      }

      const response = await apiClient.post(
        "/saas-billing/payments/manual/",
        payload,
      );

      setSuccessMessage(response.data.message);
      setSelectedInvoice(null);
      await loadBilling();
    } catch (requestError) {
      const responseData = requestError.response?.data;
      setError(
        responseData?.error ||
          responseData?.detail ||
          responseData?.message ||
          "Unable to submit payment.",
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

      const disposition = response.headers["content-disposition"] || "";

      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);

      const filename = filenameMatch?.[1] || fallbackFilename;

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError) {
      console.error("PDF download failed:", requestError);

      setError(
        requestError.response?.status === 401
          ? "Your session has expired. Please sign in again."
          : "Unable to download the PDF.",
      );
    }
  }

  useEffect(() => {
    loadBilling();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin text-orange-500" size={36} />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !data) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Billing and Subscription
            </h1>
            <p className="mt-2 text-slate-600">
              Manage your MediCore plan, invoices and payments.
            </p>
          </div>

          {subscriptionRequired ? (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-full bg-amber-200 p-4">
                  <AlertCircle size={32} className="text-amber-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-amber-950">
                    Subscription Required
                  </h2>
                  <p className="mt-2 text-amber-800">{error}</p>
                </div>
                <button
                  onClick={() => {
                    window.location.href = "/settings/billing/plans";
                  }}
                  className="mt-4 rounded-lg bg-amber-600 px-6 py-2 font-medium text-white hover:bg-amber-700"
                >
                  Set Up Subscription Plan
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              {error}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  const subscription = data?.subscription || {};
  const summary = data?.summary || {};
  const currency = subscription.currency || "USD";
  const payableInvoice = data?.invoices?.find((invoice) =>
    ["pending", "overdue"].includes(invoice.status),
  );
  const pendingPayment = data?.payments?.find(
    (payment) => payment.status === "pending",
  );
  const selectedPlan =
    plans.find((plan) => plan.code === selectedPlanCode) || plans[0];
  const cycleOptions = [
    {
      value: "monthly",
      label: "1 Month",
      price: selectedPlan?.monthly_price,
    },
    {
      value: "six_months",
      label: "6 Months",
      price: selectedPlan?.six_month_price,
    },
    {
      value: "annual",
      label: "12 Months",
      price: selectedPlan?.annual_price,
    },
  ];

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

      {["expired", "suspended"].includes(subscription.status) && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-bold text-red-950">
            Subscription{" "}
            {subscription.status === "suspended" ? "Suspended" : "Expired"}
          </h2>
          <p className="mt-2 text-red-800">
            Your MediCoreCloud subscription ended on{" "}
            {dateValue(subscription.end_date)}. Your hospital data remains
            securely stored. Renew to restore full access.
          </p>
        </section>
      )}

      {pendingPayment && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-bold text-blue-950">
            Payment Awaiting Verification
          </h2>
          <p className="mt-1 text-sm text-blue-800">
            Payment {pendingPayment.payment_reference} is awaiting confirmation
            by MediCoreCloud Administration.
          </p>
        </section>
      )}

      {subscription.pending_plan && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle size={22} className="mt-0.5 shrink-0 text-amber-600" />

            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                Scheduled Plan Change
              </p>

              <h2 className="mt-2 text-xl font-bold text-amber-950">
                {subscription.plan?.name ||
                  subscription.plan_name ||
                  "Current plan"}
                {" → "}
                {subscription.pending_plan.name}
              </h2>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Your current plan remains active until{" "}
                <span className="font-semibold">
                  {dateValue(subscription.pending_plan_effective_date)}
                </span>
                . The{" "}
                <span className="font-semibold">
                  {subscription.pending_plan.name}
                </span>{" "}
                plan will become active automatically on that date.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Scheduled plan
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {subscription.pending_plan.name}
                  </p>
                </div>

                <div className="rounded-xl bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Effective date
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {dateValue(subscription.pending_plan_effective_date)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
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
          value={
            subscription.status === "trial"
              ? "Free during trial"
              : money(subscription.monthly_price, currency)
          }
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

          {payableInvoice ? (
            <button
              type="button"
              onClick={() => setSelectedInvoice(payableInvoice)}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
            >
              <CreditCard size={18} />
              Make payment
            </button>
          ) : (
            Number(summary.pending_invoices || 0) === 0 && (
              <button
                type="button"
                onClick={createInitialInvoice}
                disabled={creatingInvoice || !selectedPlanCode}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {creatingInvoice && (
                  <Loader2 className="animate-spin" size={18} />
                )}
                Generate payment invoice
              </button>
            )
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Detail
            label="Trial expiry"
            value={dateValue(subscription.trial_ends_at)}
          />

          <Detail
            label="Subscription expiry"
            value={dateValue(
              subscription.end_date || subscription.next_billing_date,
            )}
          />

          <Detail
            label="Service fee status"
            value={subscription.service_fee_paid ? "Paid" : "Not paid"}
          />
        </div>

        {!payableInvoice && !pendingPayment && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-sm font-semibold text-slate-800">
              Subscription plan
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {plans.map((plan) => (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => setSelectedPlanCode(plan.code)}
                  className={`border p-4 text-left transition ${
                    selectedPlanCode === plan.code
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 bg-white hover:border-orange-300"
                  }`}
                >
                  <span className="block font-semibold text-slate-900">
                    {plan.name}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {money(plan.monthly_price, plan.currency || currency)} /
                    month
                  </span>
                  {!subscription.service_fee_paid && (
                    <span className="mt-1 block text-xs text-slate-500">
                      Setup fee:{" "}
                      {money(plan.service_fee, plan.currency || currency)}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <p className="mt-6 text-sm font-semibold text-slate-800">
              Renewal period
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {cycleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRenewalCycle(option.value)}
                  className={`border p-4 text-left transition ${
                    renewalCycle === option.value
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 bg-white hover:border-orange-300"
                  }`}
                >
                  <span className="block font-semibold text-slate-900">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {money(option.price, currency)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
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
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            downloadFile(
                              `/saas-billing/invoices/${invoice.id}/pdf/`,
                              `${invoice.invoice_number}.pdf`,
                            )
                          }
                          className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Download size={14} />
                          PDF
                        </button>

                        {["pending", "overdue"].includes(invoice.status) && (
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(invoice)}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            Submit payment
                          </button>
                        )}
                      </div>
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
                <TableHeading>Action</TableHeading>
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
                      <Status value={payment.status_label || payment.status} />
                      {payment.rejection_reason && (
                        <p className="mt-1 max-w-xs text-xs text-red-600">
                          {payment.rejection_reason}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      {dateValue(payment.paid_at || payment.created_at)}
                    </TableCell>
                    <TableCell>
                      {payment.status === "success" ? (
                        <button
                          type="button"
                          onClick={() =>
                            downloadFile(
                              `/saas-billing/payments/${payment.id}/receipt-pdf/`,
                              `receipt-${payment.payment_reference}.pdf`,
                            )
                          }
                          className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Download size={14} />
                          Receipt
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Awaiting approval
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
          bankDetails={data?.bank_details}
          submitting={submittingPayment}
          onClose={() => setSelectedInvoice(null)}
          onSubmit={submitPayment}
        />
      )}
    </div>
  );
}

function PaymentModal({ invoice, bankDetails, submitting, onClose, onSubmit }) {
  const [form, setForm] = useState({
    transaction_id: "",
    payment_method: "bank_transfer",
    payment_date: new Date().toISOString().slice(0, 10),
    proof_of_payment: null,
    notes: "",
  });

  function handleChange(event) {
    const { files, name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: files ? files[0] || null : value,
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
            </select>
          </label>

          {form.payment_method === "bank_transfer" &&
            bankDetails?.configured && (
              <div className="border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <p className="font-semibold">Bank transfer details</p>
                <p className="mt-2">{bankDetails.bank_name}</p>
                <p>{bankDetails.account_name}</p>
                <p className="font-mono">{bankDetails.account_number}</p>
                {bankDetails.swift_code && (
                  <p>SWIFT: {bankDetails.swift_code}</p>
                )}
              </div>
            )}

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Transaction or receipt reference
            </span>

            <input
              type="text"
              name="transaction_id"
              value={form.transaction_id}
              onChange={handleChange}
              required={form.payment_method === "bank_transfer"}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder={
                form.payment_method === "bank_transfer"
                  ? "Example: BANK-2026-001"
                  : "Optional for cash payments"
              }
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Payment date
            </span>
            <input
              type="date"
              name="payment_date"
              value={form.payment_date}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Proof of payment (optional)
            </span>
            <input
              type="file"
              name="proof_of_payment"
              onChange={handleChange}
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />
            <span className="mt-1 block text-xs text-slate-500">
              PDF, PNG or JPEG, up to 5 MB.
            </span>
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
  const success = ["paid", "success", "confirmed", "active"].includes(value);
  const rejected = ["failed", "rejected", "cancelled", "void"].includes(value);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        success
          ? "bg-green-100 text-green-700"
          : rejected
            ? "bg-red-100 text-red-700"
            : "bg-amber-100 text-amber-700"
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
