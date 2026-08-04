export const SUBSCRIPTION_PLANS = [
  {
    id: "basic",
    name: "Basic",
    monthlyPrice: 49.9,
    maxStaff: 20,
    maxPatients: 2000,
    features: [
      "Up to 20 Staff",
      "Up to 2,000 Patients",
      "All Core Features",
      "Email Support",
    ],
    color: "blue",
    popular: false,
  },
  {
    id: "pro",
    name: "Professional",
    monthlyPrice: 89.9,
    maxStaff: 100,
    maxPatients: 20000,
    features: [
      "Up to 100 Staff",
      "Up to 20,000 Patients",
      "Advanced Reports",
      "Priority Support",
      "Custom Branding",
    ],
    color: "orange",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 129.9,
    maxStaff: null,
    maxPatients: null,
    features: [
      "Unlimited Staff",
      "Unlimited Patients",
      "All Features",
      "Dedicated Support",
      "API Access",
      "Custom Development",
    ],
    color: "purple",
    popular: false,
  },
];

export const SUBSCRIPTION_PLAN_MAP = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((plan) => [plan.id, plan]),
);
