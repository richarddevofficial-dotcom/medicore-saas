"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  getJournalEntry,
  updateJournalEntry,
  getChartOfAccounts,
} from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useRouter, useParams } from "next/navigation";

export default function EditJournalEntryPage() {
  const router = useRouter();
  const params = useParams();
  const journalId = params.id;

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    reference_number: "",
    description: "",
    entry_date: new Date().toISOString().split("T")[0],
    lines: [{ account: "", debit: 0, credit: 0, description: "" }],
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    loadAccounts();
    loadJournalEntry();
  }, [journalId]);

  async function loadAccounts() {
    try {
      const data = await getChartOfAccounts({ is_active: true });
      setAccounts(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      toast.error("Failed to load accounts");
    }
  }

  async function loadJournalEntry() {
    try {
      setLoading(true);
      setError("");
      const data = await getJournalEntry(journalId);
      setFormData({
        reference_number: data.reference_number || "",
        description: data.description || "",
        entry_date: data.entry_date || new Date().toISOString().split("T")[0],
        lines: data.lines || [
          { account: "", debit: 0, credit: 0, description: "" },
        ],
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load journal entry",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleLineChange(index, field, value) {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData((prev) => ({
      ...prev,
      lines: newLines,
    }));
  }

  function addLine() {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        { account: "", debit: 0, credit: 0, description: "" },
      ],
    }));
  }

  function removeLine(index) {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  }

  const totalDebit = formData.lines.reduce(
    (sum, line) => sum + (parseFloat(line.debit) || 0),
    0,
  );
  const totalCredit = formData.lines.reduce(
    (sum, line) => sum + (parseFloat(line.credit) || 0),
    0,
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  async function handleSubmit(e) {
    e.preventDefault();

    // Validation
    const newErrors = {};
    if (!formData.reference_number.trim())
      newErrors.reference_number = "Reference number is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (formData.lines.length < 2)
      newErrors.lines = "At least 2 line items are required";
    if (!isBalanced)
      newErrors.balance = "Total debits must equal total credits";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
      await updateJournalEntry(journalId, formData);
      toast.success("Journal entry updated successfully");
      router.push("/finance/accounting/journals");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update journal entry",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading journal entry...
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <Link
        href="/finance/accounting/journals"
        className="flex items-center text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Journal Entries
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Edit Journal Entry
        </h1>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reference Number and Description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="reference_number"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Reference Number *
              </label>
              <input
                type="text"
                id="reference_number"
                name="reference_number"
                value={formData.reference_number}
                onChange={handleChange}
                placeholder="e.g., JE-001"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.reference_number ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.reference_number && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.reference_number}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="entry_date"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Entry Date *
              </label>
              <input
                type="date"
                id="entry_date"
                name="entry_date"
                value={formData.entry_date}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter journal entry description..."
              rows="2"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.description && (
              <p className="text-red-600 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Journal Lines */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Journal Lines *
              </label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus size={16} />
                Add Line
              </button>
            </div>

            {errors.lines && (
              <p className="text-red-600 text-sm mb-2">{errors.lines}</p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Account
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Debit
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Credit
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Description
                    </th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formData.lines.map((line, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">
                        <select
                          value={line.account}
                          onChange={(e) =>
                            handleLineChange(index, "account", e.target.value)
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select account</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_number} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) =>
                            handleLineChange(index, "debit", e.target.value)
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) =>
                            handleLineChange(index, "credit", e.target.value)
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) =>
                            handleLineChange(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          placeholder="Description"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        {formData.lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t font-medium">
                  <tr>
                    <td className="px-4 py-2 text-right text-gray-700">
                      Total:
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {totalDebit.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {totalCredit.toFixed(2)}
                    </td>
                    <td colSpan="2" className="px-4 py-2">
                      {!isBalanced && (
                        <span className="text-red-600 text-sm">
                          Unbalanced: {(totalDebit - totalCredit).toFixed(2)}
                        </span>
                      )}
                      {isBalanced && (
                        <span className="text-green-600 text-sm">
                          ✓ Balanced
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {errors.balance && (
              <p className="text-red-600 text-sm mt-2">{errors.balance}</p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {submitting ? "Updating..." : "Update Journal Entry"}
            </button>
            <Link href="/finance/accounting/journals">
              <button
                type="button"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
