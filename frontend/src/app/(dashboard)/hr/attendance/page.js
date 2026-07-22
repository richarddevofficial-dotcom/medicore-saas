"use client";

import Link from "next/link";
import { CalendarCheck, Plus } from "lucide-react";

export default function AttendancePage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track employee attendance, check-ins, and absences.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          Record Attendance
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <CalendarCheck className="mx-auto h-12 w-12 text-gray-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          No attendance records
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Attendance tracking functionality will be added here.
        </p>

        <Link
          href="/hr"
          className="mt-5 inline-flex text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          Return to HR Dashboard
        </Link>
      </div>
    </div>
  );
}
