# MediCore SaaS - Comprehensive RBAC Audit Report

**Generated:** 2026-07-25

---

## Executive Summary

This audit examines the Role-Based Access Control (RBAC) system across the MediCore SaaS platform, comparing frontend and backend implementations. **CRITICAL FINDINGS: 7 roles exist in frontend but NOT in backend staff model, and frontend/backend permission schemes use different case conventions (lowercase vs UPPERCASE).**

---

## 1. Roles Summary

### Roles in RoleGuard (Frontend - 15 roles)

`admin`, `super_admin`, `doctor`, `receptionist`, `nurse`, `pharmacist`, `lab_technician`, `radiographer`, `accountant`, `finance`, `finance_manager`, `cashier`, `hr_manager`, `hr_officer`, `hr`

### Roles in Sidebar (Frontend - 15 roles)

`admin`, `super_admin`, `doctor`, `receptionist`, `nurse`, `pharmacist`, `lab_technician`, `radiographer`, `accountant`, `finance`, `finance_manager`, `cashier`, `hr_manager`, `hr_officer`, `hr`

### Roles in Backend Staff Model (8 roles)

`admin`, `doctor`, `nurse`, `receptionist`, `pharmacist`, `lab_technician`, `radiographer`, `accountant`

### Backend Permission Classes (using uppercase)

- **IsHRUser**: Allows `HR`, `HR_MANAGER`, `HR_OFFICER`, `ADMIN`, `HOSPITAL_ADMIN`, `SUPER_ADMIN`
- **IsHRManager**: Allows `HR_MANAGER`, `ADMIN`, `HOSPITAL_ADMIN`, `SUPER_ADMIN`
- **IsFinanceUser**: Allows `finance`, `finance_manager`, `accountant`, `cashier`
- **IsFinanceManager**: Allows `finance_manager`, `accountant`

---

## 2. Role-by-Role Access Matrix

