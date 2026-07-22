"use client";

import {
  Briefcase,
  CalendarCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  UserRoundPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    icon: Briefcase,
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

export default function HRLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">
            Human Resources
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage employees, attendance, leave, contracts and positions.
          </p>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1">
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
                className={`flex min-w-max items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Icon size={17} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
