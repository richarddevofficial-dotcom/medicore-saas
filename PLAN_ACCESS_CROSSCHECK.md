# Subscription Plan Module Access - Cross-Check Report

**Date:** 2026-07-26  
**Status:** ⚠️ ISSUE FOUND - Finance module not plan-restricted

---

## Current Plan Configuration

### Backend (Django)

**Subscription Plans:**

- `trial` - 14-Day Free Trial
- `basic` - Basic Plan (10 staff, 1,000 patients)
- `pro` - Professional (25 staff, 5,000 patients)
- `enterprise` - Enterprise (100+ staff, unlimited patients)

**Price:**

- Basic: $99.90/month
- Professional: $149.90/month
- Enterprise: $249.90/month

---

## Module Access by Plan (Frontend Route Restrictions)

### File: `frontend/src/lib/plan-access.js`

#### STARTER/BASIC/TRIAL - Allowed Routes

```
✓ Dashboard & Main
  - /dashboard
  - /admin
  - /patients (view/manage)
  - /appointments
  - /doctors
  - /reception
  - /billing
  - /lab
  - /pharmacy
  - /settings

✓ Admin Management
  - /admin/users
  - /admin/roles
  - /admin/departments
  - /admin/rooms
  - /admin/beds
  - /admin/medicines
  - /admin/lab
  - /admin/subscription
  - /admin/payment
  - /admin/settings

✓ Human Resources
  - /hr (all routes)
  - /hr/employees
  - /hr/attendance
  - /hr/leave-requests
  - /hr/shifts
  - etc.

❌ NOT INCLUDED
  - /admin/imaging
  - /admin/insurance
  - /admin/reports
  - /admin/inventory
  - /admin/logs
  - /finance (NOT RESTRICTED - see issue below)
```

#### PROFESSIONAL - Allowed Routes

```
✓ All STARTER/BASIC routes PLUS:
  - /admin/imaging
  - /admin/insurance
  - /admin/reports
  - /admin/inventory

❌ NOT INCLUDED
  - /admin/logs
  - /finance (NOT RESTRICTED - see issue below)
```

#### ENTERPRISE - Allowed Routes

```
✓ All PROFESSIONAL routes PLUS:
  - /admin/logs

✓ UNLIMITED everything
  - Unlimited staff
  - Unlimited patients
  - All features

⚠️ /finance routes NOT RESTRICTED by plan
   (See critical issue below)
```

---

## 🔴 CRITICAL ISSUE FOUND

### Finance Module Not Plan-Restricted

**Location:** `frontend/src/lib/plan-access.js`

**Problem:**

- Finance routes (`/finance`, `/finance/budgets`, `/finance/expenses`, `/finance/payroll`, etc.) are **NOT listed** in ANY plan's allowed routes
- This means:
  1. **Trial/Basic hospitals CAN access finance** (unintended)
  2. Finance module is completely unrestricted
  3. Not following plan-based access control pattern

**Expected Behavior:**
Finance module should be:

- **Starter/Basic:** ❌ NO ACCESS (too complex for small hospitals)
- **Professional:** ✅ FULL ACCESS (need budgets, expenses, payroll)
- **Enterprise:** ✅ FULL ACCESS (need advanced accounting)

**Current Behavior:**

- **Starter/Basic:** ✅ CAN ACCESS (WRONG)
- **Professional:** ✅ CAN ACCESS (Correct)
- **Enterprise:** ✅ CAN ACCESS (Correct)

---

## Recommended Fix

Add finance routes to `plan-access.js`:

```javascript
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
  // ADD FINANCE ROUTES HERE:
  "/finance",
  "/finance/*",
  "/finance/budgets",
  "/finance/budgets/*",
  "/finance/expenses",
  "/finance/expenses/*",
  "/finance/payroll",
  "/finance/payroll/*",
  "/finance/payroll-config",
  "/finance/payroll-config/*",
  "/finance/accounting",
  "/finance/accounting/*",
  "/finance/reports",
  "/finance/reports/*",
];
```

---

## Module Access Summary Table

| Module           | Starter | Professional | Enterprise |
| ---------------- | ------- | ------------ | ---------- |
| **Patients**     | ✅      | ✅           | ✅         |
| **Appointments** | ✅      | ✅           | ✅         |
| **Doctors**      | ✅      | ✅           | ✅         |
| **Billing**      | ✅      | ✅           | ✅         |
| **Lab**          | ✅      | ✅           | ✅         |
| **Pharmacy**     | ✅      | ✅           | ✅         |
| **HR**           | ✅      | ✅           | ✅         |
| **Users/Roles**  | ✅      | ✅           | ✅         |
| **Departments**  | ✅      | ✅           | ✅         |
| **Imaging**      | ❌      | ✅           | ✅         |
| **Insurance**    | ❌      | ✅           | ✅         |
| **Reports**      | ❌      | ✅           | ✅         |
| **Inventory**    | ❌      | ✅           | ✅         |
| **Finance**      | ⚠️      | ✅           | ✅         |
| **Audit Logs**   | ❌      | ❌           | ✅         |

---

## Backend Enforcement

Backend also has plan permission checks:

```python
# config/plan_permissions.py
class RequiresProPlan(RequiresHospitalPlan):
    allowed_plans = ("pro", "enterprise")

class RequiresEnterprisePlan(RequiresHospitalPlan):
    allowed_plans = ("enterprise",)
```

**Finding:** Backend restrictions are in place but may not be applied to all finance endpoints.

---

## Next Steps

1. Add finance routes to PRO plan in `plan-access.js`
2. Verify backend finance views have `@permission_classes([RequiresProPlan])`
3. Test that Starter hospitals get 403 when accessing finance APIs
4. Test that Professional hospitals can access finance fully
5. Update sidebar filtering to match
