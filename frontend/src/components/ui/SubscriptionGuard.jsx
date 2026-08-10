"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

const planLimits = {
  trial: { maxStaff: 20, maxPatients: 2000 },
  basic: { maxStaff: 20, maxPatients: 2000 },
  starter: { maxStaff: 20, maxPatients: 2000 },
  pro: { maxStaff: 100, maxPatients: 20000 },
  enterprise: { maxStaff: null, maxPatients: null },
};

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/hospitals/my_hospital/")
      .then((res) => {
        setSubscription(
          res.data || {
            subscription_plan: "none",
            days_left: 0,
          },
        );
      })
      .catch(() => {
        // Default to a basic object even if API fails
        setSubscription({
          subscription_plan: "none",
          days_left: 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return loading ? null : subscription;
}

export function checkLimit(subscription, type, currentCount) {
  if (!subscription) return { allowed: true };

  const plan = subscription.subscription_plan || "trial";
  const limits = planLimits[plan];

  if (
    type === "staff" &&
    limits.maxStaff !== null &&
    currentCount >= limits.maxStaff
  ) {
    return {
      allowed: false,
      message: `Staff limit reached (${limits.maxStaff}). Upgrade your plan.`,
    };
  }
  if (
    type === "patients" &&
    limits.maxPatients !== null &&
    currentCount >= limits.maxPatients
  ) {
    return {
      allowed: false,
      message: `Patient limit reached (${limits.maxPatients}). Upgrade your plan.`,
    };
  }

  return { allowed: true };
}

export default function SubscriptionGuard({ children }) {
  const router = useRouter();
  const subscription = useSubscription();

  if (!subscription) return null;

  if (
    subscription.days_left <= 0 &&
    subscription.subscription_plan === "trial"
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Trial Expired
          </h2>
          <p className="text-gray-500 mb-4">
            Your 14-day free trial has ended. Upgrade to continue using MediCore
            HMS.
          </p>
          <Button onClick={() => router.push("/settings/billing/plans")}>
            Upgrade Now
          </Button>
        </Card>
      </div>
    );
  }

  return children;
}
