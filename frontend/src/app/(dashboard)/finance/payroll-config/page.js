"use client";

import Link from "next/link";
import {
  Settings,
  DollarSign,
  Calendar,
  Briefcase,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

export default function PayrollConfigPage() {
  const configOptions = [
    {
      icon: Briefcase,
      title: "Salary Structures",
      description: "Define salary structures with allowances and deductions",
      href: "/finance/payroll-config/structures",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      iconColor: "text-blue-600",
    },
    {
      icon: DollarSign,
      title: "Allowance Types",
      description: "Create and manage salary allowance components",
      href: "/finance/payroll-config/allowances",
      color: "bg-green-50 text-green-700 border-green-200",
      iconColor: "text-green-600",
    },
    {
      icon: Settings,
      title: "Deduction Types",
      description: "Configure salary deduction components",
      href: "/finance/payroll-config/deductions",
      color: "bg-red-50 text-red-700 border-red-200",
      iconColor: "text-red-600",
    },
    {
      icon: Calendar,
      title: "Payroll Years",
      description: "Define financial years for payroll processing",
      href: "/finance/payroll-config/payroll-years",
      color: "bg-purple-50 text-purple-700 border-purple-200",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/finance"
          className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Finance
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          Payroll Configuration
        </h1>
        <p className="mt-2 text-gray-600">
          Set up all payroll components and settings for your organization
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {configOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Link
              key={option.href}
              href={option.href}
              className={`rounded-lg border p-6 transition-all hover:shadow-lg hover:border-opacity-50 ${option.color}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={`${option.iconColor}`} size={24} />
                    <h3 className="text-lg font-semibold">{option.title}</h3>
                  </div>
                  <p className="text-sm opacity-90">{option.description}</p>
                </div>
                <ChevronRight className="mt-1" size={20} />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border bg-blue-50 border-blue-200 p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Getting Started</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-bold">1.</span>
            <span>
              Create Payroll Years first to define your financial periods
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">2.</span>
            <span>
              Define Allowance and Deduction Types available in your
              organization
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">3.</span>
            <span>
              Create Salary Structures by combining allowances and deductions
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">4.</span>
            <span>
              HR assigns employees to salary structures before payroll
              processing
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
