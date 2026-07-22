const BASIC_ROUTE_PATTERNS = [
  "/admin",
  "/dashboard",
  "/dashboard/*",
  "/patients",
  "/patients/*",
  "/appointments",
  "/appointments/*",
  "/doctors",
  "/doctors/*",
  "/reception",
  "/reception/*",
  "/billing",
  "/billing/*",
  "/lab",
  "/lab/*",
  "/pharmacy",
  "/pharmacy/*",
  "/settings",
  "/settings/*",
  "/admin/users",
  "/admin/users/*",
  "/admin/roles",
  "/admin/roles/*",
  "/admin/departments",
  "/admin/departments/*",
  "/admin/rooms",
  "/admin/rooms/*",
  "/admin/beds",
  "/admin/beds/*",
  "/admin/medicines",
  "/admin/medicines/*",
  "/admin/lab",
  "/admin/lab/*",
  "/admin/subscription",
  "/admin/subscription/*",
  "/admin/payment",
  "/admin/payment/*",
  "/admin/settings",
  "/admin/settings/*",
  "/hr",
  "/hr/*",
];

const PRO_ROUTE_PATTERNS = [
  ...BASIC_ROUTE_PATTERNS,
  "/admin/imaging",
  "/admin/imaging/*",
  "/admin/insurance",
  "/admin/insurance/*",
  "/admin/reports",
  "/admin/reports/*",
  "/admin/inventory",
  "/admin/inventory/*",
];

const ENTERPRISE_ROUTE_PATTERNS = [
  ...PRO_ROUTE_PATTERNS,
  "/admin/logs",
  "/admin/logs/*",
];

const PLAN_ROUTE_PATTERNS = {
  trial: BASIC_ROUTE_PATTERNS,
  basic: BASIC_ROUTE_PATTERNS,
  pro: PRO_ROUTE_PATTERNS,
  enterprise: ENTERPRISE_ROUTE_PATTERNS,
};

const ALWAYS_ALLOWED_ROUTE_PATTERNS = ["/super-admin", "/super-admin/*"];

export function normalizePlan(plan) {
  const normalized = (plan || "trial").toLowerCase();
  return PLAN_ROUTE_PATTERNS[normalized] ? normalized : "trial";
}

function matchesPattern(pathname, pattern) {
  if (pattern.endsWith("/*")) {
    const base = pattern.slice(0, -2);
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  return pathname === pattern;
}

export function isRouteAllowedForPlan(pathname, plan) {
  if (!pathname) return true;
  if (
    ALWAYS_ALLOWED_ROUTE_PATTERNS.some((pattern) =>
      matchesPattern(pathname, pattern),
    )
  ) {
    return true;
  }
  const normalizedPlan = normalizePlan(plan);
  const patterns = PLAN_ROUTE_PATTERNS[normalizedPlan] || [];
  return patterns.some((pattern) => matchesPattern(pathname, pattern));
}

export function getStoredHospitalPlan() {
  if (typeof window === "undefined") return "trial";
  const rawHospital = localStorage.getItem("hospital");
  if (!rawHospital) return "trial";
  try {
    const hospital = JSON.parse(rawHospital);
    return normalizePlan(hospital?.subscription_plan);
  } catch {
    return "trial";
  }
}

export function filterNavigationByPlan(navigationSections, plan) {
  return navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        isRouteAllowedForPlan(item.href, plan),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
