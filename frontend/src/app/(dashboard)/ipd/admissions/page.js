"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bed,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

import apiClient from "@/lib/api-client";


function dateValue(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(new Date(value));
}


export default function AdmissionsPage() {
  const searchParams = useSearchParams();

  const initialStatus =
    searchParams.get("status") || "";

  const [data, setData] = useState({
    count: 0,
    results: [],
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] =
    useState(initialStatus);
  const [
    admissionType,
    setAdmissionType,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  async function loadAdmissions(
    isRefresh = false,
  ) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await apiClient.get(
        "/ipd/admissions/",
        {
          params: {
            search: search || undefined,
            status: status || undefined,
            admission_type:
              admissionType || undefined,
          },
        },
      );

      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.detail ||
          "Unable to load IPD admissions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAdmissions();
    }, 300);

    return () =>
      window.clearTimeout(timer);
  }, [
    search,
    status,
    admissionType,
  ]);

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
            Inpatient Department
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Admissions
          </h1>

          <p className="mt-2 text-slate-600">
            Manage pending admissions and current
            inpatient records.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/ipd/admissions/new"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600"
          >
            <UserPlus size={18} />
            New Admission
          </Link>

          <button
            type="button"
            onClick={() =>
              loadAdmissions(true)
            }
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              size={18}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search admission or patient..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">
              All statuses
            </option>
            <option value="pending">
              Pending
            </option>
            <option value="admitted">
              Admitted
            </option>
            <option value="transferred">
              Transferred
            </option>
            <option value="discharged">
              Discharged
            </option>
            <option value="cancelled">
              Cancelled
            </option>
          </select>

          <select
            value={admissionType}
            onChange={(event) =>
              setAdmissionType(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">
              All admission types
            </option>
            <option value="emergency">
              Emergency
            </option>
            <option value="elective">
              Elective
            </option>
            <option value="transfer">
              Transfer
            </option>
            <option value="observation">
              Observation
            </option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <p className="font-semibold text-slate-900">
            {data.count || 0} admission(s)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <TableHeader>
                  Admission
                </TableHeader>

                <TableHeader>
                  Patient
                </TableHeader>

                <TableHeader>
                  Diagnosis
                </TableHeader>

                <TableHeader>
                  Type
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Ward / Room / Bed
                </TableHeader>

                <TableHeader>
                  Admission Date
                </TableHeader>

                <TableHeader>
                  Action
                </TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data.results?.map(
                (admission) => (
                  <tr
                    key={admission.id}
                    className="hover:bg-slate-50"
                  >
                    <TableCell>
                      <span className="font-semibold text-slate-900">
                        {
                          admission.admission_number
                        }
                      </span>
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {admission.patient_detail
                            ?.name || "Unknown"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {admission.patient_detail
                            ?.phone ||
                            "No phone"}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <p className="max-w-xs truncate">
                        {
                          admission.provisional_diagnosis
                        }
                      </p>
                    </TableCell>

                    <TableCell>
                      <span className="capitalize">
                        {String(
                          admission.admission_type ||
                            "",
                        ).replaceAll(
                          "_",
                          " ",
                        )}
                      </span>
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        value={
                          admission.status
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <div>
                        <p>
                          {admission.ward_detail
                            ?.name ||
                            "No ward"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Room:{" "}
                          {admission.room_detail
                            ?.name || "None"}
                          {" • "}
                          Bed:{" "}
                          {admission.bed_detail
                            ?.name || "None"}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      {dateValue(
                        admission.admitted_at ||
                          admission.created_at,
                      )}
                    </TableCell>

                    <TableCell>
                      <Link
                        href={`/ipd/admissions/${admission.id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        <Eye size={15} />
                        View
                      </Link>
                    </TableCell>
                  </tr>
                ),
              )}

              {!loading &&
                !data.results?.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center"
                    >
                      <Users
                        size={42}
                        className="mx-auto text-slate-300"
                      />

                      <p className="mt-4 font-semibold text-slate-700">
                        No admissions found
                      </p>
                    </td>
                  </tr>
                )}

              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-16 text-center"
                  >
                    <Loader2
                      size={34}
                      className="mx-auto animate-spin text-orange-500"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


function TableHeader({ children }) {
  return (
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}


function TableCell({ children }) {
  return (
    <td className="px-5 py-4 text-sm text-slate-700">
      {children}
    </td>
  );
}


function StatusBadge({ value }) {
  const normalized = String(
    value || "pending",
  ).toLowerCase();

  const classes = {
    pending:
      "bg-blue-100 text-blue-700",
    admitted:
      "bg-green-100 text-green-700",
    transferred:
      "bg-purple-100 text-purple-700",
    discharged:
      "bg-slate-200 text-slate-700",
    cancelled:
      "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        classes[normalized] ||
        classes.pending
      }`}
    >
      {normalized}
    </span>
  );
}
