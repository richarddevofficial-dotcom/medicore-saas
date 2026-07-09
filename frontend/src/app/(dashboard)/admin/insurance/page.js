"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import {
  useInsuranceCompanies,
  useInsuranceClaims,
} from "@/hooks/useInsurance";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Shield,
  Building2,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export default function InsurancePage() {
  const router = useRouter();
  const {
    data: companiesData,
    isLoading: loadingCompanies,
    refetch: refetchCompanies,
  } = useInsuranceCompanies();
  const {
    data: claimsData,
    isLoading: loadingClaims,
    refetch: refetchClaims,
  } = useInsuranceClaims();

  const [activeTab, setActiveTab] = useState("companies");
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [claimToApprove, setClaimToApprove] = useState(null);
  const [claimStatusFilter, setClaimStatusFilter] = useState("all");
  const [claimSearchTerm, setClaimSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [claimError, setClaimError] = useState("");
  const [approveError, setApproveError] = useState("");
  const [approveAmount, setApproveAmount] = useState("");

  const [companyForm, setCompanyForm] = useState({
    name: "",
    code: "",
    phone: "",
    email: "",
    coverage_percentage: "100",
  });
  const [billForm, setBillForm] = useState({
    patient_name: "",
    policy_number: "",
    company: "",
    claim_amount: "",
    description: "",
  });

  const companies = Array.isArray(companiesData) ? companiesData : [];
  const claims = Array.isArray(claimsData) ? claimsData : [];
  const claimStatusCounts = {
    all: claims.length,
    pending: claims.filter((c) => c.status === "pending").length,
    approved: claims.filter((c) => c.status === "approved").length,
    paid: claims.filter((c) => c.status === "paid").length,
    rejected: claims.filter((c) => c.status === "rejected").length,
  };
  const filteredClaims =
    claimStatusFilter === "all"
      ? claims
      : claims.filter((c) => c.status === claimStatusFilter);
  const searchedClaims = filteredClaims.filter((c) => {
    const query = claimSearchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      (c.patient_name || "").toLowerCase().includes(query) ||
      (c.policy_number || "").toLowerCase().includes(query) ||
      (c.company_name || "").toLowerCase().includes(query) ||
      String(c.company || "")
        .toLowerCase()
        .includes(query)
    );
  });

  const getErrorMessage = (err, fallback = "Failed") => {
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    if (data.error) return data.error;
    const firstKey = Object.keys(data)[0];
    const firstVal = firstKey ? data[firstKey] : null;
    if (Array.isArray(firstVal) && firstVal.length) return firstVal[0];
    if (typeof firstVal === "string") return firstVal;
    return fallback;
  };

  // Save Company to Database
  const handleSaveCompany = async () => {
    if (!companyForm.name.trim()) {
      setCompanyError("Company name is required");
      return;
    }
    if (!companyForm.code.trim()) {
      setCompanyError("Company code is required");
      return;
    }

    setCompanyError("");
    setIsSaving(true);
    try {
      const payload = {
        ...companyForm,
        name: companyForm.name.trim(),
        code: companyForm.code.trim(),
      };
      if (editing) {
        await apiClient.patch(`/insurance-companies/${editing.id}/`, payload);
        toast.success("Updated!");
      } else {
        await apiClient.post("/insurance-companies/", payload);
        toast.success("Added!");
      }
      setShowCompanyModal(false);
      setCompanyError("");
      setCompanyForm({
        name: "",
        code: "",
        phone: "",
        email: "",
        coverage_percentage: "100",
      });
      setEditing(null);
      refetchCompanies();
    } catch (err) {
      const message = getErrorMessage(err, "Failed to save");
      setCompanyError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Company
  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/insurance-companies/${id}/`);
      toast.success("Deleted!");
      refetchCompanies();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  // Toggle Status
  const handleToggleStatus = async (company) => {
    try {
      await apiClient.patch(`/insurance-companies/${company.id}/`, {
        is_active: !company.is_active,
      });
      toast.success("Status updated!");
      refetchCompanies();
    } catch (err) {
      toast.error("Failed");
    }
  };

  // Create Insurance Claim (Bill)
  const handleCreateClaim = async () => {
    if (!billForm.patient_name.trim() || !billForm.company) {
      setClaimError("Patient and company are required");
      return;
    }
    setClaimError("");
    setIsSaving(true);
    try {
      await apiClient.post("/insurance-claims/", {
        patient_name: billForm.patient_name.trim(),
        policy_number: billForm.policy_number.trim(),
        company: billForm.company,
        claim_amount: parseFloat(billForm.claim_amount || 0),
        description: billForm.description.trim(),
        status: "pending",
      });
      toast.success("Insurance claim created!");
      setShowBillModal(false);
      setClaimError("");
      setBillForm({
        patient_name: "",
        policy_number: "",
        company: "",
        claim_amount: "",
        description: "",
      });
      refetchClaims();
    } catch (err) {
      const message = getErrorMessage(err, "Failed to create claim");
      setClaimError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Update Claim Status
  const handleClaimUpdate = async (id, status) => {
    try {
      await apiClient.post(`/insurance-claims/${id}/update_status/`, {
        status,
      });
      toast.success("Claim updated!");
      refetchClaims();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed"));
    }
  };

  const openApproveModal = (claim) => {
    setClaimToApprove(claim);
    setApproveAmount(String(claim?.claim_amount || ""));
    setApproveError("");
    setShowApproveModal(true);
  };

  const handleApproveClaim = async () => {
    if (!claimToApprove) return;

    const parsedAmount = parseFloat(approveAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      setApproveError("Approved amount must be a valid number");
      return;
    }

    setApproveError("");
    setIsSaving(true);
    try {
      await apiClient.post(
        `/insurance-claims/${claimToApprove.id}/update_status/`,
        {
          status: "approved",
          approved_amount: parsedAmount,
        },
      );
      toast.success("Claim approved");
      setShowApproveModal(false);
      setClaimToApprove(null);
      setApproveAmount("");
      refetchClaims();
    } catch (err) {
      const message = getErrorMessage(err, "Failed to approve claim");
      setApproveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const loading = loadingCompanies || loadingClaims;
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
              onClick={() => router.push("/dashboard")}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">🛡️ Insurance</h1>
              <p className="text-sm text-gray-500">
                {companies.length} companies • {claims.length} claims
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {activeTab === "companies" && (
              <Button
                icon={Plus}
                onClick={() => {
                  setCompanyError("");
                  setEditing(null);
                  setCompanyForm({
                    name: "",
                    code: "",
                    phone: "",
                    email: "",
                    coverage_percentage: "100",
                  });
                  setShowCompanyModal(true);
                }}
              >
                Add Company
              </Button>
            )}
            {activeTab === "claims" && (
              <Button
                icon={FileText}
                onClick={() => {
                  setClaimError("");
                  setShowBillModal(true);
                }}
              >
                New Claim
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("companies")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "companies" ? "bg-white shadow-sm" : "text-gray-500"}`}
          >
            🏢 Companies ({companies.length})
          </button>
          <button
            onClick={() => setActiveTab("claims")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "claims" ? "bg-white shadow-sm" : "text-gray-500"}`}
          >
            📋 Claims ({claims.length})
          </button>
        </div>

        {/* Companies */}
        {activeTab === "companies" &&
          (companies.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500">
                No insurance companies. Add one!
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((c) => (
                <Card
                  key={c.id}
                  className={`relative ${!c.is_active ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <button onClick={() => handleToggleStatus(c)}>
                      <Badge variant={c.is_active ? "success" : "danger"}>
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3" />
                      Code: {c.code}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      {c.phone}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      {c.email}
                    </div>
                    <p>Coverage: {c.coverage_percentage}%</p>
                  </div>
                  <div className="absolute top-3 right-12 flex gap-1">
                    <button
                      onClick={() => {
                        setCompanyError("");
                        setEditing(c);
                        setCompanyForm({
                          name: c.name,
                          code: c.code,
                          phone: c.phone,
                          email: c.email,
                          coverage_percentage: String(c.coverage_percentage),
                        });
                        setShowCompanyModal(true);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ))}

        {/* Claims */}
        {activeTab === "claims" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: "All", value: claimStatusCounts.all },
                { label: "Pending", value: claimStatusCounts.pending },
                { label: "Approved", value: claimStatusCounts.approved },
                { label: "Paid", value: claimStatusCounts.paid },
                { label: "Rejected", value: claimStatusCounts.rejected },
              ].map((item) => (
                <Card key={item.label} className="text-center py-4">
                  <p className="text-xl font-bold">{item.value}</p>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {item.label}
                  </p>
                </Card>
              ))}
            </div>

            <div className="max-w-md">
              <input
                type="text"
                placeholder="Search patient, policy, or company..."
                value={claimSearchTerm}
                onChange={(e) => setClaimSearchTerm(e.target.value)}
                className="w-full rounded-lg border px-4 py-2 text-sm"
              />
            </div>

            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
              {[
                { id: "all", label: "All" },
                { id: "pending", label: "Pending" },
                { id: "approved", label: "Approved" },
                { id: "paid", label: "Paid" },
                { id: "rejected", label: "Rejected" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setClaimStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${claimStatusFilter === f.id ? "bg-white shadow-sm" : "text-gray-500"}`}
                >
                  {f.label} ({claimStatusCounts[f.id]})
                </button>
              ))}
            </div>

            {claims.length === 0 ? (
              <Card>
                <EmptyState
                  imageSrc="/images/empty-states/insurance-empty.svg"
                  imageAlt="No insurance claims"
                  title="No claims yet"
                  className="py-12"
                  titleClassName="text-base font-medium text-gray-500 mb-0"
                />
              </Card>
            ) : (
              <Card padding={false}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Patient
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Company
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Policy #
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Amount
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Approved
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Processed
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {searchedClaims.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-3 py-8 text-center text-gray-500 text-sm"
                          >
                            No claims match your filter
                          </td>
                        </tr>
                      )}
                      {searchedClaims.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-sm font-medium">
                            {c.patient_name}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {c.company_name || c.company}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {c.policy_number}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            $ {parseFloat(c.claim_amount || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {c.status === "approved" || c.status === "paid"
                              ? `$ ${parseFloat(c.approved_amount || 0).toLocaleString()}`
                              : "-"}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant={
                                c.status === "approved"
                                  ? "success"
                                  : c.status === "paid"
                                    ? "info"
                                    : c.status === "pending"
                                      ? "warning"
                                      : c.status === "rejected"
                                        ? "danger"
                                        : "default"
                              }
                            >
                              {c.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">
                            {c.processed_date
                              ? new Date(c.processed_date).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-3 py-3">
                            {c.status === "pending" && (
                              <div className="flex justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => openApproveModal(c)}
                                >
                                  ✓
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    handleClaimUpdate(c.id, "rejected")
                                  }
                                >
                                  ✗
                                </Button>
                              </div>
                            )}
                            {c.status === "approved" && (
                              <div className="flex justify-center">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() =>
                                    handleClaimUpdate(c.id, "paid")
                                  }
                                >
                                  Mark Paid
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Company Modal */}
        <Modal
          isOpen={showCompanyModal}
          onClose={() => {
            setShowCompanyModal(false);
            setCompanyError("");
          }}
          title={editing ? "Edit Company" : "Add Company"}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCompanyModal(false);
                  setCompanyError("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveCompany} isLoading={isSaving}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {companyError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {companyError}
              </div>
            )}
            <Input
              label="Company Name *"
              value={companyForm.name}
              onChange={(e) =>
                setCompanyForm({ ...companyForm, name: e.target.value })
              }
            />
            <Input
              label="Code"
              value={companyForm.code}
              onChange={(e) =>
                setCompanyForm({ ...companyForm, code: e.target.value })
              }
            />
            <Input
              label="Phone"
              value={companyForm.phone}
              onChange={(e) =>
                setCompanyForm({ ...companyForm, phone: e.target.value })
              }
            />
            <Input
              label="Email"
              value={companyForm.email}
              onChange={(e) =>
                setCompanyForm({ ...companyForm, email: e.target.value })
              }
            />
            <Input
              label="Coverage %"
              type="number"
              value={companyForm.coverage_percentage}
              onChange={(e) =>
                setCompanyForm({
                  ...companyForm,
                  coverage_percentage: e.target.value,
                })
              }
            />
          </div>
        </Modal>

        {/* Claim Modal */}
        <Modal
          isOpen={showBillModal}
          onClose={() => {
            setShowBillModal(false);
            setClaimError("");
          }}
          title="New Insurance Claim"
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowBillModal(false);
                  setClaimError("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateClaim} isLoading={isSaving}>
                Create Claim
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {claimError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {claimError}
              </div>
            )}
            <Input
              label="Patient Name *"
              value={billForm.patient_name}
              onChange={(e) =>
                setBillForm({ ...billForm, patient_name: e.target.value })
              }
            />
            <Select
              label="Insurance Company *"
              value={billForm.company}
              onChange={(e) =>
                setBillForm({ ...billForm, company: e.target.value })
              }
              options={[
                { value: "", label: "Select company..." },
                ...companies
                  .filter((c) => c.is_active)
                  .map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Input
              label="Policy Number *"
              value={billForm.policy_number}
              onChange={(e) =>
                setBillForm({ ...billForm, policy_number: e.target.value })
              }
            />
            <Input
              label="Claim Amount (USD) *"
              type="number"
              value={billForm.claim_amount}
              onChange={(e) =>
                setBillForm({ ...billForm, claim_amount: e.target.value })
              }
            />
            <Input
              label="Description"
              value={billForm.description}
              onChange={(e) =>
                setBillForm({ ...billForm, description: e.target.value })
              }
              placeholder="Reason for claim..."
            />
          </div>
        </Modal>

        {/* Approve Claim Modal */}
        <Modal
          isOpen={showApproveModal}
          onClose={() => {
            setShowApproveModal(false);
            setClaimToApprove(null);
            setApproveAmount("");
            setApproveError("");
          }}
          title="Approve Claim"
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowApproveModal(false);
                  setClaimToApprove(null);
                  setApproveAmount("");
                  setApproveError("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleApproveClaim} isLoading={isSaving}>
                Approve
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {approveError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {approveError}
              </div>
            )}
            <p className="text-sm text-gray-600">
              Patient:{" "}
              <span className="font-medium">
                {claimToApprove?.patient_name || "-"}
              </span>
            </p>
            <p className="text-sm text-gray-600">
              Requested:{" "}
              <span className="font-medium">
                ${" "}
                {parseFloat(claimToApprove?.claim_amount || 0).toLocaleString()}
              </span>
            </p>
            <Input
              label="Approved Amount *"
              type="number"
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
            />
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
