"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarDays, Clock3 } from "lucide-react";

const navigation = [
  { name: "My Shift", href: "/my-work/shifts", icon: Clock3 },
  {
    name: "My Attendance",
    href: "/my-work/attendance",
    icon: CalendarCheck,
  },
  { name: "My Leave", href: "/my-work/leave", icon: CalendarDays },
];

export default function MyWorkLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">My Work</h1>
        <p className="mt-1 text-sm text-gray-500">
          View your schedule, attendance, and leave records.
        </p>
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-3">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-max items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-orange-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon size={17} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
