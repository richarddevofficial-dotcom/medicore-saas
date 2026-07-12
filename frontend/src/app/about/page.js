import PublicLayout from "@/components/public/PublicLayout";

export default function AboutPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <h1 className="text-4xl font-bold">About MediCore HMS</h1>

        <div className="mt-8 space-y-6 text-lg leading-8 text-slate-600">
          <p>
            MediCore HMS is a cloud-based hospital management platform designed
            to help healthcare facilities manage patient care, clinical
            workflows, inventory, billing and administration.
          </p>

          <p>
            Every hospital receives a secure tenant workspace with its own
            users, records, configuration and branded subdomain.
          </p>

          <p>
            Our objective is to make hospital technology easier to deploy,
            operate and scale across South Sudan and the wider region.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
