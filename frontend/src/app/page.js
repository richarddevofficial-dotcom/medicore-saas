"use client";

import Link from "next/link";
import { Heart, Shield, Users, ArrowRight, Activity } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F3F4F6" }}>
      {/* Header */}
      <header
        className="border-b bg-white/90 backdrop-blur-sm"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#F97316" }}
              >
                <Heart className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold" style={{ color: "#1E3A5F" }}>
                MediCore
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                  style={{ color: "#374151" }}
                >
                  Sign In
                </button>
              </Link>
              <Link href="/register">
                <button
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90"
                  style={{ backgroundColor: "#F97316" }}
                >
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ color: "#1E3A5F" }}
          >
            Smart Healthcare Management with{" "}
            <span style={{ color: "#F97316" }}>MediCore</span>
          </h1>
          <p
            className="mt-6 text-lg leading-relaxed"
            style={{ color: "#6B7280" }}
          >
            Streamline your hospital operations with our comprehensive SaaS
            platform. Manage patients, appointments, billing, and more — all in
            one place.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/register">
              <button
                className="px-6 py-3 text-sm font-medium text-white rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#F97316" }}
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/login">
              <button
                className="px-6 py-3 text-sm font-medium rounded-lg border transition-colors hover:bg-gray-50"
                style={{ borderColor: "#E5E7EB", color: "#374151" }}
              >
                Sign In
              </button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Shield,
              title: "Secure & Compliant",
              desc: "HIPAA-ready with encrypted data storage and complete data isolation.",
            },
            {
              icon: Users,
              title: "Patient Management",
              desc: "Complete patient records, appointments, and medical history in one place.",
            },
            {
              icon: Activity,
              title: "Real-Time Analytics",
              desc: "Monitor hospital performance with live dashboards and reports.",
            },
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="text-center p-6 bg-white rounded-xl border"
                style={{ borderColor: "#E5E7EB" }}
              >
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "#FFF7ED" }}
                >
                  <Icon className="h-6 w-6" style={{ color: "#F97316" }} />
                </div>
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{ color: "#1E3A5F" }}
                >
                  {feature.title}
                </h3>
                <p className="text-sm" style={{ color: "#6B7280" }}>
                  {feature.desc}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
