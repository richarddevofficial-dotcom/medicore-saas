import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FlaskConical,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
  WalletCards,
} from "lucide-react";
import PublicLayout from "@/components/public/PublicLayout";

const features = [
  {
    icon: Users,
    title: "Patient Management",
    description: "One patient record from registration through discharge.",
  },
  {
    icon: CalendarDays,
    title: "Appointments & Queues",
    description:
      "Coordinate schedules, walk-ins, consultations and follow-ups.",
  },
  {
    icon: FlaskConical,
    title: "Laboratory",
    description:
      "Move requests, samples, verified results and charges in one flow.",
  },
  {
    icon: Pill,
    title: "Pharmacy",
    description: "Connect prescriptions, stock, dispensing and expiry alerts.",
  },
  {
    icon: WalletCards,
    title: "Billing & Finance",
    description:
      "Collect payments, issue receipts and keep financial reporting current.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Workspaces",
    description: "Give each hospital an isolated workspace, users and records.",
  },
];

const carePath = [
  { icon: ClipboardList, label: "Register", detail: "Patient intake" },
  { icon: CircleDollarSign, label: "Collect", detail: "Service payment" },
  { icon: Stethoscope, label: "Consult", detail: "Clinical care" },
  { icon: FlaskConical, label: "Coordinate", detail: "Lab & pharmacy" },
];

function HeroWorkspace() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:mr-0">
      <div className="border border-slate-700 bg-slate-900 p-3 shadow-2xl sm:p-5">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-orange-500 text-white">
              <Activity size={19} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Today&apos;s care desk
              </p>
              <p className="text-xs text-slate-400">
                Example hospital workspace
              </p>
            </div>
          </div>
          <span className="border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            System online
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.25fr_0.75fr]">
          <div className="border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  Waiting now
                </p>
                <p className="mt-1 text-3xl font-bold text-white">18</p>
              </div>
              <Users className="text-orange-400" size={25} />
            </div>
            <div className="mt-4 space-y-2">
              {[
                ["A. John", "General consultation", "09:40"],
                ["M. Ajak", "Lab review", "10:00"],
                ["R. Deng", "Follow-up", "10:20"],
              ].map(([name, visit, time]) => (
                <div
                  key={name}
                  className="flex items-center justify-between border-t border-slate-700 pt-2"
                >
                  <div>
                    <p className="text-xs font-medium text-slate-200">{name}</p>
                    <p className="text-[11px] text-slate-400">{visit}</p>
                  </div>
                  <span className="text-xs text-orange-300">{time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="border border-slate-700 bg-slate-800 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">
                Beds available
              </p>
              <p className="mt-1 text-2xl font-bold text-white">42</p>
              <p className="mt-2 text-xs text-emerald-300">
                +4 since yesterday
              </p>
            </div>
            <div className="border border-slate-700 bg-orange-500 p-4">
              <p className="text-xs font-medium uppercase text-orange-100">
                Payments today
              </p>
              <p className="mt-1 text-2xl font-bold text-white">SSP 3,240</p>
              <p className="mt-2 text-xs text-orange-100">24 receipts issued</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 border border-slate-700 bg-slate-800 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-sky-400/10 text-sky-300">
            <FlaskConical size={18} />
          </div>
          <p className="text-xs leading-5 text-slate-300">
            <span className="font-semibold text-white">
              7 results awaiting verification.
            </span>{" "}
            Send verified results directly to the patient record.
          </p>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 hidden border border-slate-700 bg-slate-800 px-4 py-3 shadow-xl sm:block">
        <p className="text-xs text-slate-400">One workspace for every team</p>
        <p className="mt-1 text-sm font-semibold text-white">
          Reception to finance, connected
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PublicLayout>
      <section className="overflow-hidden bg-slate-950">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pt-20 lg:grid-cols-[0.94fr_1.06fr] lg:px-8 lg:pb-24 lg:pt-24">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold uppercase text-orange-300">
              <Activity size={15} />
              Cloud hospital management
            </div>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              MediCore HMS
            </h1>
            <p className="mt-4 max-w-xl text-2xl font-semibold leading-snug text-slate-200 sm:text-3xl">
              The operational command center for modern hospitals.
            </p>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Bring reception, clinicians, diagnostics, pharmacy and finance
              into one connected system built for the pace of patient care.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-orange-500 px-6 py-3.5 font-semibold text-white transition hover:bg-orange-600"
              >
                Start your free trial
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center justify-center border border-slate-600 px-6 py-3.5 font-semibold text-white transition hover:border-slate-300 hover:bg-slate-800"
              >
                Explore features
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-300">
              {[
                "No credit card required",
                "Secure hospital workspace",
                "Role-based access",
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-400" size={16} />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <HeroWorkspace />
        </div>
      </section>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {carePath.map(({ icon: Icon, label, detail }, index) => (
              <div
                key={label}
                className="flex items-center gap-4 lg:border-r lg:border-slate-200 lg:px-6 lg:first:pl-0 lg:last:border-r-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-orange-100 text-orange-600">
                  <Icon size={19} />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">
                    0{index + 1}
                  </p>
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="text-sm text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.74fr_1.26fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-orange-600">
              Complete hospital operations
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
              Every department, working from the same source of truth.
            </h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            Remove spreadsheet handoffs and disconnected systems. MediCore keeps
            clinical activity, patient movement and payments visible to the
            teams responsible for each next step.
          </p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="group bg-white p-7 transition hover:bg-orange-50"
            >
              <div className="flex h-11 w-11 items-center justify-center bg-slate-900 text-white transition group-hover:bg-orange-500">
                <Icon size={21} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-orange-500">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase text-orange-100">
              Ready when your team is
            </p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Give your hospital one clear way to run every day.
            </h2>
          </div>
          <Link
            href="/register"
            className="inline-flex shrink-0 items-center justify-center gap-2 bg-slate-950 px-6 py-3.5 font-semibold text-white transition hover:bg-slate-800"
          >
            Register your hospital
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
