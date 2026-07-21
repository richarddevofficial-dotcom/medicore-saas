import {
  CalendarClock,
  CalendarX2,
  FileWarning,
  UserCheck,
  Users,
  UserRoundCog,
} from "lucide-react";
import type { HRDashboard } from "@/types/hr";

interface Props {
  dashboard: HRDashboard;
}

export default function HRDashboardCards({ dashboard }: Props) {
  const cards = [
    {
      title: "Total Employees",
      value: dashboard.total_employees,
      icon: Users,
    },
    {
      title: "Active Employees",
      value: dashboard.active_employees,
      icon: UserCheck,
    },
    {
      title: "On Leave",
      value: dashboard.employees_on_leave,
      icon: CalendarClock,
    },
    {
      title: "Pending Leave",
      value: dashboard.pending_leave_requests,
      icon: UserRoundCog,
    },
    {
      title: "Absent Today",
      value: dashboard.absent_today,
      icon: CalendarX2,
    },
    {
      title: "Expiring Contracts",
      value: dashboard.contracts_expiring_soon,
      icon: FileWarning,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className="rounded-xl border bg-white p-5 shadow-sm"
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

              <div className="rounded-xl bg-orange-50 p-3">
                <Icon className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
