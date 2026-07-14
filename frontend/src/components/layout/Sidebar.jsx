"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Building2,
  Bed,
  Pill,
  FlaskConical,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCog,
  FileText,
  ChevronDown,
  Camera,
  Shield,
  Database,
  Activity,
  DollarSign,
  Receipt,
  Package,
  Crown,
  CreditCard,
} from "lucide-react";

const navigationByRole = {
  admin: [
    {
      section: "MAIN",
      items: [
        { name: "Admin Dashboard", href: "/admin", icon: LayoutDashboard },
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Patients", href: "/patients", icon: Users },
        { name: "Appointments", href: "/appointments", icon: Calendar },
        { name: "Doctors", href: "/doctors", icon: Stethoscope },
        { name: "Billing", href: "/billing", icon: DollarSign },
        { name: "Service Fees", href: "/admin/services", icon: Receipt },
      ],
    },
    {
      section: "MANAGEMENT",
      items: [
        { name: "Manage Users", href: "/admin/users", icon: UserCog },
        { name: "Manage Roles", href: "/admin/roles", icon: Shield },
        { name: "Departments", href: "/admin/departments", icon: Building2 },
        { name: "Rooms & Wards", href: "/admin/rooms", icon: Bed },
        { name: "Pharmacy", href: "/admin/medicines", icon: Pill },
        { name: "Laboratory", href: "/admin/lab", icon: FlaskConical },
        { name: "Imaging", href: "/admin/imaging", icon: Camera },
        { name: "Insurance", href: "/admin/insurance", icon: Shield },
        { name: "Inventory", href: "/admin/inventory", icon: Package },
        { name: "Bed Management", href: "/admin/beds", icon: Bed },
      ],
    },
    {
      section: "REPORTS",
      items: [
        { name: "Reports", href: "/admin/reports", icon: FileText },
        { name: "Audit Logs", href: "/admin/logs", icon: Database },
      ],
    },
    {
      section: "SYSTEM",
      items: (() => {
        const items = [
          { name: "Subscription", href: "/admin/subscription", icon: Crown },
          { name: "Payments", href: "/admin/payment", icon: CreditCard },
          {
            name: "Billing & Subscription",
            href: "/settings/billing",
            icon: CreditCard,
          },
        ];
        // Only show Super Admin for the true super-admin context.
        if (typeof window !== "undefined") {
          const storedRole = localStorage.getItem("role");
          const isSuperuser =
            localStorage.getItem("is_superuser") === "true" ||
            localStorage.getItem("is_superuser") === "True";
          const isImpersonatingHospital = sessionStorage.getItem(
            "impersonating_hospital_id",
          );
          const isTrueSuperAdmin =
            storedRole === "super_admin" &&
            isSuperuser &&
            !isImpersonatingHospital;

          if (isTrueSuperAdmin) {
            items.push({
              name: "Super Admin",
              href: "/super-admin",
              icon: Shield,
            });
          }
        }
        items.push({
          name: "Settings",
          href: "/admin/settings",
          icon: Settings,
        });
        return items;
      })(),
    },
  ],
  super_admin: [
    {
      section: "MAIN",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Patients", href: "/patients", icon: Users },
        { name: "Appointments", href: "/appointments", icon: Calendar },
        { name: "Doctors", href: "/doctors", icon: Stethoscope },
        { name: "Billing", href: "/billing", icon: DollarSign },
        { name: "Service Fees", href: "/admin/services", icon: Receipt },
      ],
    },
    {
      section: "MANAGEMENT",
      items: [
        { name: "Manage Users", href: "/admin/users", icon: UserCog },
        { name: "Manage Roles", href: "/admin/roles", icon: Shield },
        { name: "Departments", href: "/admin/departments", icon: Building2 },
        { name: "Rooms & Wards", href: "/admin/rooms", icon: Bed },
        { name: "Pharmacy", href: "/admin/medicines", icon: Pill },
        { name: "Service Fees", href: "/admin/services", icon: Receipt },
        { name: "Laboratory", href: "/admin/lab", icon: FlaskConical },
        { name: "Imaging", href: "/admin/imaging", icon: Camera },
        { name: "Insurance", href: "/admin/insurance", icon: Shield },
        { name: "Inventory", href: "/admin/inventory", icon: Package },
        { name: "Bed Management", href: "/admin/beds", icon: Bed },
      ],
    },
    {
      section: "REPORTS",
      items: [
        { name: "Reports", href: "/admin/reports", icon: FileText },
        { name: "Audit Logs", href: "/admin/logs", icon: Database },
      ],
    },
    {
      section: "SYSTEM",
      items: [
        { name: "Subscription", href: "/admin/subscription", icon: Crown },
        { name: "Payments", href: "/admin/payment", icon: CreditCard },
        {
          name: "Billing & Subscription",
          href: "/settings/billing",
          icon: CreditCard,
        },
        { name: "Super Admin", href: "/super-admin", icon: Shield },
        { name: "Settings", href: "/admin/settings", icon: Settings },
      ],
    },
  ],
  doctor: [
    {
      section: "MAIN",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "My Patients", href: "/doctors/queue", icon: Users },
        { name: "All Patients", href: "/patients", icon: Users },
        { name: "Appointments", href: "/appointments", icon: Calendar },
      ],
    },
  ],
  receptionist: [
    {
      section: "FRONT DESK",
      items: [
        { name: "Reception Dashboard", href: "/reception", icon: Activity },
        { name: "Register Patient", href: "/patients/add", icon: UserCog },
        { name: "Appointments", href: "/appointments", icon: Calendar },
        { name: "Billing & Payments", href: "/billing", icon: DollarSign },
      ],
    },
    {
      section: "PATIENT FLOW",
      items: [
        { name: "All Patients", href: "/patients", icon: Users },
        { name: "Doctors", href: "/doctors", icon: Stethoscope },
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
  ],
  nurse: [
    {
      section: "MAIN",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Patients", href: "/patients", icon: Users },
        { name: "Rooms & Wards", href: "/admin/rooms", icon: Bed },
        { name: "Bed Management", href: "/admin/beds", icon: Bed },
      ],
    },
  ],
  pharmacist: [
    {
      section: "MAIN",
      items: [
        {
          name: "Pharmacy Dashboard",
          href: "/pharmacy",
          icon: LayoutDashboard,
        },
        { name: "Medicines", href: "/admin/medicines", icon: Package },
        { name: "Inventory", href: "/admin/inventory", icon: Package },
        { name: "POS", href: "/pharmacy/pos", icon: Receipt },
      ],
    },
  ],
  lab_technician: [
    {
      section: "MAIN",
      items: [
        { name: "Lab Dashboard", href: "/lab", icon: FlaskConical },
        { name: "All Tests", href: "/admin/lab", icon: FileText },
        { name: "Patients", href: "/patients", icon: Users },
      ],
    },
  ],
  radiographer: [
    {
      section: "MAIN",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Imaging", href: "/admin/imaging", icon: Camera },
        { name: "Patients", href: "/patients", icon: Users },
      ],
    },
  ],
  accountant: [
    {
      section: "MAIN",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Billing", href: "/billing", icon: DollarSign },
        { name: "Insurance", href: "/admin/insurance", icon: Shield },
        { name: "Reports", href: "/admin/reports", icon: FileText },
      ],
    },
  ],
};

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen = false,
  onCloseMobile,
  branding,
}) {
  const [pathname, setPathname] = useState("");
  const [role, setRole] = useState("admin");
  const [expandedSections, setExpandedSections] = useState({});
  const [logoIndex, setLogoIndex] = useState(0);

  const logoSources = [
    branding?.logoUrl,
    "/brand/hospital-default-logo.svg",
    "/brand/logo-light.svg",
  ].filter(Boolean);

  const activeLogo = logoSources[logoIndex] || "";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updatePathname = () => setPathname(window.location.pathname || "");
    updatePathname();

    window.addEventListener("popstate", updatePathname);

    return () => {
      window.removeEventListener("popstate", updatePathname);
    };
  }, []);

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    if (storedRole) setRole(storedRole);
    const nav = navigationByRole[storedRole] || navigationByRole.admin;
    const sections = {};
    nav.forEach((s) => (sections[s.section] = true));
    setExpandedSections(sections);
  }, [pathname]);

  const navigation = navigationByRole[role] || navigationByRole.admin;

  return (
    <aside
      className={`fixed top-0 left-0 z-50 h-screen flex flex-col bg-gradient-to-b from-[#1a2744] to-[#0f1a2e] border-r border-[#2a3a5e] transition-all duration-300 transform w-72 sm:w-80 ${collapsed ? "lg:w-20" : "lg:w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-[#2a3a5e] flex-shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 overflow-hidden"
        >
          {!activeLogo ? (
            <div className="h-10 w-10 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm tracking-wide">
                MC
              </span>
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0 p-1">
              <img
                src={activeLogo}
                alt="MediCore"
                className="h-full w-full object-contain"
                onError={() => setLogoIndex((prev) => prev + 1)}
              />
            </div>
          )}
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold tracking-wide text-white">
                MediCore
              </h1>
              <p className="text-[10px] text-gray-400">HMS Platform</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {navigation.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <button
                onClick={() =>
                  setExpandedSections((prev) => ({
                    ...prev,
                    [section.section]: !prev[section.section],
                  }))
                }
                className="flex items-center justify-between w-full px-3 mb-2 text-[10px] font-semibold text-gray-500 tracking-wider hover:text-gray-300"
              >
                <span>{section.section}</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${expandedSections[section.section] ? "rotate-180" : ""}`}
                />
              </button>
            )}
            {(collapsed || expandedSections[section.section]) && (
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => {
                          setPathname(item.href);
                          onCloseMobile?.();
                        }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                        title={collapsed ? item.name : undefined}
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-orange-400" : "text-gray-500"}`}
                        />
                        {!collapsed && <span>{item.name}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#2a3a5e] flex-shrink-0 hidden lg:block">
        <button
          type="button"
          onClick={onToggle}
          className="relative z-10 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
