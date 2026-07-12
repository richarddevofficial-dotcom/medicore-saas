import PublicLayout from "@/components/public/PublicLayout";

const modules = [
  "Patient registration and medical records",
  "Outpatient and inpatient management",
  "Doctor scheduling and queues",
  "Laboratory management",
  "Pharmacy and medicine inventory",
  "Imaging and radiology",
  "Billing, cashier and receipts",
  "Insurance management",
  "Rooms, wards and beds",
  "Human resources and staff",
  "Finance and management reports",
  "Audit logs and role-based permissions",
];

export default function FeaturesPage() {
  return (
    <PublicLayout>
      <section className="bg-slate-950 px-4 py-20 text-center text-white">
        <h1 className="text-4xl font-bold">MediCore HMS Features</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
          Integrated modules for clinical, administrative and financial
          hospital operations.
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
        {modules.map((module) => (
          <div
            key={module}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="font-semibold text-slate-900">{module}</h2>
          </div>
        ))}
      </section>
    </PublicLayout>
  );
}
