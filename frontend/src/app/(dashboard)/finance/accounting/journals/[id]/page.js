"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Send,
  Undo2,
  Lock,
  Loader2,
} from "lucide-react";
import {
  getJournalEntry,
  voidJournalEntry,
  reverseJournalEntry,
  postJournalEntry,
} from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useParams, useRouter } from "next/navigation";

export default function JournalEntryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const entryId = params.id;

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    loadEntry();
  }, [entryId]);

  async function loadEntry() {
    try {
      setLoading(true);
      setError("");
      const data = await getJournalEntry(entryId);
      setEntry(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load journal entry",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVoid(e) {
    e.preventDefault();
    if (!voidReason.trim()) {
      toast.error("Please provide a reason for voiding");
      return;
    }

    try {
      setUpdating(true);
      await voidJournalEntry(entryId, { reason: voidReason });
      toast.success("Journal entry voided successfully");
      setShowVoidModal(false);
      await loadEntry();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to void journal entry",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handlePost() {
    if (
      !confirm(
        "Are you sure you want to post this journal entry? This cannot be undone.",
      )
    )
      return;

    try {
      setUpdating(true);
      await postJournalEntry(entryId);
      toast.success("Journal entry posted successfully");
      await loadEntry();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post journal entry",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleReverse() {
    if (!confirm("Are you sure you want to reverse this journal entry?"))
      return;

    try {
      setUpdating(true);
      await reverseJournalEntry(entryId);
      toast.success("Journal entry reversed successfully");
      await loadEntry();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reverse journal entry",
      );
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading journal entry...
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="space-y-6">
        <Link
          href="/finance/accounting/journals"
          className="flex items-center text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Journal Entries
        </Link>
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Unable to load entry</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalDebit =
    entry.journal_lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
  const totalCredit =
    entry.journal_lines?.reduce((sum, line) => sum + (line.credit || 0), 0) ||
    0;

  return (
    <div className="space-y-6">
      <Link
        href="/finance/accounting/journals"
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Journal Entries
      </Link>

      {/* Entry Header */}
      <div className="rounded-lg border bg-white p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {entry.reference_number}
            </h1>
            <p className="mt-2 text-gray-600">{entry.description}</p>
          </div>
          <span
            className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
              entry.status === "POSTED"
                ? "bg-green-100 text-green-700"
                : entry.status === "VOIDED"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {entry.status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-600">Entry Date</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(entry.entry_date).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Created</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(entry.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Posted</p>
            <p className="text-lg font-semibold text-gray-900">
              {entry.posted_date
                ? new Date(entry.posted_date).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </div>

        {/* Journal Lines Table */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Account
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Debit (SSP)
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Credit (SSP)
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entry.journal_lines?.map((line) => (
                <tr key={line.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <p className="font-medium">{line.account_name}</p>
                      <p className="text-xs text-gray-600">
                        {line.account_number}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    {line.debit > 0
                      ? `SSP ${line.debit.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    {line.credit > 0
                      ? `SSP ${line.credit.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {line.description}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-6 py-3 text-right">Total:</td>
                <td className="px-6 py-3 text-right">
                  SSP{" "}
                  {totalDebit.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-6 py-3 text-right">
                  SSP{" "}
                  {totalCredit.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          {entry.status === "DRAFT" && (
            <>
              <Link href={`/finance/accounting/journals/${entry.id}/edit`}>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                  Edit Entry
                </button>
              </Link>
              <button
                onClick={handlePost}
                disabled={updating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={18} />
                Post Entry
              </button>
            </>
          )}
          {entry.status === "POSTED" && (
            <>
              <button
                onClick={handleReverse}
                disabled={updating}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Undo2 size={18} />
                Reverse Entry
              </button>
              <button
                onClick={() => setShowVoidModal(true)}
                disabled={updating}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Lock size={18} />
                Void Entry
              </button>
            </>
          )}
        </div>
      </div>

      {/* Void Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Void Journal Entry
            </h2>
            <p className="text-gray-600 mb-4">
              Please provide a reason for voiding this journal entry.
            </p>
            <form onSubmit={handleVoid}>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason for voiding..."
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowVoidModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {updating ? "Voiding..." : "Void Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
