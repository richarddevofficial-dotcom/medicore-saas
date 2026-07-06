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
  const [editing, setEditing] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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

  // Save Company to Database
  const handleSaveCompany = async () => {
    if (!companyForm.name) return toast.error("Name required");
    setIsSaving(true);
    try {
      if (editing) {
        await apiClient.patch(
          `/insurance-companies/${editing.id}/`,
          companyForm,
        );
        toast.success("Updated!");
      } else {
        await apiClient.post("/insurance-companies/", companyForm);
        toast.success("Added!");
      }
      setShowCompanyModal(false);
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
      toast.error("Failed to save");
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
    if (!billForm.patient_name || !billForm.company)
      return toast.error("Patient and company required");
    setIsSaving(true);
    try {
      await apiClient.post("/insurance-claims/", {
        patient_name: billForm.patient_name,
        policy_number: billForm.policy_number,
        company: billForm.company,
        claim_amount: parseFloat(billForm.claim_amount || 0),
        description: billForm.description,
        status: "pending",
      });
      toast.success("Insurance claim created!");
      setShowBillModal(false);
      setBillForm({
        patient_name: "",
        policy_number: "",
        company: "",
        claim_amount: "",
        description: "",
      });
      refetchClaims();
    } catch (err) {
      toast.error("Failed to create claim");
    } finally {
      setIsSaving(false);
    }
  };

  // Update Claim Status
  const handleClaimUpdate = async (id, status) => {
    try {
      await apiClient.patch(`/insurance-claims/${id}/`, { status });
      toast.success("Claim updated!");
      refetchClaims();
    } catch (err) {
      toast.error("Failed");
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
              <Button icon={FileText} onClick={() => setShowBillModal(true)}>
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
        {activeTab === "claims" &&
          (claims.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500">
                No claims yet
              </div>
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
                        Status
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {claims.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm font-medium">
                          {c.patient_name}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {c.company_name || c.company}
                        </td>
                        <td className="px-3 py-3 text-sm">{c.policy_number}</td>
                        <td>
                          $ {parseFloat(c.claim_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant={
                              c.status === "approved"
                                ? "success"
                                : c.status === "pending"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          {c.status === "pending" && (
                            <div className="flex justify-center gap-1">
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() =>
                                  handleClaimUpdate(c.id, "approved")
                                }
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

        {/* Company Modal */}
        <Modal
          isOpen={showCompanyModal}
          onClose={() => setShowCompanyModal(false)}
          title={editing ? "Edit Company" : "Add Company"}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowCompanyModal(false)}
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
          onClose={() => setShowBillModal(false)}
          title="New Insurance Claim"
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowBillModal(false)}
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
      </div>
    </DashboardLayout>
  );
}
