"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { useSubscription } from "@/components/ui/SubscriptionGuard";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
import { Check, Crown, Building2, Users, Activity } from "lucide-react";

export default function SubscriptionPage() {
  const router = useRouter();
  const subscription = useSubscription();
  const [redirectingPlan, setRedirectingPlan] = useState("");

  const handleUpgrade = async (planId) => {
    setRedirectingPlan(planId);
    router.push(`/admin/payment?plan=${planId}`);
  };

  if (!subscription)
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">💳 Subscription Plans</h1>
          <p className="text-sm text-gray-500 mt-1">
            Current Plan:{" "}
            <Badge variant="warning">
              {subscription.subscription_plan?.toUpperCase()}
            </Badge>
            {subscription.days_left > 0 && (
              <span className="ml-2 text-orange-600">
                ({subscription.days_left} days left in trial)
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${plan.popular ? "border-2 border-orange-500 shadow-lg" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold">
                  MOST POPULAR
                </div>
              )}

              <div className="text-center mb-6">
                <Crown
                  className={`h-10 w-10 text-${plan.color}-500 mx-auto mb-2`}
                />
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">
                    ${plan.monthlyPrice.toFixed(2)}
                  </span>
                  <span className="text-gray-500">/month</span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                fullWidth
                variant={plan.popular ? "primary" : "outline"}
                disabled={
                  subscription.subscription_plan === plan.id ||
                  !!redirectingPlan
                }
                isLoading={redirectingPlan === plan.id}
                onClick={() => handleUpgrade(plan.id)}
              >
                {subscription.subscription_plan === plan.id
                  ? "Current Plan"
                  : "Upgrade"}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
