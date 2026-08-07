import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "14-day free trial with full MediCore access.",
    features: [
      "14 days of full access",
      "No payment required",
      "Choose a paid plan after trial",
    ],
  },
  {
    name: "Basic",
    price: "$49.90 / month",
    description: "For clinics and small medical centres.",
    features: [
      "Core patient management",
      "Up to 20 staff accounts",
      "Up to 2,000 patients",
    ],
  },
  {
    name: "Professional",
    price: "$89.90 / month",
    description: "For growing hospitals with multiple departments.",
    features: [
      "All clinical modules",
      "Pharmacy and laboratory",
      "Advanced reports",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "$129.90 / month",
    description: "For large hospitals and hospital groups.",
    features: [
      "All MediCore modules",
      "Custom limits",
      "Dedicated onboarding",
      "Enterprise support",
    ],
  },
];

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="px-4 py-20 text-center">
        <h1 className="text-4xl font-bold">Simple hospital pricing</h1>

        <p className="mt-4 text-lg text-slate-600">
          Start with a free trial and choose the plan that fits your facility.
        </p>

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className="rounded-2xl border border-slate-200 p-7 text-left shadow-sm"
            >
              <h2 className="text-2xl font-bold">{plan.name}</h2>

              <p className="mt-2 text-lg font-semibold text-orange-600">
                {plan.price}
              </p>

              <p className="mt-3 text-slate-600">{plan.description}</p>

              <ul className="mt-6 space-y-3 text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>

              <Link
                href="/register"
                className="mt-8 block rounded-lg bg-orange-500 px-5 py-3 text-center font-semibold text-white"
              >
                Start free trial
              </Link>
            </article>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
