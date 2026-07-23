"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Plus, Trash2, Edit } from "lucide-react";
import { getBudgets, deleteBudget } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadBudgets();
  }, []);

  async function loadBudgets() {
    try {
      setLoading(true);
      setError("");

      const data = await getBudgets();
      setBudgets(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load budgets.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this budget?")) return;

    try {
      setDeleting(id);
      await deleteBudget(id);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      toast.success("Budget deleted successfully");
      await loadBudgets();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete budget",
      );
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading budgets...
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
          <h1 className="text-3xl font-bold text-gray-900">Budgets</h1>
          <p className="mt-2 text-gray-600">
            Manage department and project budgets
          </p>
        </div>
        <Link href="/finance/budgets/new">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <Plus size={18} />
            New Budget
          </button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Unable to load budgets</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {budgets.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
          <p className="text-gray-600">No budgets created yet</p>
          <Link href="/finance/budgets/new">
            <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
              Create your first budget
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className="rounded-lg border bg-white p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{budget.name}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {budget.description}
                  </p>
                  <div className="mt-3 flex gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Allocated</p>
                      <p className="font-semibold text-gray-900">
                        {budget.allocated_amount || "SSP 0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Spent</p>
                      <p className="font-semibold text-gray-900">
                        {budget.spent_amount || "SSP 0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Remaining</p>
                      <p className="font-semibold text-green-600">
                        {budget.remaining_amount || "SSP 0"}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{
                        width: `${budget.percentage_used || 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Link href={`/finance/budgets/${budget.id}/edit`}>
                    <button className="p-2 text-gray-600 hover:text-blue-600">
                      <Edit size={18} />
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    disabled={deleting === budget.id}
                    className="p-2 text-gray-600 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
