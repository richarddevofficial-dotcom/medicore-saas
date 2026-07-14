"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import {
  Building2,
  Users,
  DollarSign,
  Activity,
  Search,
  Filter,
  CreditCard,
  Wallet,
  AlertTriangle,
  PieChart,
  Download,
  Bell,
  RotateCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
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
  const [resendingReceiptPaymentId, setResendingReceiptPaymentId] =
    useState(null);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [creatingSuperAdmin, setCreatingSuperAdmin] = useState(false);
  const [notificationsOps, setNotificationsOps] = useState({
    failed_notifications: [],
    failed_receipt_jobs: [],
  });
  const [loadingNotificationsOps, setLoadingNotificationsOps] = useState(false);
  const [retryingFailedReceiptJobs, setRetryingFailedReceiptJobs] =
    useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingPayment, setReviewingPayment] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("paid");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [billingSearchTerm, setBillingSearchTerm] = useState("");
  const [billingPlanFilter, setBillingPlanFilter] = useState("all");
  const [billingPaymentStatusFilter, setBillingPaymentStatusFilter] =
    useState("all");
  const [superAdminForm, setSuperAdminForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    admin_type: "secondary",
  });

  const planDistributionChart = data?.plan_distribution_chart || [];
  const planDistributionColors = ["#f59e0b", "#3b82f6", "#10b981", "#6366f1"];

  const filteredRecentPayments = (
    data?.recent_subscription_payments || []
  ).filter((payment) => {
    const search = billingSearchTerm.toLowerCase();
    const matchesSearch =
      (payment.hospital_name || "").toLowerCase().includes(search) ||
      (payment.transaction_id || "").toLowerCase().includes(search);
    const matchesPlan =
      billingPlanFilter === "all" || payment.plan === billingPlanFilter;
    const matchesStatus =
      billingPaymentStatusFilter === "all" ||
      payment.status === billingPaymentStatusFilter;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const filteredInvoices = (data?.recent_invoices || []).filter((invoice) => {
    const search = billingSearchTerm.toLowerCase();
    const matchesSearch = (invoice.hospital_name || "")
      .toLowerCase()
      .includes(search);
    const matchesPlan =
      billingPlanFilter === "all" || invoice.plan === billingPlanFilter;
    return matchesSearch && matchesPlan;
  });

  const formatUSD = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  const getReceiptStatusVariant = (deliveryStatus) => {
    if (deliveryStatus === "sent") return "success";
    if (deliveryStatus === "queued") return "info";
    if (deliveryStatus === "failed") return "danger";
    return "default";
  };

  const fetchPendingPayments = async () => {
    const res = await apiClient.get("/subscription-payments/?status=pending");
    setPendingPayments(res.data.results || res.data || []);
  };

  const fetchPlatformSuperAdmins = async () => {
    const res = await apiClient.get("/super-admin/platform-admins/");
    setSuperAdmins(res.data.results || []);
  };

  const fetchNotificationFailures = async () => {
    setLoadingNotificationsOps(true);
    try {
      const res = await apiClient.get("/super-admin/notifications/failures/");
      setNotificationsOps({
        failed_notifications: res.data?.failed_notifications || [],
        failed_receipt_jobs: res.data?.failed_receipt_jobs || [],
      });
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Failed to load notification failures",
      );
    } finally {
      setLoadingNotificationsOps(false);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, paymentsRes, platformAdminsRes] = await Promise.all([
          apiClient.get("/super-admin/stats/"),
          apiClient.get("/subscription-payments/?status=pending"),
          apiClient.get("/super-admin/platform-admins/"),
        ]);
        setData(statsRes.data);
        setPendingPayments(paymentsRes.data.results || paymentsRes.data || []);
        setSuperAdmins(platformAdminsRes.data.results || []);
        await fetchNotificationFailures();
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
      // Force a full navigation so auth/role state is re-evaluated immediately.
      window.location.assign("/admin");
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

  const openReviewModal = (payment, status) => {
    setReviewingPayment(payment);
    setReviewStatus(status);
    setReviewNote("");
    setReviewModalOpen(true);
  };

  const handleReviewPayment = async () => {
    const trimmedNote = reviewNote.trim();

    if (!reviewingPayment) {
      return;
    }

    if (!trimmedNote || trimmedNote.length < 5) {
      toast.error("Review note is required (min 5 characters)");
      return;
    }

    setReviewSubmitting(true);
    try {
      const { data: responseData } = await apiClient.post(
        `/subscription-payments/${reviewingPayment.id}/review/`,
        {
          status: reviewStatus,
          review_note: trimmedNote,
        },
      );

      if (reviewStatus === "paid") {
        if (responseData?.receipt_email_sent) {
          toast.success("Payment approved and receipt sent");
        } else {
          toast.error(
            responseData?.receipt_email_error ||
              "Payment approval did not send receipt",
          );
        }
      } else {
        toast.success(`Payment marked as ${reviewStatus}`);
      }

      setReviewModalOpen(false);
      setReviewingPayment(null);
      setReviewNote("");
      const res = await apiClient.get("/super-admin/stats/");
      setData(res.data);
      await fetchPendingPayments();
    } catch {
      toast.error("Failed to update payment status");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleResendReceipt = async (paymentId) => {
    if (resendingReceiptPaymentId !== null) return;
    setResendingReceiptPaymentId(paymentId);
    try {
      const { data: responseData } = await apiClient.post(
        `/subscription-payments/${paymentId}/resend_receipt/`,
      );
      toast.success(responseData?.message || "Receipt email queued");
      setData((prev) => {
        if (!prev?.recent_subscription_payments) return prev;
        return {
          ...prev,
          recent_subscription_payments: prev.recent_subscription_payments.map(
            (payment) =>
              payment.id === paymentId
                ? {
                    ...payment,
                    receipt_delivery_status:
                      responseData?.receipt_delivery_status || "queued",
                    receipt_last_error: "",
                  }
                : payment,
          ),
        };
      });
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to send receipt");
    } finally {
      setResendingReceiptPaymentId(null);
    }
  };

  const handleCreateSuperAdmin = async (e) => {
    e.preventDefault();
    if (!superAdminForm.email || !superAdminForm.password) {
      toast.error("Email and password are required");
      return;
    }

    setCreatingSuperAdmin(true);
    try {
      await apiClient.post(
        "/super-admin/platform-admins/create/",
        superAdminForm,
      );
      toast.success("Platform super admin created");
      setSuperAdminForm({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        admin_type: "secondary",
      });
      await fetchPlatformSuperAdmins();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to create super admin");
    } finally {
      setCreatingSuperAdmin(false);
    }
  };

  const handleToggleSuperAdminStatus = async (userId) => {
    try {
      await apiClient.post("/super-admin/platform-admins/toggle-status/", {
        user_id: userId,
      });
      toast.success("Super admin status updated");
      await fetchPlatformSuperAdmins();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update super admin");
    }
  };

  const handleRetryFailedReceiptJobs = async () => {
    setRetryingFailedReceiptJobs(true);
    try {
      const { data: response } = await apiClient.post(
        "/super-admin/notifications/retry-receipts/",
      );
      const retriedCount = Number(response?.retried_count || 0);
      toast.success(`Queued ${retriedCount} failed receipt job(s) for retry`);
      await fetchNotificationFailures();
      await fetchPendingPayments();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Failed to retry failed receipt jobs",
      );
    } finally {
      setRetryingFailedReceiptJobs(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setFilterPlan("all");
    setFilterStatus("all");
  };

  const handleExportMonthlyReport = () => {
    const monthly = data?.monthly_subscription_collections || [];
    if (!monthly.length) {
      toast.error("No monthly subscription data to export");
      return;
    }

    const rows = [
      ["Month", "Amount (USD)"],
      ...monthly.map((item) => [
        item.month,
        Number(item.amount || 0).toFixed(2),
      ]),
    ];

    const csvContent = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monthly-subscription-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Monthly subscription report downloaded");
  };

  const handleExportComprehensiveReport = async () => {
    try {
      const { data: reportData } = await apiClient.get(
        "/subscription-payments/comprehensive_report/",
      );
      const rows = reportData?.rows || [];
      if (!rows.length) {
        toast.error("No subscription payment data to export");
        return;
      }

      const csvRows = [
        ["Generated At", reportData?.generated_at || ""],
        ["Total Payments", reportData?.summary?.total_payments || 0],
        [
          "Total Collected (USD)",
          Number(reportData?.summary?.total_collected_usd || 0).toFixed(2),
        ],
        ["Pending Count", reportData?.summary?.pending_count || 0],
        ["Failed Count", reportData?.summary?.failed_count || 0],
        ["Refunded Count", reportData?.summary?.refunded_count || 0],
        [],
        [
          "Receipt ID",
          "Hospital",
          "Hospital Email",
          "Plan",
          "Billing Cycle (Months)",
          "Amount",
          "Currency",
          "Status",
          "Payment Method",
          "Transaction ID",
          "Payment Date",
          "Subscription Start",
          "Subscription End",
          "Receipt Delivery Status",
          "Receipt Last Attempt At",
          "Receipt Sent At",
          "Receipt Last Error",
          "Created At",
        ],
        ...rows.map((item) => [
          item.receipt_id,
          item.hospital_name,
          item.hospital_email,
          item.plan,
          item.billing_cycle_months || 1,
          Number(item.amount || 0).toFixed(2),
          item.currency,
          item.status,
          item.payment_method || "",
          item.transaction_id || "",
          item.payment_date || "",
          item.subscription_start || "",
          item.subscription_end || "",
          item.receipt_delivery_status || "",
          item.receipt_last_attempt_at || "",
          item.receipt_sent_at || "",
          item.receipt_last_error || "",
          item.created_at || "",
        ]),
      ];

      const csvContent = csvRows
        .map((row) =>
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `comprehensive-subscription-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Comprehensive subscription report downloaded");
    } catch {
      toast.error("Failed to download comprehensive report");
    }
  };

  const handleExportComprehensiveExcel = async () => {
    try {
      const { data: reportData } = await apiClient.get(
        "/subscription-payments/comprehensive_report/",
      );
      const rows = reportData?.rows || [];
      if (!rows.length) {
        toast.error("No subscription payment data to export");
        return;
      }

      const excelRows = [
        ["Receipt ID", "Hospital", "Plan", "Amount", "Status", "Payment Date"],
        ...rows.map((item) => [
          item.receipt_id,
          item.hospital_name,
          item.plan,
          Number(item.amount || 0).toFixed(2),
          item.status,
          item.payment_date || "",
        ]),
      ];

      const excelContent = excelRows.map((row) => row.join("\t")).join("\n");
      const blob = new Blob([excelContent], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `subscription-billing-center-${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Excel report downloaded");
    } catch {
      toast.error("Failed to download Excel report");
    }
  };

  const handleExportComprehensivePdf = async () => {
    try {
      const { data: reportData } = await apiClient.get(
        "/subscription-payments/comprehensive_report/",
      );
      const rows = reportData?.rows || [];
      if (!rows.length) {
        toast.error("No subscription payment data to export");
        return;
      }

      const tableRows = rows
        .slice(0, 80)
        .map(
          (item) => `
            <tr>
              <td>${item.receipt_id}</td>
              <td>${item.hospital_name}</td>
              <td>${item.plan}</td>
              <td>${Number(item.amount || 0).toFixed(2)}</td>
              <td>${item.status}</td>
              <td>${item.payment_date || "-"}</td>
            </tr>`,
        )
        .join("");

      const popup = window.open("", "_blank", "width=1200,height=800");
      if (!popup) {
        toast.error("Please allow popups to export PDF");
        return;
      }
      popup.document.write(`
        <html>
          <head>
            <title>Super Admin Billing Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              h1 { margin: 0 0 8px; }
              p { margin: 0 0 16px; color: #555; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
              th { background: #f3f4f6; text-align: left; }
            </style>
          </head>
          <body>
            <h1>Super Admin Billing Report</h1>
            <p>Generated at: ${new Date().toLocaleString()}</p>
            <table>
              <thead>
                <tr>
                  <th>Receipt ID</th>
                  <th>Hospital</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment Date</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `);
      popup.document.close();
      popup.focus();
      popup.print();
      toast.success("PDF print dialog opened");
    } catch {
      toast.error("Failed to prepare PDF export");
    }
  };

  const handleDownloadSubscriptionReceipt = async (paymentId) => {
    try {
      const response = await apiClient.get(
        `/subscription-payments/${paymentId}/receipt_pdf/`,
        { responseType: "blob" },
      );
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `subscription-receipt-${paymentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Failed to download receipt PDF");
    }
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">🛡️ Super Admin Dashboard</h1>
            <p className="text-sm text-gray-500">
              Manage all hospitals on the platform
            </p>
          </div>
          <Button
            variant="primary"
            icon={Download}
            onClick={handleExportMonthlyReport}
          >
            Download Monthly CSV
          </Button>
          <Button
            variant="outline"
            icon={Download}
            onClick={handleExportComprehensiveReport}
          >
            Download Comprehensive CSV
          </Button>
          <Button
            variant="outline"
            icon={Download}
            onClick={handleExportComprehensiveExcel}
          >
            Export Excel
          </Button>
          <Button
            variant="outline"
            icon={Download}
            onClick={handleExportComprehensivePdf}
          >
            Export PDF
          </Button>
        </div>

        {/* SaaS Control Center Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <Building2 className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{data?.total_hospitals || 0}</p>
            <p className="text-xs text-gray-500">Total Hospitals</p>
          </Card>
          <Card className="text-center">
            <Activity className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{data?.active_hospitals || 0}</p>
            <p className="text-xs text-gray-500">Active Hospitals</p>
          </Card>
          <Card className="text-center">
            <Users className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{data?.trial_hospitals || 0}</p>
            <p className="text-xs text-gray-500">Trial Hospitals</p>
          </Card>
          <Card className="text-center">
            <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {data?.grace_period_hospitals || 0}
            </p>
            <p className="text-xs text-gray-500">Grace Period</p>
          </Card>
          <Card className="text-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {data?.suspended_hospitals || 0}
            </p>
            <p className="text-xs text-gray-500">Suspended Hospitals</p>
          </Card>
          <Card className="text-center">
            <DollarSign className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {formatUSD(data?.monthly_revenue || 0)}
            </p>
            <p className="text-xs text-gray-500">Monthly Revenue</p>
          </Card>
          <Card className="text-center">
            <CreditCard className="h-6 w-6 text-indigo-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {data?.pending_payments_count || 0}
            </p>
            <p className="text-xs text-gray-500">Pending Payments</p>
          </Card>
          <Card className="text-center">
            <PieChart className="h-6 w-6 text-gray-700 mx-auto mb-1" />
            <p className="text-2xl font-bold">{data?.overdue_invoices || 0}</p>
            <p className="text-xs text-gray-500">Overdue Invoices</p>
          </Card>
        </div>

        {/* Core SaaS Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <div className="flex items-start md:items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="font-semibold">Revenue per month</h2>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.revenue_per_month || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [formatUSD(value), "Revenue"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#0ea5e9"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="flex items-start md:items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="font-semibold">New hospitals per month</h2>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.new_hospitals_per_month || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, "Hospitals"]} />
                  <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="flex items-start md:items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="font-semibold">Plan distribution</h2>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={planDistributionChart}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label
                  >
                    {planDistributionChart.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        fill={
                          planDistributionColors[
                            index % planDistributionColors.length
                          ]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Hospitals"]} />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="flex items-start md:items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="font-semibold">Trial conversion rate</h2>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.trial_conversion_rate || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip
                    formatter={(value) => [
                      `${Number(value || 0).toFixed(2)}%`,
                      "Conversion",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold">Platform Super Admins</h2>
            <p className="text-xs text-gray-500 mt-1">
              Only this section can create and manage platform super users.
            </p>
          </div>
          <div className="p-4 border-b border-gray-200">
            <form
              onSubmit={handleCreateSuperAdmin}
              className="grid grid-cols-1 md:grid-cols-6 gap-3"
            >
              <input
                type="text"
                placeholder="First name"
                value={superAdminForm.first_name}
                onChange={(e) =>
                  setSuperAdminForm((prev) => ({
                    ...prev,
                    first_name: e.target.value,
                  }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Last name"
                value={superAdminForm.last_name}
                onChange={(e) =>
                  setSuperAdminForm((prev) => ({
                    ...prev,
                    last_name: e.target.value,
                  }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={superAdminForm.email}
                onChange={(e) =>
                  setSuperAdminForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={superAdminForm.password}
                onChange={(e) =>
                  setSuperAdminForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
              <select
                value={superAdminForm.admin_type}
                onChange={(e) =>
                  setSuperAdminForm((prev) => ({
                    ...prev,
                    admin_type: e.target.value,
                  }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="secondary">Secondary</option>
                <option value="primary">Primary</option>
              </select>
              <Button type="submit" isLoading={creatingSuperAdmin}>
                Add Super Admin
              </Button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
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
                {superAdmins.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 text-sm font-medium">
                      {[item.first_name, item.last_name]
                        .filter(Boolean)
                        .join(" ") || "-"}
                    </td>
                    <td className="px-3 py-3 text-sm">{item.email}</td>
                    <td className="px-3 py-3 text-sm">
                      {item.admin_type === "primary" ? (
                        <Badge variant="info">Primary</Badge>
                      ) : (
                        <Badge variant="default">Secondary</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <Badge variant={item.is_active ? "success" : "danger"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {item.admin_type === "primary" ? (
                        <span className="text-xs text-gray-400">Locked</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleSuperAdminStatus(item.id)}
                        >
                          {item.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {superAdmins.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-6 text-gray-500">
                      <EmptyState
                        imageSrc="/images/empty-states/reports-empty.svg"
                        imageAlt="No super admins"
                        title="No platform super admins found"
                        className="py-2 px-0"
                        titleClassName="text-sm font-normal text-gray-500 mb-0"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Revenue & Payments KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="text-center">
            <Wallet className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {formatUSD(data?.subscription_collections_total || 0)}
            </p>
            <p className="text-xs text-gray-500">Subscription Collected</p>
          </Card>
          <Card className="text-center">
            <CreditCard className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {formatUSD(data?.subscription_collections_this_month || 0)}
            </p>
            <p className="text-xs text-gray-500">Collected This Month</p>
          </Card>
          <Card className="text-center">
            <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {formatUSD(data?.pending_subscription_amount || 0)}
            </p>
            <p className="text-xs text-gray-500">Pending Collections</p>
          </Card>
          <Card className="text-center">
            <PieChart className="h-6 w-6 text-indigo-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {data?.plan_distribution?.enterprise || 0}
            </p>
            <p className="text-xs text-gray-500">Enterprise Hospitals</p>
          </Card>
        </div>

        {/* Payment status breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <p className="text-2xl font-bold text-orange-600">
              {data?.payment_status_counts?.pending || 0}
            </p>
            <p className="text-xs text-gray-500">Pending Payments</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {data?.payment_status_counts?.paid || 0}
            </p>
            <p className="text-xs text-gray-500">Paid Payments</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {data?.payment_status_counts?.failed || 0}
            </p>
            <p className="text-xs text-gray-500">Failed Payments</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-gray-700">
              {data?.payment_status_counts?.refunded || 0}
            </p>
            <p className="text-xs text-gray-500">Refunded Payments</p>
          </Card>
        </div>

        <Card>
          <div className="flex items-start md:items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="font-semibold">Monthly Subscription Collections</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Last 6 months</span>
              <Button
                size="sm"
                variant="outline"
                icon={Download}
                onClick={handleExportMonthlyReport}
              >
                Download CSV
              </Button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data?.monthly_subscription_collections || []}
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [formatUSD(value), "Collections"]}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

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

        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold">Notification Operations</h2>
              <p className="text-xs text-gray-500 mt-1">
                Monitor failed OTP/receipt notifications and requeue failed
                receipt jobs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                icon={RotateCw}
                onClick={fetchNotificationFailures}
                isLoading={loadingNotificationsOps}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                icon={Bell}
                onClick={handleRetryFailedReceiptJobs}
                isLoading={retryingFailedReceiptJobs}
                disabled={!notificationsOps.failed_receipt_jobs.length}
              >
                Retry Failed Receipts
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium">
                Failed Notifications (
                {notificationsOps.failed_notifications.length})
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Recipient
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Attempts
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {notificationsOps.failed_notifications.map((event) => (
                      <tr key={event.id}>
                        <td className="px-3 py-2 text-sm">
                          <Badge variant="danger">{event.type}</Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {event.recipient}
                          {event.error_message && (
                            <p className="text-xs text-red-600 mt-1">
                              {event.error_message}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">{event.attempts}</td>
                      </tr>
                    ))}
                    {!notificationsOps.failed_notifications.length && (
                      <tr>
                        <td
                          colSpan="3"
                          className="px-3 py-6 text-center text-sm text-gray-500"
                        >
                          No failed notifications
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium">
                Failed Receipt Jobs (
                {notificationsOps.failed_receipt_jobs.length})
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Hospital
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Attempts
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {notificationsOps.failed_receipt_jobs.map((job) => (
                      <tr key={job.id}>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {job.hospital_name}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {job.attempts}/{job.max_attempts}
                        </td>
                        <td className="px-3 py-2 text-sm text-red-600">
                          {job.last_error || "-"}
                        </td>
                      </tr>
                    ))}
                    {!notificationsOps.failed_receipt_jobs.length && (
                      <tr>
                        <td
                          colSpan="3"
                          className="px-3 py-6 text-center text-sm text-gray-500"
                        >
                          No failed receipt jobs
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>

        {/* Hospitals List */}
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">Super Admin Billing Center</h2>
              <p className="text-xs text-gray-500 mt-1">
                Search hospitals, filter by plan/payment status, and review
                invoices/receipts.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Search hospital or transaction..."
                value={billingSearchTerm}
                onChange={(e) => setBillingSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <select
                value={billingPlanFilter}
                onChange={(e) => setBillingPlanFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Plans</option>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select
                value={billingPaymentStatusFilter}
                onChange={(e) => setBillingPaymentStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Payment Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
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
                      <EmptyState
                        imageSrc="/images/empty-states/patients-empty.svg"
                        imageAlt="No hospitals"
                        title="No hospitals found matching your filters"
                        className="py-2 px-0"
                        titleClassName="text-sm font-normal text-gray-500 mb-0"
                      />
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
                    Cycle
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
                    <td className="px-3 py-3">
                      {payment.billing_cycle_months || 1}m
                    </td>
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
                          onClick={() => openReviewModal(payment, "paid")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => openReviewModal(payment, "failed")}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingPayments.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">
                      <EmptyState
                        imageSrc="/images/empty-states/billing-empty.svg"
                        imageAlt="No pending payments"
                        title="No pending payments"
                        className="py-2 px-0"
                        titleClassName="text-sm font-normal text-gray-500 mb-0"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Modal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setReviewingPayment(null);
            setReviewNote("");
          }}
          title={reviewStatus === "paid" ? "Approve payment" : "Reject payment"}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setReviewModalOpen(false);
                  setReviewingPayment(null);
                  setReviewNote("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReviewPayment}
                isLoading={reviewSubmitting}
              >
                {reviewStatus === "paid" ? "Approve" : "Reject"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {reviewStatus === "paid"
                ? "Add approval note (required)"
                : "Add rejection note (required)"}
            </p>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={4}
              placeholder="Enter at least 5 characters"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </Modal>

        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold">Recent SaaS Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Invoice #
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hospital
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Balance
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Due
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-3 py-3">{invoice.hospital_name}</td>
                    <td className="px-3 py-3 uppercase">{invoice.plan}</td>
                    <td className="px-3 py-3">
                      {invoice.currency}{" "}
                      {Number(invoice.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3">
                      {invoice.currency}{" "}
                      {Number(invoice.balance_due || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          invoice.status === "paid"
                            ? "success"
                            : invoice.status === "overdue"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {invoice.due_date
                        ? new Date(invoice.due_date).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">
                      <EmptyState
                        imageSrc="/images/empty-states/billing-empty.svg"
                        imageAlt="No invoices"
                        title="No invoices match the current filters"
                        className="py-2 px-0"
                        titleClassName="text-sm font-normal text-gray-500 mb-0"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold">Recent Subscription Payments</h2>
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
                    Cycle
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Receipt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecentPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium">
                      {payment.hospital_name}
                    </td>
                    <td className="px-3 py-3">{payment.plan}</td>
                    <td className="px-3 py-3">
                      {payment.billing_cycle_months || 1}m
                    </td>
                    <td className="px-3 py-3">${payment.amount}</td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          payment.status === "paid"
                            ? "success"
                            : payment.status === "pending"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {payment.payment_date
                        ? new Date(payment.payment_date).toLocaleDateString()
                        : new Date(payment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      {payment.status === "paid" ? (
                        <div className="flex flex-col items-start gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={resendingReceiptPaymentId === payment.id}
                            disabled={resendingReceiptPaymentId !== null}
                            onClick={() => handleResendReceipt(payment.id)}
                          >
                            Resend Receipt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleDownloadSubscriptionReceipt(payment.id)
                            }
                          >
                            View Receipt PDF
                          </Button>
                          <Badge
                            variant={getReceiptStatusVariant(
                              payment.receipt_delivery_status,
                            )}
                          >
                            Receipt{" "}
                            {payment.receipt_delivery_status || "not_sent"}
                          </Badge>
                          {payment.receipt_delivery_status === "failed" &&
                            payment.receipt_last_error && (
                              <span className="text-xs text-red-600">
                                {payment.receipt_last_error}
                              </span>
                            )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRecentPayments.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">
                      <EmptyState
                        imageSrc="/images/empty-states/billing-empty.svg"
                        imageAlt="No subscription payments"
                        title="No subscription payments match the current filters"
                        className="py-2 px-0"
                        titleClassName="text-sm font-normal text-gray-500 mb-0"
                      />
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
