"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CalendarCheck, Clock3 } from "lucide-react";
import { getMyAttendance } from "@/lib/api/my-work";

const statusStyles = {
  PRESENT: "bg-green-100 text-green-700",
  ABSENT: "bg-red-100 text-red-700",
  LATE: "bg-amber-100 text-amber-700",
  HALF_DAY: "bg-blue-100 text-blue-700",
  ON_LEAVE: "bg-violet-100 text-violet-700",
  OFF_DUTY: "bg-gray-100 text-gray-700",
};

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MyAttendancePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyAttendance()
      .then(setRecords)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <StateMessage message="Loading attendance history..." />;
  if (error) return <StateMessage message={error} error />;

  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="border-b p-5">
        <h2 className="font-semibold text-gray-900">Attendance History</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your recorded attendance and clock times.
        </p>
      </div>
      {records.length === 0 ? (
        <StateMessage message="No attendance records are available." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Shift</th>
                <th className="px-5 py-3 font-medium">Clock in</th>
                <th className="px-5 py-3 font-medium">Clock out</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-900">
                    <span className="inline-flex items-center gap-2">
                      <CalendarCheck size={16} className="text-gray-400" />
                      {formatDate(record.attendance_date)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-600">
                    {record.shift_name || "-"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                    <Clock3 className="mr-1 inline" size={15} />
                    {formatTime(record.clock_in)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                    {formatTime(record.clock_out)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        statusStyles[record.status] || statusStyles.OFF_DUTY
                      }`}
                    >
                      {record.status.replaceAll("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StateMessage({ message, error = false }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-6 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "bg-white text-gray-500"
      }`}
    >
      {error && <AlertCircle size={20} />}
      {message}
    </div>
  );
}
