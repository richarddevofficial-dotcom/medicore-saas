"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import AdminBackButton from "@/components/ui/AdminBackButton";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { AlertCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import apiClient from "@/lib/api-client";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await apiClient.get("/audit-logs/", {
          params: { page, search: searchTerm || undefined },
          signal: controller.signal,
        });
        setLogs(Array.isArray(data) ? data : data.results || []);
        setTotal(Array.isArray(data) ? data.length : data.count || 0);
        setHasNext(Boolean(data.next));
      } catch (err) {
        if (err.name !== "CanceledError") {
          setError(err.response?.data?.detail || "Unable to load audit logs.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchLogs();
    return () => {
      controller.abort();
    };
  }, [page, searchTerm]);

  const typeVariant = (type) => {
    if (type === "create") return "success";
    if (type === "update") return "info";
    if (type === "delete") return "danger";
    return "default";
  };

  if (loading)
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AdminBackButton />
            <div>
              <h1 className="text-2xl font-bold">Audit Logs</h1>
              <p className="text-sm text-gray-500">
                {total} activities recorded
              </p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>

        {error && (
          <div className="flex items-center gap-3 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Target
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      <EmptyState
                        imageSrc="/images/empty-states/reports-empty.svg"
                        imageAlt="No logs"
                        title="No logs found"
                        className="py-2 px-0"
                        titleClassName="text-sm font-normal text-gray-500 mb-0"
                      />
                    </td>
                  </tr>
                ) : (
                  logs.map((log, i) => (
                    <tr key={log.id || i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">
                        {log.user}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {log.role}
                      </td>
                      <td className="px-4 py-3 text-sm">{log.action}</td>
                      <td className="px-4 py-3 text-sm">{log.target}</td>
                      <td className="px-4 py-3">
                        <Badge variant={typeVariant(log.action_type)}>
                          {log.action_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-md border p-2 text-gray-600 disabled:opacity-40"
            title="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600">Page {page}</span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasNext}
            className="rounded-md border p-2 text-gray-600 disabled:opacity-40"
            title="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
