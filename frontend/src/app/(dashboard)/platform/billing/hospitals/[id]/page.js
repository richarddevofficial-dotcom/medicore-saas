"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

import apiClient from "@/lib/api-client";


function money(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}


function dateValue(value, includeTime = false) {
  if (!value) {
    return "Not available";
  }

  const options = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };

  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    options,
  ).format(new Date(value));
}


export default function HospitalBillingDetailPage() {
  const params = useParams();
  const hospitalId = params?.id;

  const [data, setData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [credits, setCredits] = useState([]);
  const [creditBalance, setCreditBalance] = useState("0.00");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [actionModal, setActionModal] = useState({
    open: false,
    type: "",
    title: "",
    description: "",
    confirmLabel: "Confirm",
    danger: false,
    fields: {},
  });

  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");

  const [creditType, setCreditType] = useState("credit");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditReference, setCreditReference] = useState("");

  const loadHospital = useCallback(
    async (isRefresh = false) => {
      if (!hospitalId) {
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await apiClient.get(
          `/billing-center/hospitals/${hospitalId}/`,
        );

        setData(response.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.error ||
            requestError.response?.data?.detail ||
            "Unable to load hospital billing details.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hospitalId],
  );

  const loadNotes = useCallback(async () => {
    if (!hospitalId) {
      return;
    }

    try {
      const response = await apiClient.get(
        `/billing-center/hospitals/${hospitalId}/notes/`,
      );

      setNotes(response.data?.results || []);
    } catch {
      setNotes([]);
    }
  }, [hospitalId]);

  const loadCredits = useCallback(async () => {
    if (!hospitalId) {
      return;
    }

    try {
      const response = await apiClient.get(
        `/billing-center/hospitals/${hospitalId}/credits/`,
      );

      setCredits(response.data?.results || []);
      setCreditBalance(response.data?.balance || "0.00");
    } catch {
      setCredits([]);
      setCreditBalance("0.00");
    }
  }, [hospitalId]);

  const refreshAll = useCallback(
    async (isRefresh = false) => {
      await Promise.all([
        loadHospital(isRefresh),
        loadNotes(),
        loadCredits(),
      ]);
    },
    [loadHospital, loadNotes, loadCredits],
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  async function runAction(
    actionName,
    path,
    payload = {},
    confirmation = "",
  ) {
    if (
      confirmation &&
      !window.confirm(confirmation)
    ) {
      return;
    }

    try {
      setActionLoading(actionName);
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        path,
        payload,
      );

      setSuccess(
        response.data?.message ||
          "Action completed successfully.",
      );

      await refreshAll();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.detail ||
          "Unable to complete the action.",
      );
    } finally {
      setActionLoading("");
    }
  }

  function openActionModal(type) {
    const configurations = {
      extend_trial: {
        title: "Extend Trial",
        description:
          "Choose how many additional days should be added to this hospital trial.",
        confirmLabel: "Extend Trial",
        danger: false,
        fields: {
          days: "7",
        },
      },
      end_trial: {
        title: "End Trial",
        description:
          "This will end the current trial immediately and start the configured grace period.",
        confirmLabel: "End Trial",
        danger: true,
        fields: {},
      },
      suspend: {
        title: "Suspend Subscription",
        description:
          "The hospital subscription will be suspended. Billing access will remain available.",
        confirmLabel: "Suspend Subscription",
        danger: true,
        fields: {
          reason: "",
        },
      },
      reactivate: {
        title: "Reactivate Subscription",
        description:
          "The hospital subscription will be restored to active status.",
        confirmLabel: "Reactivate",
        danger: false,
        fields: {},
      },
      change_plan: {
        title: "Change Subscription Plan",
        description:
          "Select the new subscription plan for this hospital.",
        confirmLabel: "Change Plan",
        danger: false,
        fields: {
          plan_code: "",
        },
      },
      waive_service_fee: {
        title: "Waive Service Fee",
        description:
          "The service fee will be marked as waived or paid.",
        confirmLabel: "Waive Service Fee",
        danger: false,
        fields: {
          reason: "",
        },
      },
      generate_invoice: {
        title: "Generate Invoice",
        description:
          "Choose whether to generate an initial or monthly renewal invoice.",
        confirmLabel: "Generate Invoice",
        danger: false,
        fields: {
          invoice_type: "monthly",
        },
      },
    };

    const configuration = configurations[type];

    if (!configuration) {
      return;
    }

    setActionModal({
      open: true,
      type,
      ...configuration,
    });
  }

  function closeActionModal() {
    if (actionLoading) {
      return;
    }

    setActionModal({
      open: false,
      type: "",
      title: "",
      description: "",
      confirmLabel: "Confirm",
      danger: false,
      fields: {},
    });
  }

  function updateActionModalField(name, value) {
    setActionModal((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [name]: value,
      },
    }));
  }

  async function submitActionModal(event) {
    event.preventDefault();

    const { type, fields } = actionModal;

    let actionName = type;
    let path = "";
    let payload = {};

    if (type === "extend_trial") {
      const days = Number(fields.days);

      if (!Number.isInteger(days) || days < 1 || days > 365) {
        setError(
          "Trial extension must be between 1 and 365 days.",
        );
        return;
      }

      actionName = "extend-trial";
      path =
        `/billing-center/hospitals/${hospitalId}/extend-trial/`;
      payload = { days };
    }

    if (type === "end_trial") {
      actionName = "end-trial";
      path =
        `/billing-center/hospitals/${hospitalId}/end-trial/`;
    }

    if (type === "suspend") {
      actionName = "suspend";
      path =
        `/billing-center/hospitals/${hospitalId}/suspend/`;
      payload = {
        reason: String(fields.reason || "").trim(),
      };
    }

    if (type === "reactivate") {
      actionName = "reactivate";
      path =
        `/billing-center/hospitals/${hospitalId}/reactivate/`;
    }

    if (type === "change_plan") {
      const planCode = String(
        fields.plan_code || "",
      )
        .trim()
        .toLowerCase();

      if (!planCode) {
        setError("Please select a subscription plan.");
        return;
      }

      actionName = "change-plan";
      path =
        `/billing-center/hospitals/${hospitalId}/change-plan/`;
      payload = {
        plan_code: planCode,
      };
    }

    if (type === "waive_service_fee") {
      actionName = "waive-service-fee";
      path =
        `/billing-center/hospitals/${hospitalId}/waive-service-fee/`;
      payload = {
        reason: String(fields.reason || "").trim(),
      };
    }

    if (type === "generate_invoice") {
      actionName = "generate-invoice";
      path =
        `/billing-center/hospitals/${hospitalId}/generate-invoice/`;
      payload = {
        invoice_type:
          fields.invoice_type || "monthly",
      };
    }

    if (!path) {
      setError("The selected billing action is invalid.");
      return;
    }

    try {
      setActionLoading(actionName);
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        path,
        payload,
      );

      setSuccess(
        response.data?.message ||
          "Action completed successfully.",
      );

      closeActionModal();
      await refreshAll();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.detail ||
          "Unable to complete the action.",
      );
    } finally {
      setActionLoading("");
    }
  }

  async function resendReminder(invoice) {
    await runAction(
      `reminder-${invoice.id}`,
      `/billing-center/hospitals/${hospitalId}/resend-invoice-reminder/`,
      {
        invoice_id: invoice.id,
      },
      `Resend invoice reminder for ${invoice.invoice_number}?`,
    );
  }

  async function addNote(event) {
    event.preventDefault();

    if (!noteText.trim()) {
      setError("Billing note is required.");
      return;
    }

    try {
      setActionLoading("add-note");
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        `/billing-center/hospitals/${hospitalId}/notes/`,
        {
          title: noteTitle.trim(),
          note: noteText.trim(),
        },
      );

      setSuccess(
        response.data?.message ||
          "Billing note added.",
      );

      setNoteTitle("");
      setNoteText("");

      await loadNotes();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to add billing note.",
      );
    } finally {
      setActionLoading("");
    }
  }

  async function addCredit(event) {
    event.preventDefault();

    if (
      !creditAmount ||
      Number(creditAmount) <= 0
    ) {
      setError(
        "Credit or debit amount must be greater than zero.",
      );
      return;
    }

    if (!creditReason.trim()) {
      setError("Credit reason is required.");
      return;
    }

    try {
      setActionLoading("add-credit");
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        `/billing-center/hospitals/${hospitalId}/credits/`,
        {
          entry_type: creditType,
          amount: creditAmount,
          reason: creditReason.trim(),
          reference: creditReference.trim(),
        },
      );

      setSuccess(
        response.data?.message ||
          "Credit entry recorded.",
      );

      setCreditAmount("");
      setCreditReason("");
      setCreditReference("");

      await loadCredits();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to record credit entry.",
      );
    } finally {
      setActionLoading("");
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
            Loading hospital billing details...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "Hospital billing record was not found."}
        </div>
      </div>
    );
  }

  const hospital = data.hospital || {};
  const subscription = data.subscription;
  const usage = data.usage || {};
  const summary = data.summary || {};

  const currency =
    subscription?.currency ||
    hospital.currency ||
    "USD";

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <Link
            href="/platform/billing/hospitals"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={17} />
            Back to Hospitals
          </Link>

          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
            Hospital Billing Management
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {hospital.name}
          </h1>

          <p className="mt-2 text-slate-600">
            {hospital.slug}
            {hospital.country
              ? ` • ${hospital.country}`
              : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => refreshAll(true)}
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

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={Wallet}
          label="Outstanding balance"
          value={money(
            summary.outstanding_balance,
            currency,
          )}
        />

        <MetricCard
          icon={CheckCircle2}
          label="Total paid"
          value={money(
            summary.total_paid,
            currency,
          )}
        />

        <MetricCard
          icon={FileText}
          label="Pending invoices"
          value={summary.pending_invoices || 0}
        />

        <MetricCard
          icon={AlertTriangle}
          label="Overdue invoices"
          value={summary.overdue_invoices || 0}
        />

        <MetricCard
          icon={CreditCard}
          label="Pending payments"
          value={summary.pending_payments || 0}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Subscription
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Current plan and billing status.
              </p>
            </div>

            <StatusBadge
              value={
                subscription?.status ||
                "not_configured"
              }
            />
          </div>

          {subscription ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
                label="Plan"
                value={subscription.plan?.name}
              />

              <DetailItem
                label="Monthly price"
                value={money(
                  subscription.monthly_price,
                  currency,
                )}
              />

              <DetailItem
                label="Service fee"
                value={money(
                  subscription.service_fee,
                  currency,
                )}
              />

              <DetailItem
                label="Service fee paid"
                value={
                  subscription.service_fee_paid
                    ? "Yes"
                    : "No"
                }
              />

              <DetailItem
                label="Trial ends"
                value={dateValue(
                  subscription.trial_ends_at,
                )}
              />

              <DetailItem
                label="Next billing"
                value={dateValue(
                  subscription.next_billing_date,
                )}
              />

              <DetailItem
                label="Grace ends"
                value={dateValue(
                  subscription.grace_period_ends_at,
                )}
              />

              <DetailItem
                label="Auto renew"
                value={
                  subscription.auto_renew
                    ? "Enabled"
                    : "Disabled"
                }
              />
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
              This hospital does not have a configured subscription.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Usage
          </h2>

          <div className="mt-6 space-y-5">
            <UsageBar
              icon={Users}
              label="Staff"
              used={usage.staff?.used || 0}
              limit={usage.staff?.limit}
            />

            <UsageBar
              icon={Building2}
              label="Patients"
              used={usage.patients?.used || 0}
              limit={usage.patients?.limit}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Subscription Actions
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Manage the hospital subscription, trial, plan and invoices.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <ActionButton
            label="Extend Trial"
            loading={actionLoading === "extend-trial"}
            onClick={() =>
              openActionModal("extend_trial")
            }
          />

          <ActionButton
            label="End Trial"
            danger
            loading={actionLoading === "end-trial"}
            onClick={() =>
              openActionModal("end_trial")
            }
          />

          <ActionButton
            label="Suspend"
            danger
            loading={actionLoading === "suspend"}
            onClick={() =>
              openActionModal("suspend")
            }
          />

          <ActionButton
            label="Reactivate"
            success
            loading={actionLoading === "reactivate"}
            onClick={() =>
              openActionModal("reactivate")
            }
          />

          <ActionButton
            label="Change Plan"
            loading={actionLoading === "change-plan"}
            onClick={() =>
              openActionModal("change_plan")
            }
          />

          <ActionButton
            label="Waive Service Fee"
            loading={
              actionLoading === "waive-service-fee"
            }
            onClick={() =>
              openActionModal("waive_service_fee")
            }
          />

          <ActionButton
            label="Generate Invoice"
            loading={
              actionLoading === "generate-invoice"
            }
            onClick={() =>
              openActionModal("generate_invoice")
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title="Invoices"
          subtitle="Latest hospital billing invoices."
        />

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <TableHeader>Invoice</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Total</TableHeader>
                <TableHeader>Balance</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Due date</TableHeader>
                <TableHeader>Action</TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data.invoices?.map((invoice) => (
                <tr key={invoice.id}>
                  <TableCell>
                    <span className="font-semibold text-slate-900">
                      {invoice.invoice_number}
                    </span>
                  </TableCell>

                  <TableCell>
                    {String(
                      invoice.invoice_type || "",
                    ).replaceAll("_", " ")}
                  </TableCell>

                  <TableCell>
                    {money(
                      invoice.total_amount,
                      invoice.currency,
                    )}
                  </TableCell>

                  <TableCell>
                    {money(
                      invoice.balance_due,
                      invoice.currency,
                    )}
                  </TableCell>

                  <TableCell>
                    <StatusBadge
                      value={invoice.status}
                    />
                  </TableCell>

                  <TableCell>
                    {dateValue(invoice.due_date)}
                  </TableCell>

                  <TableCell>
                    {invoice.status !== "paid" && (
                      <button
                        type="button"
                        onClick={() =>
                          resendReminder(invoice)
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Resend reminder
                      </button>
                    )}
                  </TableCell>
                </tr>
              ))}

              {!data.invoices?.length && (
                <EmptyTableRow
                  colSpan={7}
                  message="No invoices available."
                />
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title="Payments"
          subtitle="Payment submissions and approvals."
        />

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <TableHeader>Reference</TableHeader>
                <TableHeader>Invoice</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Method</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Date</TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data.payments?.map((payment) => (
                <tr key={payment.id}>
                  <TableCell>
                    <span className="font-semibold text-slate-900">
                      {payment.payment_reference}
                    </span>
                  </TableCell>

                  <TableCell>
                    {payment.invoice_number}
                  </TableCell>

                  <TableCell>
                    {money(
                      payment.amount,
                      payment.currency,
                    )}
                  </TableCell>

                  <TableCell>
                    {String(
                      payment.payment_method || "",
                    ).replaceAll("_", " ")}
                  </TableCell>

                  <TableCell>
                    <StatusBadge
                      value={payment.status}
                    />
                  </TableCell>

                  <TableCell>
                    {dateValue(
                      payment.paid_at ||
                        payment.created_at,
                      true,
                    )}
                  </TableCell>
                </tr>
              ))}

              {!data.payments?.length && (
                <EmptyTableRow
                  colSpan={6}
                  message="No payments available."
                />
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <MessageSquareText className="text-orange-500" />

            <h2 className="text-xl font-bold text-slate-900">
              Billing Notes
            </h2>
          </div>

          <form
            onSubmit={addNote}
            className="mt-5 space-y-3"
          >
            <input
              value={noteTitle}
              onChange={(event) =>
                setNoteTitle(event.target.value)
              }
              placeholder="Note title"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />

            <textarea
              value={noteText}
              onChange={(event) =>
                setNoteText(event.target.value)
              }
              placeholder="Write an internal billing note..."
              rows={4}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />

            <button
              type="submit"
              disabled={
                actionLoading === "add-note"
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {actionLoading === "add-note" ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Plus size={17} />
              )}
              Add Note
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl bg-slate-50 p-4"
              >
                <p className="font-semibold text-slate-900">
                  {note.title || "Billing note"}
                </p>

                <p className="mt-2 text-sm text-slate-700">
                  {note.note}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  {note.author?.email ||
                    "Unknown author"}{" "}
                  • {dateValue(note.created_at, true)}
                </p>
              </div>
            ))}

            {!notes.length && (
              <p className="text-sm text-slate-500">
                No billing notes.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Wallet className="text-orange-500" />

              <h2 className="text-xl font-bold text-slate-900">
                Credits and Debits
              </h2>
            </div>

            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
              Balance: {money(creditBalance, currency)}
            </span>
          </div>

          <form
            onSubmit={addCredit}
            className="mt-5 space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={creditType}
                onChange={(event) =>
                  setCreditType(event.target.value)
                }
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                <option value="credit">
                  Credit
                </option>

                <option value="debit">
                  Debit
                </option>
              </select>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={creditAmount}
                onChange={(event) =>
                  setCreditAmount(event.target.value)
                }
                placeholder="Amount"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <input
              value={creditReason}
              onChange={(event) =>
                setCreditReason(event.target.value)
              }
              placeholder="Reason"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />

            <input
              value={creditReference}
              onChange={(event) =>
                setCreditReference(
                  event.target.value,
                )
              }
              placeholder="Reference, optional"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />

            <button
              type="submit"
              disabled={
                actionLoading === "add-credit"
              }
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {actionLoading === "add-credit" ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Plus size={17} />
              )}
              Record Entry
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {credits.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-4"
              >
                <div>
                  <p className="font-semibold capitalize text-slate-900">
                    {entry.entry_type}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {entry.reason}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {dateValue(entry.created_at, true)}
                  </p>
                </div>

                <p
                  className={
                    entry.entry_type === "credit"
                      ? "font-bold text-green-600"
                      : "font-bold text-red-600"
                  }
                >
                  {entry.entry_type === "credit"
                    ? "+"
                    : "-"}
                  {money(
                    entry.amount,
                    entry.currency,
                  )}
                </p>
              </div>
            ))}

            {!credits.length && (
              <p className="text-sm text-slate-500">
                No credit entries.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Clock3 className="text-orange-500" />

          <h2 className="text-xl font-bold text-slate-900">
            Billing Timeline
          </h2>
        </div>

        <div className="mt-6 space-y-4">
          {data.timeline?.map((event, index) => (
            <div
              key={`${event.type}-${event.timestamp}-${index}`}
              className="flex gap-4"
            >
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                <ShieldCheck size={17} />
              </div>

              <div className="flex-1 rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">
                  {event.title}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {event.description}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {dateValue(event.timestamp, true)}
                </p>
              </div>
            </div>
          ))}

          {!data.timeline?.length && (
            <p className="text-sm text-slate-500">
              No billing timeline events.
            </p>
          )}
        </div>
      </section>
      <ActionModal
        modal={actionModal}
        loading={Boolean(actionLoading)}
        onClose={closeActionModal}
        onSubmit={submitActionModal}
        onFieldChange={updateActionModalField}
        currentPlanCode={
          subscription?.plan?.code || ""
        }
      />

    </div>
  );
}


function ActionModal({
  modal,
  loading,
  onClose,
  onSubmit,
  onFieldChange,
  currentPlanCode,
}) {
  if (!modal.open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {modal.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {modal.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            aria-label="Close modal"
          >
            <XCircle size={21} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="space-y-5 p-6">
            {modal.type === "extend_trial" && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Additional trial days
                </label>

                <input
                  type="number"
                  min="1"
                  max="365"
                  value={modal.fields.days || ""}
                  onChange={(event) =>
                    onFieldChange(
                      "days",
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                />
              </div>
            )}

            {modal.type === "change_plan" && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  New subscription plan
                </label>

                <select
                  value={
                    modal.fields.plan_code || ""
                  }
                  onChange={(event) =>
                    onFieldChange(
                      "plan_code",
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                >
                  <option value="">
                    Select plan
                  </option>

                  <option
                    value="starter"
                    disabled={
                      currentPlanCode === "starter"
                    }
                  >
                    Starter
                  </option>

                  <option
                    value="pro"
                    disabled={
                      currentPlanCode === "pro"
                    }
                  >
                    Professional
                  </option>

                  <option
                    value="enterprise"
                    disabled={
                      currentPlanCode ===
                      "enterprise"
                    }
                  >
                    Enterprise
                  </option>
                </select>
              </div>
            )}

            {modal.type === "generate_invoice" && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Invoice type
                </label>

                <select
                  value={
                    modal.fields.invoice_type ||
                    "monthly"
                  }
                  onChange={(event) =>
                    onFieldChange(
                      "invoice_type",
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                >
                  <option value="monthly">
                    Monthly renewal invoice
                  </option>

                  <option value="initial">
                    Initial subscription invoice
                  </option>
                </select>
              </div>
            )}

            {["suspend", "waive_service_fee"].includes(
              modal.type,
            ) && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Reason or internal note
                </label>

                <textarea
                  rows={4}
                  value={modal.fields.reason || ""}
                  onChange={(event) =>
                    onFieldChange(
                      "reason",
                      event.target.value,
                    )
                  }
                  placeholder="Enter the reason for this action..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            )}

            {["end_trial", "reactivate"].includes(
              modal.type,
            ) && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  modal.danger
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                Review the action carefully before confirming.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 p-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-60 ${
                modal.danger
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {loading && (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              )}

              {loading
                ? "Processing..."
                : modal.confirmLabel}
            </button>
          </div>
        </form>
      </div>
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


function DetailItem({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-semibold text-slate-900">
        {value || "Not available"}
      </p>
    </div>
  );
}


function UsageBar({
  icon: Icon,
  label,
  used,
  limit,
}) {
  const unlimited =
    limit === null ||
    limit === undefined ||
    Number(limit) === 0;

  const percentage = unlimited
    ? 0
    : Math.min(
        100,
        (Number(used || 0) / Number(limit)) * 100,
      );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-orange-500" />

          <span className="font-semibold text-slate-800">
            {label}
          </span>
        </div>

        <span className="text-sm text-slate-600">
          {used} / {unlimited ? "Unlimited" : limit}
        </span>
      </div>

      {!unlimited && (
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-orange-500"
            style={{
              width: `${percentage}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}


function ActionButton({
  label,
  onClick,
  loading,
  danger = false,
  success = false,
}) {
  let classes =
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  if (danger) {
    classes =
      "bg-red-600 text-white hover:bg-red-700";
  }

  if (success) {
    classes =
      "bg-green-600 text-white hover:bg-green-700";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60 ${classes}`}
    >
      {loading && (
        <Loader2
          size={16}
          className="animate-spin"
        />
      )}

      {label}
    </button>
  );
}


function SectionHeader({
  title,
  subtitle,
}) {
  return (
    <div className="border-b border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900">
        {title}
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {subtitle}
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


function EmptyTableRow({
  colSpan,
  message,
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-6 py-12 text-center text-sm text-slate-500"
      >
        {message}
      </td>
    </tr>
  );
}


function StatusBadge({ value }) {
  const normalized = String(
    value || "not_configured",
  ).toLowerCase();

  const classes = {
    active:
      "bg-green-100 text-green-700",
    success:
      "bg-green-100 text-green-700",
    paid:
      "bg-green-100 text-green-700",
    trial:
      "bg-blue-100 text-blue-700",
    pending:
      "bg-blue-100 text-blue-700",
    grace:
      "bg-amber-100 text-amber-700",
    overdue:
      "bg-amber-100 text-amber-700",
    suspended:
      "bg-red-100 text-red-700",
    failed:
      "bg-red-100 text-red-700",
    expired:
      "bg-slate-200 text-slate-700",
    void:
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
