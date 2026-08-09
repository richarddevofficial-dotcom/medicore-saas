"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  Clock3,
  LogIn,
  LogOut,
  Loader2,
} from "lucide-react";
import {
  clockIn,
  clockOut,
  getMyAttendance,
  getMyAttendanceStatus,
} from "@/lib/api/my-work";

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
  const time = String(value).match(/(?:T|^)(\d{2}):(\d{2})/);
  if (!time) return "-";

  const hour = Number(time[1]);
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${time[2]} ${hour < 12 ? "AM" : "PM"}`;
}

export default function MyAttendancePage() {
  const [records, setRecords] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingAction, setUpdatingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [recordData, statusData] = await Promise.all([
        getMyAttendance(),
        getMyAttendanceStatus(),
      ]);
      setRecords(recordData);
      setAttendanceStatus(statusData);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAttendanceAction(action, actionName) {
    try {
      setUpdatingAction(actionName);
      setError("");
      setSuccess("");
      await action();
      setSuccess(
        action === clockIn ? "Clock-in recorded." : "Clock-out recorded.",
      );
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingAction("");
    }
  }

  if (loading) return <StateMessage message="Loading attendance history..." />;

  const clockInUnavailableReason = attendanceStatus?.can_clock_in
    ? ""
    : attendanceStatus?.message || "Clock-in is currently unavailable.";
  const clockOutUnavailableReason = attendanceStatus?.can_clock_out
    ? ""
    : attendanceStatus?.attendance?.clock_out
      ? "Attendance is already completed for this shift."
      : "Clock out becomes available after you clock in.";

  return (
    <div className="space-y-5">
      {error && <StateMessage message={error} error />}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Today&apos;s Arrival
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {attendanceStatus?.message}
            </p>
            {attendanceStatus?.shift && (
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                <p className="font-medium text-gray-800">
                  {attendanceStatus.shift.name}
                </p>
                <p>
                  Shift: {formatTime(attendanceStatus.shift.starts_at)} to{" "}
                  {formatTime(attendanceStatus.shift.ends_at)}
                </p>
                <p>
                  Clock-in window:{" "}
                  {formatTime(attendanceStatus.shift.clock_in_opens_at)} to{" "}
                  {formatTime(attendanceStatus.shift.clock_in_closes_at)}
                </p>
              </div>
            )}
          </div>

          <div className="max-w-sm space-y-2 sm:text-right">
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <button
                type="button"
                disabled={!attendanceStatus?.can_clock_in || updatingAction}
                onClick={() => handleAttendanceAction(clockIn, "clock-in")}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingAction === "clock-in" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <LogIn size={18} />
                )}
                Clock In
              </button>
              <button
                type="button"
                disabled={!attendanceStatus?.can_clock_out || updatingAction}
                onClick={() => handleAttendanceAction(clockOut, "clock-out")}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingAction === "clock-out" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <LogOut size={18} />
                )}
                Clock Out
              </button>
            </div>
            {(clockInUnavailableReason || clockOutUnavailableReason) && (
              <p className="text-xs leading-5 text-gray-500">
                {clockInUnavailableReason && (
                  <span className="block">
                    Clock In: {clockInUnavailableReason}
                  </span>
                )}
                {clockOutUnavailableReason && (
                  <span className="block">
                    Clock Out: {clockOutUnavailableReason}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </section>

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
    </div>
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