| Role                | Frontend Routes                                                                                                                                                                                               | Sidebar Items                                                                                                                                                                                                               | Backend Permissions                      | Backend API Permissions                                                     | Issues                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| **admin**           | `*` (all routes)                                                                                                                                                                                              | Full access to all sections: MAIN, MANAGEMENT, INPATIENT CARE, FINANCE, HUMAN RESOURCES, REPORTS, SYSTEM                                                                                                                    | Defined in staff model                   | Uses `IsAuthenticated` - no role check                                      | ✓ Consistent                                            |
| **super_admin**     | `*` (all routes)                                                                                                                                                                                              | Full access to all sections + Super Admin, Platform Dashboard                                                                                                                                                               | NOT in staff model (Django is_superuser) | Uses `IsAdminUser` decorator                                                | ⚠️ Not in staff model                                   |
| **doctor**          | `/dashboard`, `/doctors/queue`, `/patients`, `/appointments`, `/admin/lab`, `/admin/medicines`                                                                                                                | My Patients, All Patients, Appointments                                                                                                                                                                                     | Defined in staff model                   | Used in IPD views (READ_ROLES, CLINICAL_ROLES)                              | ✓ Consistent                                            |
| **receptionist**    | `/dashboard`, `/reception`, `/patients`, `/patients/add`, `/appointments`, `/doctors`, `/billing`                                                                                                             | Reception Dashboard, Register Patient, Appointments, Billing, Admissions, Patient Flow                                                                                                                                      | Defined in staff model                   | Used in IPD views (READ_ROLES, ADMISSION_ROLES)                             | ✓ Consistent                                            |
| **nurse**           | `/dashboard`, `/patients`, `/admin/rooms`, `/admin/beds`                                                                                                                                                      | Dashboard, Patients, Rooms & Wards, Bed Management                                                                                                                                                                          | Defined in staff model                   | Used in IPD views (READ_ROLES, CLINICAL_ROLES)                              | ✓ Consistent                                            |
| **pharmacist**      | `/dashboard`, `/pharmacy`, `/pharmacy/pos`, `/admin/medicines`, `/admin/inventory`                                                                                                                            | Pharmacy Dashboard, Medicines, Inventory, POS                                                                                                                                                                               | Defined in staff model                   | Not explicitly used in permission classes                                   | ✓ Consistent but limited backend                        |
| **lab_technician**  | `/dashboard`, `/admin/lab`, `/patients`                                                                                                                                                                       | Lab Dashboard, All Tests, Patients                                                                                                                                                                                          | Defined in staff model                   | Not explicitly used in permission classes                                   | ✓ Consistent but limited backend                        |
| **radiographer**    | `/dashboard`, `/admin/imaging`, `/patients`                                                                                                                                                                   | Dashboard, Imaging, Patients                                                                                                                                                                                                | Defined in staff model                   | Not explicitly used in permission classes                                   | ✓ Consistent but limited backend                        |
| **accountant**      | `/dashboard`, `/finance`, `/finance/budgets`, `/finance/expenses`, `/finance/payroll`, `/finance/payroll-config`, `/finance/accounting`, `/finance/reports`, `/billing`, `/admin/insurance`, `/admin/reports` | Finance Dashboard, Budgets, Expenses, Payroll, Payroll Config, Chart of Accounts, Journal Entries, Financial Reports, Dashboard, Billing, Insurance, Reports                                                                | Defined in staff model                   | `IsFinanceUser` - included in FINANCE_ROLE_NAMES                            | ✓ Consistent                                            |
| **finance**         | `/dashboard`, `/finance`, `/finance/budgets`, `/finance/expenses`, `/finance/payroll`, `/finance/payroll-config`, `/finance/accounting`, `/finance/reports`, `/billing`, `/admin/reports`                     | Finance Dashboard, Budgets, Expenses, Payroll, Payroll Config, Chart of Accounts, Journal Entries, Financial Reports                                                                                                        | NOT in staff model                       | `IsFinanceUser` - included in FINANCE_ROLE_NAMES                            | ⚠️ Not in staff model but in permissions                |
| **finance_manager** | `/dashboard`, `/finance`, `/finance/budgets`, `/finance/expenses`, `/finance/payroll`, `/finance/payroll-config`, `/finance/accounting`, `/finance/reports`, `/billing`, `/admin/reports`                     | Finance Dashboard, Budgets, Expenses, Payroll, Payroll Config, Chart of Accounts, Journal Entries, Financial Reports                                                                                                        | NOT in staff model                       | `IsFinanceManager` - included in FINANCE_MANAGER_ROLE_NAMES                 | ⚠️ Not in staff model but in permissions                |
| **cashier**         | `/dashboard`, `/billing`, `/finance/payroll`                                                                                                                                                                  | Dashboard, Billing, Insurance, Reports                                                                                                                                                                                      | NOT in staff model                       | `IsFinanceUser` - included in FINANCE_ROLE_NAMES; `READ_ROLES` in IPD views | ⚠️ Not in staff model but referenced in multiple places |
| **hr_manager**      | `/dashboard`, `/hr`, `/admin/departments`, `/finance`, `/finance/payroll`                                                                                                                                     | Finance section: Finance Dashboard, Payroll, Payroll Config, Budgets, Expenses, Financial Reports; HR section: HR Dashboard, Employees, Add Employee, Positions, Contracts, Attendance, Leave Requests, Shifts, Departments | NOT in staff model                       | `IsHRManager` permission class (uppercase `HR_MANAGER`)                     | ⚠️ Not in staff model but in permissions                |
| **hr_officer**      | `/dashboard`, `/hr`                                                                                                                                                                                           | HR Dashboard, Employees, Attendance, Leave Requests, Shifts                                                                                                                                                                 | NOT in staff model                       | `IsHRUser` permission class (uppercase `HR_OFFICER`)                        | ⚠️ Not in staff model but in permissions                |
| **hr**              | `/dashboard`, `/hr`                                                                                                                                                                                           | HR Dashboard, Employees, Attendance, Leave Requests                                                                                                                                                                         | NOT in staff model                       | `IsHRUser` permission class (uppercase `HR`)                                | ⚠️ Not in staff model but in permissions                |

