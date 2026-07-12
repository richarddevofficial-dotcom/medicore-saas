import Link from "next/link";
import {
  Activity,
  Building2,
  CalendarDays,
  FlaskConical,
  Pill,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import PublicLayout from "@/components/public/PublicLayout";

const features = [
  {
    icon: Users,
    title: "Patient Management",
    description:
      "Register patients, manage medical histories and coordinate care across departments.",
  },
  {
    icon: CalendarDays,
    title: "Appointments",
    description:
      "Manage doctor schedules, consultations, queues and follow-up visits.",
  },
  {
    icon: FlaskConical,
    title: "Laboratory",
    description:
      "Handle test requests, samples, results, verification and laboratory billing.",
  },
  {
    icon: Pill,
    title: "Pharmacy",
    description:
      "Control medicine inventory, prescriptions, dispensing, sales and expiry alerts.",
  },
  {
    icon: WalletCards,
    title: "Billing and Finance",
    description:
      "Manage bills, payments, receipts, insurance claims and financial reports.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Multi-Tenancy",
    description:
      "Each hospital receives an isolated workspace, users, records and branded subdomain.",
  },
];

export default function HomePage() {
  return (
    <PublicLayout>
      <section className="overflow-hidden bg-slate-950">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">
              <Activity size={16} />
              Cloud hospital management platform
            </div>

            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Run your hospital from one secure platform
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              MediCore HMS connects reception, doctors, laboratory, pharmacy,
              imaging, billing, finance and management in one multi-tenant
              cloud system.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/register"
                className="rounded-xl bg-orange-500 px-7 py-3.5 text-center font-semibold text-white transition hover:bg-orange-600"
              >
                Start your free trial
              </Link>

              <Link
                href="/features"
                className="rounded-xl border border-slate-600 px-7 py-3.5 text-center font-semibold text-white transition hover:border-slate-400"
              >
                Explore features
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Patients", "2,486"],
                ["Appointments", "138"],
                ["Available beds", "42"],
                ["Monthly revenue", "$28,450"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-700 bg-slate-800 p-5"
                >
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800 p-6">
              <Building2 className="text-orange-400" size={34} />
              <h2 className="mt-4 text-xl font-bold text-white">
                A dedicated workspace for every hospital
              </h2>
              <p className="mt-2 text-slate-400">
                Example: nilecare.medicorecloud.com
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-semibold uppercase tracking-widest text-orange-500">
            Complete hospital operations
          </p>
          <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
            Everything your hospital needs
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Replace disconnected spreadsheets and manual processes with one
            integrated platform.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Icon size={24} />
              </div>
              <h3 className="mt-5 text-xl font-bold">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-14 text-center sm:px-12">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to digitize your hospital?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
              Create your hospital account, receive your secure workspace and
              begin your free trial.
            </p>

            <Link
              href="/register"
              className="mt-8 inline-block rounded-xl bg-orange-500 px-8 py-4 font-semibold text-white hover:bg-orange-600"
            >
              Register your hospital
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
