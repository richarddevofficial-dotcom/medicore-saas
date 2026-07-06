"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const roleAccess = {
  admin: ["*"], // Admin can access everything
  super_admin: ["*"],
  doctor: [
    "/dashboard",
    "/doctors/queue",
    "/patients",
    "/appointments",
    "/admin/lab",
    "/admin/medicines",
  ],
  receptionist: [
    "/dashboard",
    "/reception",
    "/patients",
    "/patients/add",
    "/appointments",
    "/doctors",
    "/billing",
  ],
  nurse: ["/dashboard", "/patients", "/admin/rooms", "/admin/beds"],
  pharmacist: ["/dashboard", "/pharmacy", "/admin/medicines"],
  lab_technician: ["/dashboard", "/admin/lab", "/patients"],
  accountant: ["/dashboard", "/billing", "/admin/insurance", "/admin/reports"],
  radiographer: ["/dashboard", "/admin/imaging", "/patients"],
};

export default function RoleGuard({ children }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("role") || "receptionist";
    const isSuperuser =
      localStorage.getItem("is_superuser") === "true" ||
      localStorage.getItem("is_superuser") === "True";
    const path = window.location.pathname;

    const allowedPaths = roleAccess[role] || [];

    // Admin or superuser can access everything
    if (
      role === "admin" ||
      role === "super_admin" ||
      isSuperuser ||
      allowedPaths.includes("*")
    ) {
      setAuthorized(true);
      return;
    }

    // Check if current path is allowed
    const isAllowed = allowedPaths.some(
      (p) => path === p || path.startsWith(p + "/"),
    );

    if (!isAllowed) {
      router.push("/dashboard");
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-orange-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-500">Checking access...</p>
        </div>
      </div>
    );
  }

  return children;
}