---

## 3. Route/Feature Access Analysis

### Admin Routes (`/admin/*`)

| Route                 | admin | super_admin | doctor | receptionist | nurse | pharmacist | lab_technician | radiographer | accountant | finance | finance_manager | cashier | hr_manager | hr_officer | hr  |
| --------------------- | ----- | ----------- | ------ | ------------ | ----- | ---------- | -------------- | ------------ | ---------- | ------- | --------------- | ------- | ---------- | ---------- | --- |
| `/admin`              | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/users`        | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/roles`        | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/departments`  | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✓          | ✗          | ✗   |
| `/admin/rooms`        | ✓     | ✓           | ✗      | ✗            | ✓     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/beds`         | ✓     | ✓           | ✗      | ✗            | ✓     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/medicines`    | ✓     | ✓           | ✓      | ✗            | ✗     | ✓          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/lab`          | ✓     | ✓           | ✓      | ✗            | ✗     | ✗          | ✓              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/imaging`      | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✓            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/insurance`    | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✓          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/inventory`    | ✓     | ✓           | ✗      | ✗            | ✗     | ✓          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/reports`      | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✓          | ✓       | ✓               | ✗       | ✗          | ✗          | ✗   |
| `/admin/services`     | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/admin/subscription` | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |

### Finance Routes (`/finance/*`)

| Route                     | admin | super_admin | doctor | receptionist | nurse | pharmacist | lab_technician | radiographer | accountant | finance | finance_manager | cashier | hr_manager | hr_officer | hr  |
| ------------------------- | ----- | ----------- | ------ | ------------ | ----- | ---------- | -------------- | ------------ | ---------- | ------- | --------------- | ------- | ---------- | ---------- | --- |
| `/finance`                | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✓          | ✓       | ✓               | ✗       | ✓          | ✗          | ✗   |
| `/finance/budgets`        | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✓          | ✓       | ✓               | ✗       | ✓          | ✗          | ✗   |
| `/finance/expenses`       | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✓          | ✓       | ✓               | ✗       | ✓          | ✗          | ✗   |
| `/finance/payroll`        | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✓          | ✓       | ✓               | ✓       | ✓          | ✗          | ✗   |
| `/finance/payroll-config` | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✓          | ✓       | ✓               | ✗       | ✓          | ✗          | ✗   |
| `/finance/accounting`     | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✓          | ✓       | ✓               | ✗       | ✗          | ✗          | ✗   |
| `/finance/reports`        | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✓          | ✓       | ✓               | ✗       | ✓          | ✗          | ✗   |

### HR Routes (`/hr/*`)

| Route                | admin | super_admin | doctor | receptionist | nurse | pharmacist | lab_technician | radiographer | accountant | finance | finance_manager | cashier | hr_manager | hr_officer | hr  |
| -------------------- | ----- | ----------- | ------ | ------------ | ----- | ---------- | -------------- | ------------ | ---------- | ------- | --------------- | ------- | ---------- | ---------- | --- |
| `/hr`                | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✓          | ✓          | ✓   |
| `/hr/employees`      | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✓          | ✓          | ✓   |
| `/hr/employees/new`  | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✓          | ✗          | ✗   |
| `/hr/positions`      | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✓          | ✗          | ✗   |
| `/hr/contracts`      | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✓          | ✗          | ✗   |
| `/hr/attendance`     | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✓          | ✓          | ✓   |
| `/hr/leave-requests` | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✓          | ✓          | ✓   |
| `/hr/shifts`         | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✓          | ✓          | ✓   |

### Other Routes

| Route           | admin | super_admin | doctor | receptionist | nurse | pharmacist | lab_technician | radiographer | accountant | finance | finance_manager | cashier | hr_manager | hr_officer | hr  |
| --------------- | ----- | ----------- | ------ | ------------ | ----- | ---------- | -------------- | ------------ | ---------- | ------- | --------------- | ------- | ---------- | ---------- | --- |
| `/dashboard`    | ✓     | ✓           | ✓      | ✓            | ✓     | ✓          | ✓              | ✓            | ✓          | ✓       | ✓               | ✓       | ✓          | ✓          | ✓   |
| `/patients`     | ✓     | ✓           | ✓      | ✓            | ✓     | ✗          | ✓              | ✓            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/appointments` | ✓     | ✓           | ✓      | ✓            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |
| `/billing`      | ✓     | ✓           | ✗      | ✓            | ✗     | ✗          | ✗              | ✗            | ✓          | ✓       | ✓               | ✓       | ✗          | ✗          | ✗   |
| `/ipd`          | ✓     | ✓           | ✗      | ✗            | ✗     | ✗          | ✗              | ✗            | ✗          | ✗       | ✗               | ✗       | ✗          | ✗          | ✗   |

---

## 4. Critical Issues and Mismatches

### Issue 1: **7 Roles NOT in Backend Staff Model** ⚠️ CRITICAL

- **Roles**: `super_admin`, `finance`, `finance_manager`, `cashier`, `hr_manager`, `hr_officer`, `hr`
- **Impact**: Cannot create users with these roles via staff profile
- **Root Cause**: These roles only exist in permission classes and frontend, not in Django model choices
- **Location**: `backend/staff/models.py` lines 7-18
- **Recommendation**: Either:
  1. Add these roles to StaffProfile.ROLES choices, OR
  2. Create a migration to extend role support, OR
  3. Use Django groups for these roles instead of staff profile roles

### Issue 2: **Case Sensitivity Mismatch** ⚠️ HIGH

- **Problem**: Backend permission classes use UPPERCASE roles (e.g., `HR_MANAGER`, `HR_OFFICER`) but frontend uses lowercase (e.g., `hr_manager`, `hr_officer`)
- **Locations**:
  - `backend/human_resources/permissions.py` lines 30-35: Uses uppercase
  - `backend/finance/accounting_permissions.py` lines 4-18: Uses lowercase
  - `frontend/src/components/auth/RoleGuard.jsx`: Uses lowercase
- **Impact**: Potential authorization bypass if role comparison is case-sensitive
- **Recommendation**: Standardize to lowercase throughout backend

### Issue 3: **Finance Roles Not in Staff Model** ⚠️ HIGH

- **Roles**: `finance`, `finance_manager`, `cashier`
- **Status**: Only exist in `backend/finance/accounting_permissions.py` permission classes
- **Locations**:
  - Defined in: `FINANCE_ROLE_NAMES` and `FINANCE_MANAGER_ROLE_NAMES` (line 4-18)
  - Used in: `IsFinanceUser` and `IsFinanceManager` permission classes
- **Impact**: Cannot assign these roles to staff users
- **Recommendation**: Add to staff model or implement alternative role system

### Issue 4: **HR Roles Not in Staff Model** ⚠️ HIGH

- **Roles**: `hr`, `hr_manager`, `hr_officer`
- **Status**: Only exist in `backend/human_resources/permissions.py` permission classes
- **Locations**:
  - Defined in: `IsHRUser.allowed_roles` and `IsHRManager.allowed_roles` (lines 30-49)
- **Impact**: Cannot assign these roles to staff users via admin interface
- **Recommendation**: Add to staff model or document alternative method

### Issue 5: **Cashier Role Referenced in Multiple Places** ⚠️ MEDIUM

- **Locations**:
  - `backend/finance/accounting_permissions.py` line 11
  - `backend/ipd/views.py` line 46 (READ_ROLES)
  - `backend/reports/views.py` line 161
  - Frontend: `frontend/src/components/auth/RoleGuard.jsx` and Sidebar
- **Status**: Role works in permissions but not in staff model
- **Impact**: Inconsistent data model

### Issue 6: **Super Admin Role Handling** ⚠️ MEDIUM

- **Status**: Handled via Django's `is_superuser` flag, not as a staff profile role
- **Impact**: Different code path for super_admin authentication
- **Reference**: `backend/config/urls.py` line 1210 - checks `user.is_superuser`
- **Recommendation**: Document the super_admin role derivation from `is_superuser`

### Issue 7: **Incomplete Backend Permission Coverage** ⚠️ MEDIUM

- **Roles without explicit backend permission classes**: `pharmacist`, `lab_technician`, `radiographer`
- **Impact**: Limited role-based access control for these roles - rely on basic `IsAuthenticated`
- **Locations**: These roles exist in staff model but no dedicated permission classes
- **Recommendation**: Create `IsPharmacist`, `IsLabTechnician`, `IsRadiographer` permission classes if needed

### Issue 8: **Frontend Roles Not in Sidebar** ✓ PASS

- **Finding**: All 15 roles in RoleGuard ARE defined in Sidebar
- **Status**: Consistent between components

### Issue 9: **Backend IPD Role Requirements** ⚠️ MEDIUM

- **File**: `backend/ipd/views.py` lines 41-65
- **Defined Sets**:
  - `READ_ROLES`: admin, doctor, nurse, receptionist, cashier, accountant, pharmacist, lab_technician, radiographer
  - `CLINICAL_ROLES`: admin, doctor, nurse
  - `ADMISSION_ROLES`: admin, doctor, receptionist
  - `DISCHARGE_ROLES`: admin, doctor
- **Issue**: These are hardcoded - doesn't match staff model
- **Impact**: IPD module can only manage core clinical roles

---

## 5. API Endpoint Permission Requirements

### HR Module (`/api/v1/hr/`)

- **Permission**: `IsHRUser`
- **Allowed Roles (Backend)**: `HR`, `HR_MANAGER`, `HR_OFFICER`, `ADMIN`, `HOSPITAL_ADMIN`, `SUPER_ADMIN`
- **Allowed Roles (Frontend)**: `hr`, `hr_manager`, `hr_officer`, `admin`, `super_admin`
- **Mismatch**: Case sensitivity in role names

### Finance Module (`/api/v1/finance/`)

- **Permission**: `IsFinanceUser`
- **Allowed Roles**: `finance`, `finance_manager`, `accountant`, `cashier`
- **Issue**: Staff model doesn't support these roles

### Budgets Module (`/api/v1/budgets/`)

- **Permission**: `IsHRManager`
- **Allowed Roles (Backend)**: `HR_MANAGER`, `ADMIN`, `HOSPITAL_ADMIN`, `SUPER_ADMIN`
- **Allowed Roles (Frontend)**: `hr_manager`, `admin`, `super_admin`

### Expenses Module (`/api/v1/expenses/`)

- **Permission**: `IsHRManager` and `IsHRUser`
- **Allowed Roles**: Same as HR module

### Billing Module (`/api/v1/billing/`)

- **Permission**: `IsAuthenticated` only
- **Allowed Roles**: All authenticated users
- **Frontend**: `admin`, `super_admin`, `receptionist`, `accountant`, `finance`, `finance_manager`, `cashier`

### Reports

- **Dashboard Reports**: `IsAuthenticated`
- **Cashier Report**: Returns role=`cashier`
- **Lab Report**: Returns role=`lab_technician`
- **Pharmacy Report**: Returns role=`pharmacist`

### Inpatient Admissions (`/api/v1/ipd/`)

- **Role Check**: Uses `role_allowed()` function with predefined sets
- **Roles**: `admin`, `doctor`, `nurse`, `receptionist`, `cashier`, `accountant`, `pharmacist`, `lab_technician`, `radiographer`

---

## 6. Recommended Fixes (Priority Order)

### Priority 1: CRITICAL - Fix Role Model

**File**: `backend/staff/models.py`

```python
ROLES = [
    ('admin', 'Administrator'),
    ('doctor', 'Doctor'),
    ('nurse', 'Nurse'),
    ('receptionist', 'Receptionist'),
    ('pharmacist', 'Pharmacist'),
    ('lab_technician', 'Lab Technician'),
    ('radiographer', 'Radiographer'),
    ('accountant', 'Accountant'),
    # ADD THESE:
    ('finance', 'Finance Officer'),
    ('finance_manager', 'Finance Manager'),
    ('cashier', 'Cashier'),
    ('hr', 'HR Officer'),
    ('hr_manager', 'HR Manager'),
    ('hr_officer', 'HR Officer (Junior)'),
]
```

**Migration Required**: Yes - Add new role choices

---

### Priority 2: HIGH - Standardize Role Case

- Standardize all backend permission classes to use **lowercase** roles
- **Files to Update**:
  - `backend/human_resources/permissions.py` - change to lowercase
  - `backend/finance/accounting_permissions.py` - already lowercase ✓
  - `backend/config/settings.py` - verify permission classes
  - `backend/ipd/views.py` - already lowercase ✓

---

### Priority 3: HIGH - Create Permission Classes for Missing Roles

**File**: Create `backend/staff/permissions.py`

```python
class IsPharmacist(BasePermission):
    message = "You do not have permission to access pharmacy resources."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        role = getattr(request.user.staff_profile, 'role', '')
        return role in {'pharmacist', 'admin'}

# Similar for IsLabTechnician, IsRadiographer
```

---

### Priority 4: MEDIUM - Document Super Admin Role

- Add comments explaining that `super_admin` is derived from `is_superuser`
- Document the difference between hospital admin and platform super admin

---

### Priority 5: MEDIUM - Consolidate Role Validation

- Create a centralized role validation module
- Move role definitions from multiple files to single source of truth

---

## 7. Summary Table: Frontend vs Backend Consistency

| Aspect                          | Status     | Details                                                      |
| ------------------------------- | ---------- | ------------------------------------------------------------ |
| Roles in RoleGuard vs Sidebar   | ✓ MATCH    | Both have 15 roles                                           |
| Frontend roles vs Backend model | ✗ MISMATCH | 7 roles in frontend not in model                             |
| Backend permission classes      | ✓ DEFINED  | IsHRUser, IsHRManager, IsFinanceUser, IsFinanceManager exist |
| Case sensitivity                | ✗ MISMATCH | Backend uses UPPERCASE, frontend lowercase                   |
| API endpoint permissions        | ⚠️ PARTIAL | Some roles not in staff model                                |
| Route access control            | ✓ ENFORCED | RoleGuard checks routes                                      |
| Sidebar role filtering          | ✓ ENFORCED | Sidebar filters based on role                                |

---

## 8. Conclusion

The RBAC system has **significant gaps** between frontend and backend:

1. **Model Gaps**: 7 roles exist in frontend but not in backend staff model
2. **Case Inconsistency**: Backend uses different case convention than frontend
3. **Permission Coverage**: Only 4 permission classes defined; missing coverage for pharmacist, lab_technician, radiographer
4. **Documentation**: Super admin role derivation not well documented

**Recommendation**: Address Priority 1 (add roles to staff model) before adding new role-based features. Then implement Priority 2-5 for robustness.

---

## Appendix: File Locations

### Frontend Files

- `frontend/src/components/auth/RoleGuard.jsx` - Route protection
- `frontend/src/components/layout/Sidebar.jsx` - Menu visibility

### Backend Files

- `backend/staff/models.py` - Role definitions
- `backend/human_resources/permissions.py` - HR permission classes
- `backend/finance/accounting_permissions.py` - Finance permission classes
- `backend/ipd/views.py` - IPD role requirements
- `backend/config/urls.py` - API endpoint definitions
- `backend/reports/views.py` - Reporting role assignments
