"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 font-bold text-white">
            M
          </div>

          <div>
            <p className="font-bold text-slate-900">MediCore HMS</p>
            <p className="text-xs text-slate-500">Hospital Management SaaS</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-orange-500"
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/login"
            className="text-sm font-semibold text-slate-700 hover:text-orange-500"
          >
            Sign in
          </Link>

          <Link
            href="/register"
            className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Start free trial
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"
          aria-label="Toggle navigation"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-5 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="font-medium text-slate-700"
              >
                {link.label}
              </Link>
            ))}

            <Link href="/login" onClick={() => setOpen(false)}>
              Sign in
            </Link>

            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-orange-500 px-4 py-3 text-center font-semibold text-white"
            >
              Start free trial
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
