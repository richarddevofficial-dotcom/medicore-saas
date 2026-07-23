"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Wallet,
  DollarSign,
} from "lucide-react";
import {
  getFinanceDashboard,
  getBudgets,
  getExpenses,
  getPayroll,
} from "@/lib/api/finance";

export default function FinanceDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        // Fetch dashboard aggregated data
        const dashboardData = await getFinanceDashboard();

        // Process data: Calculate totals from arrays
        const totalBudget =
          dashboardData.budgets?.results?.reduce(
            (sum, b) => sum + (parseFloat(b.allocated_amount) || 0),
            0,
          ) || 0;

        const totalExpenses =
          dashboardData.expenses?.results?.reduce(
            (sum, e) => sum + (parseFloat(e.amount) || 0),
            0,
          ) || 0;

        const budgetVariance = totalBudget - totalExpenses;

        const totalPayroll =
          dashboardData.salarySlips?.results?.reduce(
            (sum, s) => sum + (parseFloat(s.net_salary) || 0),
            0,
          ) || 0;

        // Get recent transactions from salary slips and expenses
        const recentTransactions = [
          ...(dashboardData.salarySlips?.results?.slice(0, 3) || []).map(
            (slip) => ({
              id: slip.id,
              description: `Payroll - Employee ${slip.employee_id}`,
              date: slip.created_at,
              amount: `SSP ${parseFloat(slip.net_salary).toFixed(2)}`,
            }),
          ),
          ...(dashboardData.expenses?.results?.slice(0, 2) || []).map(
            (exp) => ({
              id: exp.id,
              description: exp.description || "Expense",
              date: exp.created_at,
              amount: `SSP ${parseFloat(exp.amount).toFixed(2)}`,
            }),
          ),
        ]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);

        setDashboard({
          total_budget: `SSP ${totalBudget.toFixed(2)}`,
          total_expenses: `SSP ${totalExpenses.toFixed(2)}`,
          budget_variance: `SSP ${budgetVariance.toFixed(2)}`,
          payroll_cost: `SSP ${totalPayroll.toFixed(2)}`,
          recent_transactions: recentTransactions,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load Finance dashboard.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading Finance dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        <AlertCircle className="mt-0.5" size={20} />

        <div>
          <h2 className="font-semibold">Unable to load dashboard</h2>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Manage budgets, expenses, and payroll
        </p>
      </div>

      {/* Finance Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/finance/budgets" className="block">
          <div className="rounded-lg border bg-white p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {dashboard?.total_budget || "SSP 0"}
                </p>
              </div>
              <Wallet className="text-blue-500" size={24} />
            </div>
          </div>
        </Link>

        <Link href="/finance/expenses" className="block">
          <div className="rounded-lg border bg-white p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {dashboard?.total_expenses || "SSP 0"}
                </p>
              </div>
              <DollarSign className="text-red-500" size={24} />
            </div>
          </div>
        </Link>

        <Link href="/finance/budgets" className="block">
          <div className="rounded-lg border bg-white p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Budget Variance</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {dashboard?.budget_variance || "SSP 0"}
                </p>
              </div>
              <BarChart3 className="text-green-500" size={24} />
            </div>
          </div>
        </Link>

        <Link href="/finance/payroll" className="block">
          <div className="rounded-lg border bg-white p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Payroll Cost</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {dashboard?.payroll_cost || "SSP 0"}
                </p>
              </div>
              <TrendingUp className="text-orange-500" size={24} />
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/finance/budgets">
          <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-blue-100 p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h3 className="font-semibold text-gray-900">Budgets</h3>
            <p className="mt-1 text-sm text-gray-600">Plan and track budgets</p>
            <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
              View All <ArrowRight size={16} className="ml-2" />
            </div>
          </div>
        </Link>

        <Link href="/finance/expenses">
          <div className="rounded-lg border bg-gradient-to-br from-red-50 to-red-100 p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h3 className="font-semibold text-gray-900">Expenses</h3>
            <p className="mt-1 text-sm text-gray-600">
              Track and manage expenses
            </p>
            <div className="mt-4 flex items-center text-red-600 text-sm font-medium">
              View All <ArrowRight size={16} className="ml-2" />
            </div>
          </div>
        </Link>

        <Link href="/finance/payroll">
          <div className="rounded-lg border bg-gradient-to-br from-green-50 to-green-100 p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h3 className="font-semibold text-gray-900">Payroll</h3>
            <p className="mt-1 text-sm text-gray-600">
              Manage employee payroll
            </p>
            <div className="mt-4 flex items-center text-green-600 text-sm font-medium">
              View All <ArrowRight size={16} className="ml-2" />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      {dashboard?.recent_transactions && (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Transactions
          </h2>
          <div className="mt-4 divide-y">
            {dashboard.recent_transactions.length > 0 ? (
              dashboard.recent_transactions.map((transaction) => (
                <div key={transaction.id} className="flex justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {transaction.description}
                    </p>
                    <p className="text-sm text-gray-600">{transaction.date}</p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {transaction.amount}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-3 text-center text-gray-500">
                No transactions yet
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
