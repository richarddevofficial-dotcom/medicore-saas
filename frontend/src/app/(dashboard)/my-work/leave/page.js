"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CalendarDays, Loader2, Send } from "lucide-react";
import {
  createMyLeaveRequest,
  getMyLeaveBalances,
  getMyLeaveRequests,
  getMyLeaveTypes,
} from "@/lib/api/my-work";

const emptyForm = {
  leave_type: "",
  start_date: "",
  end_date: "",
  reason: "",
  supporting_document: null,
};

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default function MyLeavePage() {
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [requestData, balanceData, typeData] = await Promise.all([
        getMyLeaveRequests(),
        getMyLeaveBalances(),
        getMyLeaveTypes(),
      ]);
      setRequests(requestData);
      setBalances(balanceData);
      setLeaveTypes(typeData);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateForm(event) {
    const { name, value, files } = event.target;
    setForm((current) => ({
      ...current,
      [name]: files ? files[0] || null : value,
    }));
  }

  async function submitRequest(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const payload = new FormData();
      payload.append("leave_type", form.leave_type);
      payload.append("start_date", form.start_date);
      payload.append("end_date", form.end_date);
      payload.append("reason", form.reason.trim());
      if (form.supporting_document) {
        payload.append("supporting_document", form.supporting_document);
      }
      await createMyLeaveRequest(payload);
      setForm(emptyForm);
      setSuccess("Leave request submitted for HR review.");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <StateMessage message="Loading your leave information..." />;
  }

  return (
    <div className="space-y-6">
      {error && <StateMessage message={error} error />}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-gray-900">Leave Balances</h2>
        {balances.length === 0 ? (
          <StateMessage message="No active leave balance is available." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {balances.map((balance) => (
              <article
                key={balance.id}
                className="rounded-lg border bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-gray-500">
                  {balance.leave_type_name}
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {balance.available_days}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  days available of {balance.total_entitlement}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2 text-orange-600">
              <Send size={19} />
            </div>
            <h2 className="font-semibold text-gray-900">Request Leave</h2>
          </div>
          <form className="space-y-4" onSubmit={submitRequest}>
            <label className="block text-sm font-medium text-gray-700">
              Leave type
              <select
                name="leave_type"
                value={form.leave_type}
                onChange={updateForm}
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal"
              >
                <option value="">Select leave type</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Start date
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={updateForm}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                End date
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  min={form.start_date}
                  onChange={updateForm}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal"
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Reason
              <textarea
                name="reason"
                value={form.reason}
                onChange={updateForm}
                required
                rows={4}
                className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Supporting document
              <input
                type="file"
                name="supporting_document"
                onChange={updateForm}
                className="mt-1 block w-full text-sm font-normal text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || leaveTypes.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Send size={17} />
              )}
              Submit request
            </button>
          </form>
        </section>

        <section className="rounded-lg border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="font-semibold text-gray-900">Request History</h2>
          </div>
          {requests.length === 0 ? (
            <StateMessage message="You have not submitted a leave request." />
          ) : (
            <div className="divide-y">
              {requests.map((request) => (
                <article key={request.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {request.leave_type_name}
                      </h3>
                      <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                        <CalendarDays size={15} />
                        {formatDate(request.start_date)} to{" "}
                        {formatDate(request.end_date)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        statusStyles[request.status] || statusStyles.PENDING
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">{request.reason}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {request.total_days} day(s)
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StateMessage({ message, error = false }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-5 text-sm ${
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
