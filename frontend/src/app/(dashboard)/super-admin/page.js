"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import {
  Building2,
  Users,
  DollarSign,
  Activity,
  Search,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchPendingPayments = async () => {
    const res = await apiClient.get("/subscription-payments/?status=pending");
    setPendingPayments(res.data.results || res.data || []);
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, paymentsRes] = await Promise.all([
          apiClient.get("/super-admin/stats/"),
          apiClient.get("/subscription-payments/?status=pending"),
        ]);
        setData(statsRes.data);
        setPendingPayments(paymentsRes.data.results || paymentsRes.data || []);
      } catch {
        toast.error("Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Filter hospitals based on search term, plan, and status
  const filteredHospitals = data?.hospitals?.filter((hospital) => {
    const matchesSearch = hospital.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === "all" || hospital.plan === filterPlan;
    const matchesStatus =
      filterStatus === "all" || hospital.status === filterStatus;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const handleSwitchHospital = async (hospitalId) => {
    try {
      // Save super admin state to sessionStorage before switching
      sessionStorage.setItem(
        "super_admin_state",
        JSON.stringify({
          token: localStorage.getItem("token"),
          user: localStorage.getItem("user"),
          role: localStorage.getItem("role"),
          isSuperuser: localStorage.getItem("is_superuser"),
        }),
      );
      sessionStorage.setItem("impersonating_hospital_id", hospitalId);

      const { data } = await apiClient.post("/super-admin/switch-hospital/", {
        hospital_id: hospitalId,
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("hospital", JSON.stringify(data.hospital));
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("is_superuser", String(data.user.is_superuser));
      toast.success(`Switched to ${data.hospital.name}`);
      router.push("/dashboard");
    } catch (err) {
      toast.error("Failed to switch");
    }
  };

  const handleToggleStatus = async (hospitalId) => {
    try {
      await apiClient.post("/super-admin/toggle-hospital/", {
        hospital_id: hospitalId,
      });
      toast.success("Status updated");
      setLoading(true);
      const res = await apiClient.get("/super-admin/stats/");
      setData(res.data);
      await fetchPendingPayments();
    } catch (err) {
      toast.error("Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlan = async (hospitalId, plan) => {
    try {
      await apiClient.post("/super-admin/update-plan/", {
        hospital_id: hospitalId,
        plan,
      });
      toast.success("Plan updated");
      setLoading(true);
      const res = await apiClient.get("/super-admin/stats/");
      setData(res.data);
      await fetchPendingPayments();
    } catch (err) {
      toast.error("Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewPayment = async (paymentId, status) => {
    try {
      await apiClient.post(`/subscription-payments/${paymentId}/review/`, {
        status,
      });
      toast.success(`Payment marked as ${status}`);
      const res = await apiClient.get("/super-admin/stats/");
      setData(res.data);
      await fetchPendingPayments();
    } catch {
      toast.error("Failed to update payment status");
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setFilterPlan("all");
    setFilterStatus("all");
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
        <div>
          <h1 className="text-2xl font-bold">🛡️ Super Admin Dashboard</h1>
          <p className="text-sm text-gray-500">
            Manage all hospitals on the platform
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <Building2 className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{data?.total_hospitals || 0}</p>
            <p className="text-xs text-gray-500">Total Hospitals</p>
          </Card>
          <Card className="text-center">
            <Activity className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{data?.active_hospitals || 0}</p>
            <p className="text-xs text-gray-500">Active</p>
          </Card>
          <Card className="text-center">
            <Users className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{data?.total_patients || 0}</p>
            <p className="text-xs text-gray-500">Total Patients</p>
          </Card>
          <Card className="text-center">
            <DollarSign className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              SSP {(data?.total_revenue || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Total Revenue</p>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search hospitals by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-gray-400" />

            {/* Plan Filter */}
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">All Plans</option>
              <option value="trial">Trial</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Clear Filters Button */}
            {(searchTerm || filterPlan !== "all" || filterStatus !== "all") && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Hospitals List */}
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hospital
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Patients
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Revenue
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Staff
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredHospitals?.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium">{h.name}</td>
                    <td className="px-3 py-3">
                      <select
                        value={h.plan}
                        onChange={(e) => handleUpdatePlan(h.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="trial">Trial</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">{h.patients}</td>
                    <td className="px-3 py-3">
                      SSP {h.revenue?.toLocaleString()}
                    </td>
                    <td className="px-3 py-3">{h.staff}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => handleToggleStatus(h.id)}>
                        <Badge
                          variant={h.status === "active" ? "success" : "danger"}
                        >
                          {h.status}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSwitchHospital(h.id)}
                      >
                        🔄 Login As
                      </Button>
                      {h.days_left > 0 && (
                        <span className="text-xs text-orange-600 ml-2">
                          {h.days_left}d left
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredHospitals?.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">
                      No hospitals found matching your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Results count */}
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
            Showing {filteredHospitals?.length || 0} of{" "}
            {data?.hospitals?.length || 0} hospitals
          </div>
        </Card>

        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold">Pending Subscription Payments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hospital
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Method
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Transaction ID
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pendingPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium">
                      {payment.hospital_name}
                    </td>
                    <td className="px-3 py-3">{payment.plan}</td>
                    <td className="px-3 py-3">${payment.amount}</td>
                    <td className="px-3 py-3">
                      {payment.payment_method || "-"}
                    </td>
                    <td className="px-3 py-3 text-sm font-mono">
                      {payment.transaction_id || "-"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleReviewPayment(payment.id, "paid")
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            handleReviewPayment(payment.id, "failed")
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingPayments.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500">
                      No pending payments
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
