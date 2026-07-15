"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import apiClient from "@/lib/api-client";


function money(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}


function limitLabel(value, singular, plural) {
  if (
    value === null ||
    value === undefined ||
    Number(value) === 0
  ) {
    return `Unlimited ${plural}`;
  }

  const numericValue = Number(value);

  return `${numericValue.toLocaleString()} ${
    numericValue === 1 ? singular : plural
  }`;
}


export default function BillingPlansPage() {
  const router = useRouter();

  const [currentPlan, setCurrentPlan] =
    useState(null);

  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadPlans() {
    try {
      setLoading(true);
      setError("");

      const response = await apiClient.get(
        "/saas-billing/plan-changes/",
      );

      setCurrentPlan(
        response.data?.current_plan || null,
      );

      setPlans(response.data?.plans || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to load subscription plans.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  async function submitPlanChange() {
    if (!selectedPlan) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response = await apiClient.post(
        "/saas-billing/plan-changes/request/",
        {
          plan_code: selectedPlan.code,
        },
      );

      const message =
        response.data?.message ||
        "Plan-change request completed.";

      setSuccess(message);

      window.setTimeout(() => {
        router.push("/settings/billing");
        router.refresh();
      }, 1200);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to change the subscription plan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={42}
            className="mx-auto animate-spin text-orange-500"
          />

          <p className="mt-4 text-sm text-slate-500">
            Loading subscription plans...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <Link
            href="/settings/billing"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={17} />
            Back to Billing
          </Link>

          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
            MediCore Subscription
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Upgrade or Downgrade Plan
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Compare available subscription plans and
            select the plan that best fits your hospital.
          </p>
        </div>

        {currentPlan && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
              Current Plan
            </p>

            <p className="mt-1 text-xl font-bold text-slate-900">
              {currentPlan.name}
            </p>

            <p className="mt-1 text-sm text-slate-600">
              {money(
                currentPlan.monthly_price,
                currentPlan.currency || "USD",
              )}{" "}
              per month
            </p>
          </div>
        )}
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-green-700">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
          />

          <p className="text-sm">{success}</p>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent =
            plan.change_type === "current" ||
            currentPlan?.code === plan.code;

          const isSelected =
            selectedPlan?.code === plan.code;

          const canChange =
            plan.allowed && !isCurrent;

          return (
            <article
              key={plan.code}
              className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition ${
                isSelected
                  ? "border-orange-500 ring-2 ring-orange-100"
                  : isCurrent
                    ? "border-slate-900"
                    : "border-slate-200 hover:border-orange-300 hover:shadow-md"
              }`}
            >
              {isCurrent && (
                <div className="absolute right-5 top-5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  Current
                </div>
              )}

              {plan.change_type === "upgrade" &&
                !isCurrent && (
                  <div className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                    <Sparkles size={13} />
                    Upgrade
                  </div>
                )}

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                {plan.code === "enterprise" ? (
                  <ShieldCheck size={24} />
                ) : (
                  <Users size={24} />
                )}
              </div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">
                {plan.name}
              </h2>

              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
                {plan.description ||
                  "MediCore hospital management subscription plan."}
              </p>

              <div className="mt-6">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-900">
                    {money(
                      plan.monthly_price,
                      plan.currency,
                    )}
                  </span>

                  <span className="pb-1 text-sm text-slate-500">
                    / month
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-600">
                  Annual service fee:{" "}
                  <span className="font-semibold text-slate-900">
                    {money(
                      plan.service_fee,
                      plan.currency,
                    )}
                  </span>
                </p>
              </div>

              <div className="my-6 border-t border-slate-200" />

              <div className="flex-1 space-y-3">
                <FeatureItem
                  label={limitLabel(
                    plan.max_staff,
                    "staff member",
                    "staff members",
                  )}
                />

                <FeatureItem
                  label={limitLabel(
                    plan.max_patients,
                    "patient",
                    "patients",
                  )}
                />

                {Number(plan.storage_gb || 0) > 0 && (
                  <FeatureItem
                    label={`${Number(
                      plan.storage_gb,
                    ).toLocaleString()} GB storage`}
                  />
                )}

                {Array.isArray(plan.features) &&
                  plan.features.map(
                    (feature, index) => (
                      <FeatureItem
                        key={`${plan.code}-${index}`}
                        label={
                          typeof feature === "string"
                            ? feature
                            : feature?.name ||
                              feature?.label ||
                              "Included feature"
                        }
                      />
                    ),
                  )}
              </div>

              {!plan.allowed &&
                !isCurrent &&
                plan.reason && (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-amber-600"
                      />

                      <p className="text-sm leading-6 text-amber-800">
                        {plan.reason}
                      </p>
                    </div>
                  </div>
                )}

              <button
                type="button"
                disabled={!canChange}
                onClick={() =>
                  setSelectedPlan(plan)
                }
                className={`mt-6 w-full rounded-xl px-4 py-3 font-semibold transition ${
                  isCurrent
                    ? "cursor-not-allowed bg-slate-100 text-slate-500"
                    : !plan.allowed
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : isSelected
                        ? "bg-orange-500 text-white hover:bg-orange-600"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {isCurrent
                  ? "Current Plan"
                  : !plan.allowed
                    ? "Unavailable"
                    : isSelected
                      ? "Selected"
                      : plan.change_type ===
                          "downgrade"
                        ? "Select Downgrade"
                        : "Select Upgrade"}
              </button>
            </article>
          );
        })}
      </section>

      {!plans.length && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          No active subscription plans are available.
        </div>
      )}

      {selectedPlan && (
        <section className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-400">
                Confirm Plan Change
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                {currentPlan?.name || "Current Plan"}
                {" → "}
                {selectedPlan.name}
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                {selectedPlan.change_type ===
                "downgrade"
                  ? "The downgrade will be processed according to the billing rules configured by MediCore."
                  : "An adjustment invoice may be generated. The new plan will activate after the required payment is approved."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  setSelectedPlan(null)
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <X size={18} />
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={submitPlanChange}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Check size={18} />
                )}

                {submitting
                  ? "Processing..."
                  : "Confirm Change"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}


function FeatureItem({ label }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
        <Check size={13} />
      </div>

      <span className="text-sm text-slate-700">
        {label}
      </span>
    </div>
  );
}
