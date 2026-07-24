"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Plus, Trash2, Edit, Eye } from "lucide-react";
import {
  getJournalEntries,
  deleteJournalEntry,
  postJournalEntry,
} from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      setLoading(true);
      setError("");

      const data = await getJournalEntries();
      setEntries(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load journal entries.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this journal entry?")) return;

    try {
      setUpdating(id);
      await deleteJournalEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Journal entry deleted successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete journal entry",
      );
    } finally {
      setUpdating(null);
    }
  }

  async function handlePost(id) {
    try {
      setUpdating(id);
      await postJournalEntry(id);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "POSTED" } : e)),
      );
      toast.success("Journal entry posted successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post journal entry",
      );
    } finally {
      setUpdating(null);
    }
  }

  const filteredEntries =
    filterStatus === "all"
      ? entries
      : entries.filter(
          (e) => e.status?.toUpperCase() === filterStatus.toUpperCase(),
        );

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading journal entries...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/finance"
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Finance
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Journal Entries</h1>
          <p className="mt-2 text-gray-600">
            Record and manage general ledger transactions
          </p>
        </div>
        <Link href="/finance/accounting/journals/new">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <Plus size={18} />
            New Entry
          </button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Unable to load entries</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-4 py-2 font-medium transition-colors ${
            filterStatus === "all"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          All ({entries.length})
        </button>
        <button
          onClick={() => setFilterStatus("DRAFT")}
          className={`px-4 py-2 font-medium transition-colors ${
            filterStatus === "DRAFT"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Draft ({entries.filter((e) => e.status === "DRAFT").length})
        </button>
        <button
          onClick={() => setFilterStatus("POSTED")}
          className={`px-4 py-2 font-medium transition-colors ${
            filterStatus === "POSTED"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Posted ({entries.filter((e) => e.status === "POSTED").length})
        </button>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
          <p className="text-gray-600">No journal entries found</p>
          <Link href="/finance/accounting/journals/new">
            <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
              Create your first entry
            </button>
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Total Debit
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Total Credit
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">
                    {entry.reference_number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {entry.description}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(entry.entry_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    SSP {entry.total_debit?.toLocaleString() || "0"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    SSP {entry.total_credit?.toLocaleString() || "0"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        entry.status === "POSTED"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/finance/accounting/journals/${entry.id}`}>
                        <button
                          disabled={updating === entry.id}
                          className="p-1.5 text-gray-600 hover:text-blue-600 disabled:opacity-50"
                        >
                          <Eye size={18} />
                        </button>
                      </Link>
                      {entry.status === "DRAFT" && (
                        <>
                          <Link
                            href={`/finance/accounting/journals/${entry.id}/edit`}
                          >
                            <button
                              disabled={updating === entry.id}
                              className="p-1.5 text-gray-600 hover:text-blue-600 disabled:opacity-50"
                            >
                              <Edit size={18} />
                            </button>
                          </Link>
                          <button
                            onClick={() => handlePost(entry.id)}
                            disabled={updating === entry.id}
                            className="p-1.5 text-gray-600 hover:text-green-600 disabled:opacity-50"
                            title="Post this entry"
                          >
                            <Check size={18} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={
                          updating === entry.id || entry.status === "POSTED"
                        }
                        className="p-1.5 text-gray-600 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Import Check icon
import { Check } from "lucide-react";
