"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Plus, Trash2, Edit, Eye } from "lucide-react";
import { getSalaryStructures, deleteSalaryStructure } from "@/lib/api/finance";
import toast from "react-hot-toast";

export default function SalaryStructuresPage() {
  const [structures, setStructures] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadStructures();
  }, []);

  async function loadStructures() {
    try {
      setLoading(true);
      setError("");

      const data = await getSalaryStructures();
      setStructures(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load salary structures.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this salary structure?"))
      return;

    try {
      setDeleting(id);
      await deleteSalaryStructure(id);
      setStructures((prev) => prev.filter((s) => s.id !== id));
      toast.success("Salary structure deleted successfully");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to delete salary structure",
      );
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading salary structures...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/finance"
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Finance
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            Salary Structures
          </h1>
          <p className="mt-2 text-gray-600">
            Configure salary components and structures
          </p>
        </div>
        <Link href="/finance/payroll-config/structures/new">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <Plus size={18} />
            New Structure
          </button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Unable to load structures</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {structures.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
          <p className="text-gray-600">No salary structures created yet</p>
          <Link href="/finance/payroll-config/structures/new">
            <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
              Create your first structure
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {structures.map((structure) => (
            <div
              key={structure.id}
              className="rounded-lg border bg-white p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {structure.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {structure.description}
                  </p>
                  <div className="mt-3 flex gap-4 flex-wrap">
                    {structure.allowances &&
                      structure.allowances.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Allowances</p>
                          <p className="font-semibold text-gray-900">
                            {structure.allowances.length} types
                          </p>
                        </div>
                      )}
                    {structure.deductions &&
                      structure.deductions.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Deductions</p>
                          <p className="font-semibold text-gray-900">
                            {structure.deductions.length} types
                          </p>
                        </div>
                      )}
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <p
                        className={`font-semibold ${structure.is_active ? "text-green-600" : "text-gray-500"}`}
                      >
                        {structure.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Link
                    href={`/finance/payroll-config/structures/${structure.id}`}
                  >
                    <button className="p-2 text-gray-600 hover:text-blue-600">
                      <Eye size={18} />
                    </button>
                  </Link>
                  <Link
                    href={`/finance/payroll-config/structures/${structure.id}/edit`}
                  >
                    <button className="p-2 text-gray-600 hover:text-blue-600">
                      <Edit size={18} />
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(structure.id)}
                    disabled={deleting === structure.id}
                    className="p-2 text-gray-600 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
