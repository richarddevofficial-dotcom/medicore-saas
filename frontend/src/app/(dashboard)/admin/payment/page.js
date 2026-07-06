"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import {
  ArrowLeft,
  CreditCard,
  DollarSign,
  CheckCircle,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import {
  SUBSCRIPTION_PLAN_MAP,
  SUBSCRIPTION_PLANS,
} from "@/lib/subscription-plans";

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    plan: "basic",
    amount: SUBSCRIPTION_PLAN_MAP.basic.monthlyPrice.toFixed(2),
    payment_method: "bank",
    transaction_id: "",
  });

  useEffect(() => {
    const selectedPlan = searchParams.get("plan");
    if (!selectedPlan || !SUBSCRIPTION_PLAN_MAP[selectedPlan]) {
      return;
    }

    const planPrice = SUBSCRIPTION_PLAN_MAP[selectedPlan].monthlyPrice;
    setForm((prev) => ({
      ...prev,
      plan: selectedPlan,
      amount: planPrice.toFixed(2),
    }));
    setShowModal(true);
  }, [searchParams]);

  useEffect(() => {
    apiClient
      .get("/subscription-payments/")
      .then((res) => setPayments(res.data.results || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePayment = async () => {
    try {
      await apiClient.post("/subscription-payments/", form);
      toast.success("Payment submitted! Awaiting confirmation.");
      setShowModal(false);
      router.refresh();
    } catch (err) {
      toast.error("Failed");
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => router.push("/admin/subscription")}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">💳 Payments</h1>
              <p className="text-sm text-gray-500">
                Manage subscription payments
              </p>
            </div>
          </div>
          <Button icon={CreditCard} onClick={() => setShowModal(true)}>
            Make Payment
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="text-center">
            <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{payments.length}</p>
            <p className="text-xs text-gray-500">Total Payments</p>
          </Card>
          <Card className="text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {payments.filter((p) => p.status === "paid").length}
            </p>
            <p className="text-xs text-gray-500">Completed</p>
          </Card>
          <Card className="text-center">
            <Clock className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {payments.filter((p) => p.status === "pending").length}
            </p>
            <p className="text-xs text-gray-500">Pending</p>
          </Card>
        </div>

        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Transaction ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.plan}</td>
                    <td className="px-4 py-3">${p.amount}</td>
                    <td className="px-4 py-3">{p.payment_method}</td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {p.transaction_id || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={p.status === "paid" ? "success" : "warning"}
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.created_at?.split("T")[0]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Make Payment"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handlePayment}>Submit Payment</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="Plan"
              value={form.plan}
              onChange={(e) => {
                const price =
                  SUBSCRIPTION_PLAN_MAP[e.target.value]?.monthlyPrice || 0;
                setForm({
                  ...form,
                  plan: e.target.value,
                  amount: price.toFixed(2),
                });
              }}
              options={SUBSCRIPTION_PLANS.map((plan) => ({
                value: plan.id,
                label: `${plan.name} - $${plan.monthlyPrice.toFixed(2)}/mo`,
              }))}
            />
            <Input
              label="Amount ($)"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <Select
              label="Payment Method"
              value={form.payment_method}
              onChange={(e) =>
                setForm({ ...form, payment_method: e.target.value })
              }
              options={[
                { value: "bank", label: "Bank Transfer" },
                { value: "mobile", label: "Cash" },
              ]}
            />
            <Input
              label="Transaction ID"
              value={form.transaction_id}
              onChange={(e) =>
                setForm({ ...form, transaction_id: e.target.value })
              }
              placeholder="Enter reference number"
            />
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
