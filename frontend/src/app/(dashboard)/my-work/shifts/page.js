"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Clock3 } from "lucide-react";
import { getMyShifts } from "@/lib/api/my-work";

function formatDate(value) {
  if (!value) return "Ongoing";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value) {
  if (!value) return "-";
  const [hours, minutes] = value.split(":");
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, Number(hours), Number(minutes)));
}

export default function MyShiftsPage() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyShifts()
      .then(setShifts)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <StateMessage message="Loading your shift schedule..." />;
  }

  if (error) {
    return <StateMessage message={error} error />;
  }

  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="border-b p-5">
        <h2 className="font-semibold text-gray-900">Shift Schedule</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your current and previous shift assignments.
        </p>
      </div>
      {shifts.length === 0 ? (
        <StateMessage message="No shift has been assigned to you." />
      ) : (
        <div className="divide-y">
          {shifts.map((assignment) => (
            <article
              key={assignment.id}
              className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-orange-50 p-2 text-orange-600">
                  <Clock3 size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {assignment.shift_name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatTime(assignment.shift_start_time)} to{" "}
                    {formatTime(assignment.shift_end_time)}
                  </p>
                  {assignment.notes && (
                    <p className="mt-2 text-sm text-gray-500">
                      {assignment.notes}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600 sm:text-right">
                <p>{formatDate(assignment.start_date)}</p>
                <p className="mt-1">to {formatDate(assignment.end_date)}</p>
              </div>
            </article>
          ))}
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
