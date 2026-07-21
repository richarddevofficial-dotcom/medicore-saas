"use client";

import {
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  UserRoundPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  {
    name: "Dashboard",
    href: "/hr",
    icon: LayoutDashboard,
  },
  {
    name: "Employees",
    href: "/hr/employees",
    icon: Users,
  },
  {
    name: "Add Employee",
    href: "/hr/employees/new",
    icon: UserRoundPlus,
  },
  {
    name: "Positions",
    href: "/hr/positions",
    icon: BriefcaseBusiness,
  },
  {
    name: "Contracts",
    href: "/hr/contracts",
    icon: FileText,
  },
  {
    name: "Attendance",
    href: "/hr/attendance",
    icon: CalendarCheck,
  },
  {
    name: "Leave Requests",
    href: "/hr/leave-requests",
    icon: ClipboardList,
  },
];

export default function HRLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Human Resources
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employees, contracts, attendance and leave.
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <aside className="w-full shrink-0 lg:w-64">
          <nav className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/hr"
                  ? pathname === "/hr"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-orange-50 text-orange-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
