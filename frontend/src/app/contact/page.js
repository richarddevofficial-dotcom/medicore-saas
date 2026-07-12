import PublicLayout from "@/components/public/PublicLayout";

export default function ContactPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="text-4xl font-bold">Contact MediCore</h1>
        <p className="mt-4 text-lg text-slate-600">
          Speak with our team about onboarding, pricing and hospital
          implementation.
        </p>

        <div className="mt-10 rounded-2xl border border-slate-200 p-8 shadow-sm">
          <p>
            <strong>Email:</strong> support@medicorecloud.com
          </p>
          <p className="mt-3">
            <strong>Location:</strong> Juba, South Sudan
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
