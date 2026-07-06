export const SUBSCRIPTION_PLANS = [
  {
    id: "basic",
    name: "Basic",
    monthlyPrice: 99.9,
    maxStaff: 10,
    maxPatients: 1000,
    features: [
      "Up to 10 Staff",
      "Up to 1,000 Patients",
      "All Core Features",
      "Email Support",
    ],
    color: "blue",
    popular: false,
  },
  {
    id: "pro",
    name: "Professional",
    monthlyPrice: 149.9,
    maxStaff: 25,
    maxPatients: 5000,
    features: [
      "Up to 25 Staff",
      "Up to 5,000 Patients",
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
    monthlyPrice: 249.9,
    maxStaff: 100,
    maxPatients: 999999,
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
