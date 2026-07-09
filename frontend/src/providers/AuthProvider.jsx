"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export default function AuthProvider({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    const pathname = window.location.pathname;
    const isPublicRoute = publicRoutes.includes(pathname);

    if (!token && !isPublicRoute) {
      router.push("/login");
    } else {
      setChecking(false);
    }
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-orange-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return children;
}
