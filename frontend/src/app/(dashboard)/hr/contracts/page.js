"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Edit3,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { getApiError, hrApi } from "@/services/hr";

const statuses = [
  "DRAFT",
  "ACTIVE",
  "EXPIRED",
  "TERMINATED",
  "RENEWED",
];

const emptyForm = {
  employee: "",
  contract_number: "",
  start_date: "",
  end_date: "",
  probation_end_date: "",
  basic_salary: "0",
  currency: "SSP",
  working_hours_per_week: "40",
  status: "ACTIVE",
  terms: "",
  document: null,
};

const formatMoney = (value, currency) => {
  const amount = Number(value || 0);

  return `${currency || "SSP"} ${amount.toLocaleString()}`;
};

const statusClass = (status) => {
  const classes = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    DRAFT: "bg-slate-100 text-slate-700",
    EXPIRED: "bg-red-50 text-red-700",
    TERMINATED: "bg-red-50 text-red-700",
    RENEWED: "bg-blue-50 text-blue-700",
  };

  return classes[status] || classes.DRAFT;
};

const expiryLabel = (contract) => {
  const state = contract.expiry_state;

  if (state === "OPEN_ENDED") {
    return "Open-ended";
  }

  if (state === "EXPIRED") {
    return "Expired";
  }

  if (state === "EXPIRES_TODAY") {
    return "Expires today";
  }

  if (state === "EXPIRING_7_DAYS") {
    return `${contract.days_until_expiry} days left`;
  }

  if (state === "EXPIRING_30_DAYS") {
    return `${contract.days_until_expiry} days left`;
  }

  return "Valid";
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const params = {
        ordering: "-start_date",
      };

      if (statusFilter) {
        params.status = statusFilter;
      }

      if (expiryFilter) {
        params.expiry = expiryFilter;
      }

      const [contractData, employeeData] =
        await Promise.all([
          hrApi.getContracts(params),
          hrApi.getEmployees({
            ordering: "first_name",
            is_active: "true",
          }),
        ]);

      setContracts(contractData);
      setEmployees(employeeData);
    } catch (error) {
      toast.error(
        getApiError(
          error,
          "Unable to load employment contracts.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, expiryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleContracts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return contracts;

    return contracts.filter((contract) =>
      [
        contract.contract_number,
        contract.employee_name,
        contract.employee_number,
        contract.department_name,
        contract.position_title,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [contracts, search]);

  const statistics = useMemo(() => {
    const active = contracts.filter(
      (contract) => contract.status === "ACTIVE",
    ).length;

    const expiring = contracts.filter((contract) =>
      [
        "EXPIRING_7_DAYS",
        "EXPIRING_30_DAYS",
        "EXPIRES_TODAY",
      ].includes(contract.expiry_state),
    ).length;

    const expired = contracts.filter(
      (contract) =>
        contract.expiry_state === "EXPIRED" ||
        contract.status === "EXPIRED",
    ).length;

    return {
      total: contracts.length,
      active,
      expiring,
      expired,
    };
  }, [contracts]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (contract) => {
    setEditing(contract);

    setForm({
      employee: String(contract.employee || ""),
      contract_number:
        contract.contract_number || "",
      start_date: contract.start_date || "",
      end_date: contract.end_date || "",
      probation_end_date:
        contract.probation_end_date || "",
      basic_salary:
        String(contract.basic_salary || "0"),
      currency: contract.currency || "SSP",
      working_hours_per_week:
        String(
          contract.working_hours_per_week || "40",
        ),
      status: contract.status || "ACTIVE",
      terms: contract.terms || "",
      document: null,
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const submitForm = async (event) => {
    event.preventDefault();

    if (!form.employee) {
      toast.error("Select an employee.");
      return;
    }

    if (!form.contract_number.trim()) {
      toast.error("Contract number is required.");
      return;
    }

    if (!form.start_date) {
      toast.error("Start date is required.");
      return;
    }

    const payload = new FormData();

    payload.append("employee", form.employee);
    payload.append(
      "contract_number",
      form.contract_number.trim(),
    );
    payload.append("start_date", form.start_date);
    payload.append(
      "basic_salary",
      form.basic_salary || "0",
    );
    payload.append(
      "currency",
      form.currency.trim().toUpperCase(),
    );
    payload.append(
      "working_hours_per_week",
      form.working_hours_per_week || "40",
    );
    payload.append("status", form.status);
    payload.append("terms", form.terms || "");

    if (form.end_date) {
      payload.append("end_date", form.end_date);
    } else if (editing?.end_date) {
      payload.append("end_date", "");
    }

    if (form.probation_end_date) {
      payload.append(
        "probation_end_date",
        form.probation_end_date,
      );
    } else if (editing?.probation_end_date) {
      payload.append("probation_end_date", "");
    }

    if (form.document) {
      payload.append("document", form.document);
    }

    try {
      setSaving(true);

      if (editing) {
        await hrApi.updateContract(
          editing.id,
          payload,
        );
        toast.success("Contract updated.");
      } else {
        await hrApi.createContract(payload);
        toast.success("Contract created.");
      }

      closeForm();
      await loadData();
    } catch (error) {
      toast.error(
        getApiError(error, "Unable to save contract."),
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteContract = async (contract) => {
    const confirmed = window.confirm(
      `Delete contract "${contract.contract_number}"?`,
    );

    if (!confirmed) return;

    try {
      await hrApi.deleteContract(contract.id);
      toast.success("Contract deleted.");
      await loadData();
    } catch (error) {
      toast.error(
        getApiError(error, "Unable to delete contract."),
      );
    }
  };

  const cards = [
    {
      label: "Total Contracts",
      value: statistics.total,
      icon: FileText,
    },
    {
      label: "Active",
      value: statistics.active,
      icon: CheckCircle2,
    },
    {
      label: "Expiring Soon",
      value: statistics.expiring,
      icon: CalendarClock,
    },
    {
      label: "Expired",
      value: statistics.expired,
      icon: XCircle,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">
              Human Resources
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Employment Contracts
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage employee terms, salaries and expiry
              dates.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              disabled={employees.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Contract
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {value}
                  </p>
                </div>

                <div className="rounded-xl bg-orange-50 p-3">
                  <Icon className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search employee or contract..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={expiryFilter}
              onChange={(event) =>
                setExpiryFilter(event.target.value)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All expiry dates</option>
              <option value="active">Currently valid</option>
              <option value="expired">Expired</option>
              <option value="open-ended">
                Open-ended
              </option>
            </select>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading contracts...
            </div>
          ) : visibleContracts.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">
                No contracts found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Contract",
                      "Employee",
                      "Salary",
                      "Period",
                      "Status",
                      "Expiry",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {visibleContracts.map((contract) => (
                    <tr key={contract.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">
                          {contract.contract_number}
                        </p>
                        <p className="text-xs text-slate-500">
                          {contract.position_title || "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {contract.employee_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {contract.employee_number}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {formatMoney(
                          contract.basic_salary,
                          contract.currency,
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        <p>{contract.start_date}</p>
                        <p>{contract.end_date || "Open-ended"}</p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                            contract.status,
                          )}`}
                        >
                          {contract.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {[
                            "EXPIRED",
                            "EXPIRES_TODAY",
                            "EXPIRING_7_DAYS",
                            "EXPIRING_30_DAYS",
                          ].includes(contract.expiry_state) && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}

                          <span className="text-slate-600">
                            {expiryLabel(contract)}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(contract)}
                            className="rounded-lg border border-slate-300 p-2 text-slate-600"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteContract(contract)
                            }
                            className="rounded-lg border border-red-200 p-2 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
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

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
              <form onSubmit={submitForm}>
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-lg font-semibold">
                    {editing
                      ? "Edit Employment Contract"
                      : "Create Employment Contract"}
                  </h2>
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <label className="text-sm font-medium">
                    Employee
                    <select
                      value={form.employee}
                      disabled={Boolean(editing)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          employee: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">
                        Select employee
                      </option>

                      {employees.map((employee) => (
                        <option
                          key={employee.id}
                          value={employee.id}
                        >
                          {employee.employee_number} -{" "}
                          {employee.full_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-medium">
                    Contract number
                    <input
                      value={form.contract_number}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          contract_number:
                            event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Start date
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          start_date: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    End date
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          end_date: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Probation end date
                    <input
                      type="date"
                      value={form.probation_end_date}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          probation_end_date:
                            event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Status
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-medium">
                    Basic salary
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.basic_salary}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          basic_salary:
                            event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Currency
                    <input
                      value={form.currency}
                      maxLength={10}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          currency: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Weekly working hours
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.working_hours_per_week
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          working_hours_per_week:
                            event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Contract document
                    <input
                      type="file"
                      onChange={(event) =>
                        setForm({
                          ...form,
                          document:
                            event.target.files?.[0] ||
                            null,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm font-medium md:col-span-2">
                    Contract terms
                    <textarea
                      rows={5}
                      value={form.terms}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          terms: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving
                      ? "Saving..."
                      : "Save Contract"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
