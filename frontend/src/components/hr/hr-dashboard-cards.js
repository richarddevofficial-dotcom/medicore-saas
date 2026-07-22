"use client";

import {
  Briefcase,
  CalendarCheck,
  UserCheck,
  Users,
} from "lucide-react";

export default function HRDashboardCards({ dashboard }) {
  const cards = [
    {
      title: "Total Employees",
      value:
        dashboard?.total_employees ??
        dashboard?.employees ??
        0,
      icon: Users,
    },
    {
      title: "Active Employees",
      value:
        dashboard?.active_employees ??
        dashboard?.active ??
        0,
      icon: UserCheck,
    },
    {
      title: "Employees on Leave",
      value:
        dashboard?.employees_on_leave ??
        dashboard?.on_leave ??
        0,
      icon: CalendarCheck,
    },
    {
      title: "Positions",
      value:
        dashboard?.total_positions ??
        dashboard?.positions ??
        dashboard?.departments ??
        0,
      icon: Briefcase,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className="rounded-xl border bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {card.title}
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {card.value}
                </p>
              </div>

              <div className="rounded-xl bg-orange-100 p-3 text-orange-600">
                <Icon size={24} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
