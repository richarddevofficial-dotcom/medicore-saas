"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AdminBackButton from "@/components/ui/AdminBackButton";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { Search, Database } from "lucide-react";
import apiClient from "@/lib/api-client";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data } = await apiClient.get("/audit-logs/");
        setLogs(Array.isArray(data) ? data : data.results || []);
      } catch (err) {
        console.error("Failed to load logs");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filtered = logs.filter(
    (log) =>
      (log.user || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.target || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
                {logs.length} activities recorded
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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>

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
                {filtered.length === 0 ? (
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
                  filtered.map((log, i) => (
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
      </div>
    </DashboardLayout>
  );
}
