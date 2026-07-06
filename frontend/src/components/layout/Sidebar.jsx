"use client";

import { usePathname } from "next/navigation";
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
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Patients", href: "/patients", icon: Users },
        { name: "Appointments", href: "/appointments", icon: Calendar },
        { name: "Doctors", href: "/doctors", icon: Stethoscope },
        { name: "Billing", href: "/billing", icon: DollarSign },
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
          const isTrueSuperAdmin = isSuperuser && !isImpersonatingHospital;

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
    ,
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
      section: "MAIN",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Reception Desk", href: "/reception", icon: Activity },
        { name: "Register Patient", href: "/patients/add", icon: UserCog },
        { name: "All Patients", href: "/patients", icon: Users },
        { name: "Billing", href: "/billing", icon: DollarSign },
        { name: "Appointments", href: "/appointments", icon: Calendar },
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
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Pharmacy", href: "/pharmacy", icon: Pill },
        { name: "Medicines", href: "/admin/medicines", icon: Package },
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

export default function Sidebar({ collapsed, onToggle }) {
  const pathname = usePathname();
  const [role, setRole] = useState("admin");
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    if (storedRole) setRole(storedRole);
    const nav = navigationByRole[storedRole] || navigationByRole.admin;
    const sections = {};
    nav.forEach((s) => (sections[s.section] = true));
    setExpandedSections(sections);
  }, []);

  const navigation = navigationByRole[role] || navigationByRole.admin;

  return (
    <aside
      className={`fixed top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300 bg-gradient-to-b from-[#1a2744] to-[#0f1a2e] border-r border-[#2a3a5e] ${collapsed ? "w-20" : "w-64"}`}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-[#2a3a5e] flex-shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 overflow-hidden"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-base">M</span>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-white">MediCore</h1>
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
      <div className="p-3 border-t border-[#2a3a5e] flex-shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5"
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
