"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import useAuthStore from "@/stores/auth-store";

export default function Header({ branding, onMenuToggle }) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [hospitalName, setHospitalName] = useState(
    branding?.name || "MediCore",
  );
  const [userData, setUserData] = useState({});
  const [role, setRole] = useState("");
  const [logoIndex, setLogoIndex] = useState(0);

  const updateHeaderState = () => {
    let parsedHospital = null;
    let parsedUser = {};

    try {
      parsedHospital = JSON.parse(localStorage.getItem("hospital") || "null");
    } catch {
      parsedHospital = null;
    }

    try {
      parsedUser = JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      parsedUser = {};
    }

    const storedRole = localStorage.getItem("role") || "";
    const impersonatingHospitalId = sessionStorage.getItem(
      "impersonating_hospital_id",
    );

    // Prefer the active hospital context for hospital users and impersonation sessions.
    if (parsedHospital?.name) {
      setHospitalName(parsedHospital.name);
    } else if (storedRole === "super_admin" && !impersonatingHospitalId) {
      setHospitalName("MediCore");
    } else {
      setHospitalName(branding?.name || "MediCore");
    }
    setUserData(parsedUser);
    setRole(storedRole);
  };

  useEffect(() => {
    updateHeaderState();

    // Listen for storage changes (when another tab/window changes localStorage)
    const handleStorageChange = () => {
      updateHeaderState();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [branding?.name]);

  const primaryColor = branding?.primaryColor || "#F97316";
  const secondaryColor = branding?.secondaryColor || "#1E3A5F";
  const logoSources = [
    branding?.logoUrl,
    "/brand/medicorecloud-logo-compact.png",
    "/brand/logo-icon.svg",
  ].filter(Boolean);
  const activeLogo = logoSources[logoIndex] || "";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between h-16 px-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden h-9 w-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {!activeLogo ? (
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ring-1 ring-gray-200"
              style={{
                backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              }}
            >
              <span className="text-white text-xs font-bold tracking-wide">
                MC
              </span>
            </div>
          ) : (
            <div className="h-10 w-28 flex items-center justify-center">
              <img
                src={activeLogo}
                alt="MediCore"
                className="h-full w-full object-contain"
                onError={() => setLogoIndex((prev) => prev + 1)}
              />
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              {hospitalName}
            </h2>
            <p className="text-xs text-gray-400 capitalize">
              {role?.replace("_", " ")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-700">
              {userData?.first_name} {userData?.last_name}
            </p>
            <p className="text-xs text-gray-400">{userData?.email}</p>
          </div>
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shadow-md"
            style={{
              backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
            }}
          >
            <span className="text-white text-sm font-bold">
              {userData?.first_name?.[0]}
              {userData?.last_name?.[0]}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200 whitespace-nowrap"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
