"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { getApiError, hrApi } from "@/services/hr";

const currentYear = new Date().getFullYear();

const initialAllocationForm = {
  employee: "",
  year: String(currentYear),
};

function getEmployeeLabel(employee) {
  const name =
    employee.full_name ||
    [employee.first_name, employee.middle_name, employee.last_name]
      .filter(Boolean)
      .join(" ");

  return employee.employee_number
    ? `${employee.employee_number} — ${name}`
    : name || "Unnamed employee";
}

function formatDays(value) {
  const number = Number(value || 0);

  return number.toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export default function LeaveBalancesPage() {
  const [balances, setBalances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);

  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(currentYear));

  const [allocationModal, setAllocationModal] = useState(false);
  const [allocationForm, setAllocationForm] = useState(
    initialAllocationForm,
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const balanceParams = {
        ordering: "employee__first_name",
        is_active: true,
      };

      if (search.trim()) balanceParams.search = search.trim();
      if (employeeFilter) balanceParams.employee = employeeFilter;
      if (leaveTypeFilter) {
        balanceParams.leave_type = leaveTypeFilter;
      }
      if (yearFilter) balanceParams.year = yearFilter;

      const [balanceData, employeeData, leaveTypeData] =
        await Promise.all([
          hrApi.getLeaveBalances(balanceParams),
          hrApi.getEmployees({
            is_active: true,
            ordering: "first_name",
          }),
          hrApi.getLeaveTypes({
            is_active: true,
            ordering: "name",
          }),
        ]);

      setBalances(balanceData);
      setEmployees(employeeData);
      setLeaveTypes(leaveTypeData);
    } catch (err) {
      setError(getApiError(err, "Unable to load leave balances."));
    } finally {
      setLoading(false);
    }
  }, [
    employeeFilter,
    leaveTypeFilter,
    search,
    yearFilter,
  ]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const summary = useMemo(() => {
    return balances.reduce(
      (totals, balance) => {
        totals.entitlement += Number(
          balance.total_entitlement || 0,
        );
        totals.used += Number(balance.used_days || 0);
        totals.pending += Number(balance.pending_days || 0);
        totals.available += Number(balance.available_days || 0);

        return totals;
      },
      {
        entitlement: 0,
        used: 0,
        pending: 0,
        available: 0,
      },
    );
  }, [balances]);

  function openAllocationModal() {
    setAllocationForm({
      employee: employeeFilter || "",
      year: yearFilter || String(currentYear),
    });

    setError("");
    setSuccess("");
    setAllocationModal(true);
  }

  function closeAllocationModal() {
    if (allocating) return;

    setAllocationModal(false);
    setAllocationForm(initialAllocationForm);
  }

  function updateAllocationForm(event) {
    const { name, value } = event.target;

    setAllocationForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleAllocate(event) {
    event.preventDefault();

    setAllocating(true);
    setError("");
    setSuccess("");

    try {
      const response = await hrApi.allocateLeaveBalance({
        employee: allocationForm.employee,
        year: Number(allocationForm.year),
      });

      const created = response?.created ?? 0;
      const updated = response?.updated ?? 0;

      setSuccess(
        `Leave balances allocated successfully. Created: ${created}, updated: ${updated}.`,
      );

      setEmployeeFilter(allocationForm.employee);
      setYearFilter(allocationForm.year);
      closeAllocationModal();
      await loadData();
    } catch (err) {
      setError(
        getApiError(err, "Unable to allocate leave balances."),
      );
    } finally {
      setAllocating(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setEmployeeFilter("");
    setLeaveTypeFilter("");
    setYearFilter(String(currentYear));
  }

  return (
    <div className="space-y-6 px-4 pb-8 sm:px-0">
      <header className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Leave Balances
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Allocate annual leave entitlements and monitor employee
            usage and availability.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openAllocationModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Allocate Leave
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Entitlement"
          value={`${formatDays(summary.entitlement)} days`}
          icon={CalendarRange}
        />

        <SummaryCard
          label="Used"
          value={`${formatDays(summary.used)} days`}
          icon={CalendarCheck2}
        />

        <SummaryCard
          label="Pending"
          value={`${formatDays(summary.pending)} days`}
          icon={CalendarClock}
        />

        <SummaryCard
          label="Available"
          value={`${formatDays(summary.available)} days`}
          icon={CheckCircle2}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px_150px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee or leave type..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <select
            value={employeeFilter}
            onChange={(event) =>
              setEmployeeFilter(event.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All employees</option>

            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {getEmployeeLabel(employee)}
              </option>
            ))}
          </select>

          <select
            value={leaveTypeFilter}
            onChange={(event) =>
              setLeaveTypeFilter(event.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">All leave types</option>

            {leaveTypes.map((leaveType) => (
              <option key={leaveType.id} value={leaveType.id}>
                {leaveType.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            min="2000"
            max="2100"
            placeholder="Year"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : balances.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <UserRound className="h-12 w-12 text-gray-300" />

            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              No leave balances found
            </h2>

            <p className="mt-1 max-w-md text-sm text-gray-500">
              Allocate leave balances to an employee for the selected
              year.
            </p>

            <button
              type="button"
              onClick={openAllocationModal}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Allocate Leave
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Employee",
                    "Leave Type",
                    "Year",
                    "Allocated",
                    "Carried",
                    "Adjustment",
                    "Entitlement",
                    "Used",
                    "Pending",
                    "Remaining",
                    "Available",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {balances.map((balance) => (
                  <tr
                    key={balance.id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {balance.employee_name || "Employee"}
                      </p>

                      <p className="mt-0.5 text-xs text-gray-500">
                        {balance.employee_number || "—"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-800">
                      {balance.leave_type_name || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                      {balance.year}
                    </td>

                    <DaysCell value={balance.allocated_days} />
                    <DaysCell value={balance.carried_forward_days} />
                    <DaysCell value={balance.adjustment_days} />
                    <DaysCell
                      value={balance.total_entitlement}
                      emphasized
                    />
                    <DaysCell value={balance.used_days} />
                    <DaysCell value={balance.pending_days} />
                    <DaysCell value={balance.remaining_days} />
                    <DaysCell
                      value={balance.available_days}
                      positive
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {allocationModal && (
        <Modal
          title="Allocate Leave Balances"
          onClose={closeAllocationModal}
        >
          <form onSubmit={handleAllocate} className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
              This operation creates or updates balances for every
              active leave type using each leave type&apos;s configured
              days allowed.
            </div>

            <FormField label="Employee" required>
              <select
                name="employee"
                value={allocationForm.employee}
                onChange={updateAllocationForm}
                required
                className="input-field"
              >
                <option value="">Select employee</option>

                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {getEmployeeLabel(employee)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Allocation year" required>
              <input
                type="number"
                name="year"
                value={allocationForm.year}
                onChange={updateAllocationForm}
                min="2000"
                max="2100"
                required
                className="input-field"
              />
            </FormField>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={closeAllocationModal}
                disabled={allocating}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={allocating}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {allocating && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                Allocate Balances
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style jsx global>{`
        .input-field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(209 213 219);
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }

        .input-field:focus {
          border-color: rgb(249 115 22);
          box-shadow: 0 0 0 2px rgb(255 237 213);
        }
      `}</style>
    </div>
  );
}

function DaysCell({
  value,
  emphasized = false,
  positive = false,
}) {
  return (
    <td className="whitespace-nowrap px-4 py-4">
      <span
        className={`text-sm ${
          emphasized
            ? "font-bold text-gray-900"
            : positive
              ? "font-bold text-green-700"
              : "font-medium text-gray-700"
        }`}
      >
        {formatDays(value)}
      </span>
    </td>
  );
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      {children}
    </label>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
