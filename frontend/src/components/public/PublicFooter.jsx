import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 className="text-xl font-bold text-white">MediCore HMS</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            A secure cloud hospital management platform for clinical,
            administrative and financial operations.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-white">Platform</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/register">Start free trial</Link>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-white">Company</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <a href="mailto:support@medicorecloud.com">
              support@medicorecloud.com
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 py-5 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} MediCore HMS. All rights reserved.
      </div>
    </footer>
  );
}
