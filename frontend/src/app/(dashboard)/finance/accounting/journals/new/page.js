"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createJournalEntry, getChartOfAccounts } from "@/lib/api/finance";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function NewJournalEntryPage() {
  const router = useRouter();
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

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      const data = await getChartOfAccounts({ is_active: true });
      setAccounts(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      toast.error("Failed to load accounts");
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
      await createJournalEntry({
        reference_number: formData.reference_number,
        description: formData.description,
        entry_date: formData.entry_date,
        journal_lines: formData.lines.map((line) => ({
          account: line.account,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
          description: line.description,
        })),
      });
      toast.success("Journal entry created successfully");
      router.push("/finance/accounting/journals");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create journal entry",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading accounts...
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Link
        href="/finance/accounting/journals"
        className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Journal Entries
      </Link>

      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          New Journal Entry
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            {/* Reference Number */}
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
                placeholder="e.g., JE-2024-001"
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

            {/* Date */}
            <div>
              <label
                htmlFor="entry_date"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Entry Date
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

          {/* Description */}
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
              placeholder="Detailed description of the transaction..."
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Journal Lines
            </h3>
            {errors.lines && (
              <p className="text-red-600 text-sm mb-3">{errors.lines}</p>
            )}
            {errors.balance && (
              <p className="text-red-600 text-sm mb-3">{errors.balance}</p>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Account
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Debit (SSP)
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Credit (SSP)
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Description
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formData.lines.map((line, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <select
                          value={line.account}
                          onChange={(e) =>
                            handleLineChange(index, "account", e.target.value)
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Account</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_number} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit}
                          onChange={(e) =>
                            handleLineChange(
                              index,
                              "debit",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit}
                          onChange={(e) =>
                            handleLineChange(
                              index,
                              "credit",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
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
                          placeholder="Line description"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          disabled={formData.lines.length <= 1}
                          className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-right">Total:</td>
                    <td className="px-4 py-3 text-right">
                      SSP{" "}
                      {totalDebit.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      SSP{" "}
                      {totalCredit.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={18} />
                Add Line
              </button>
            </div>
          </div>

          {/* Balance Status */}
          <div
            className={`p-4 rounded-lg ${isBalanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
          >
            {isBalanced ? (
              <p>✓ Journal entry is balanced</p>
            ) : (
              <p>
                ✗ Journal entry is not balanced (Difference: SSP{" "}
                {(totalDebit - totalCredit).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
                )
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t">
            <Link href="/finance/accounting/journals">
              <button
                type="button"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={submitting || !isBalanced}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
