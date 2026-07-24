"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  PieChart,
  DollarSign,
} from "lucide-react";

export default function FinanceReportsPage() {
  const reports = [
    {
      id: "income-statement",
      title: "Income Statement",
      description: "Revenue, expenses, and net profit analysis",
      icon: TrendingUp,
      href: "/finance/reports/income-statement",
      color: "blue",
    },
    {
      id: "balance-sheet",
      title: "Balance Sheet",
      description: "Assets, liabilities, and equity snapshot",
      icon: BarChart3,
      href: "/finance/reports/balance-sheet",
      color: "green",
    },
    {
      id: "trial-balance",
      title: "Trial Balance",
      description: "Account balances and verification",
      icon: PieChart,
      href: "/finance/reports/trial-balance",
      color: "purple",
    },
    {
      id: "general-ledger",
      title: "General Ledger",
      description: "Transaction details by account",
      icon: DollarSign,
      href: "/finance/reports/general-ledger",
      color: "orange",
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/finance"
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Finance
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
        <p className="mt-2 text-gray-600">
          View comprehensive financial statements and reports
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          const colorClasses = {
            blue: "bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-300",
            green:
              "bg-green-50 text-green-600 border-green-200 hover:border-green-300",
            purple:
              "bg-purple-50 text-purple-600 border-purple-200 hover:border-purple-300",
            orange:
              "bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-300",
          };

          return (
            <Link key={report.id} href={report.href}>
              <div
                className={`p-6 rounded-lg border cursor-pointer transition-all hover:shadow-lg ${colorClasses[report.color]}`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-white">
                    <Icon size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {report.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {report.description}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
