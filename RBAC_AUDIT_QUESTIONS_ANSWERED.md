# RBAC Audit - Answer to Specific Questions

## Question 1: Are all roles in Sidebar also in RoleGuard?

**Answer: YES - 100% match**

- **Sidebar roles**: admin, super_admin, doctor, receptionist, nurse, pharmacist, lab_technician, radiographer, accountant, finance, finance_manager, cashier, hr_manager, hr_officer, hr (15 total)
- **RoleGuard roles**: admin, super_admin, doctor, receptionist, nurse, pharmacist, lab_technician, radiographer, accountant, finance, finance_manager, cashier, hr_manager, hr_officer, hr (15 total)
- **Status**: ✓ Perfect alignment

---

## Question 2: Are all roles in RoleGuard also in Sidebar?

**Answer: YES - 100% match**

- **Status**: ✓ All 15 RoleGuard roles have corresponding Sidebar definitions
- **Verification**: Every role in roleAccess object (RoleGuard.jsx) has a matching entry in navigationByRole (Sidebar.jsx)

---

## Question 3: Are there roles in the backend permission system not in frontend?

**Answer: NO - but with caveats**

- **Backend Permission Classes Allow**:
  - IsHRUser: HR, HR_MANAGER, HR_OFFICER, ADMIN, HOSPITAL_ADMIN, SUPER_ADMIN
  - IsHRManager: HR_MANAGER, ADMIN, HOSPITAL_ADMIN, SUPER_ADMIN
  - IsFinanceUser: finance, finance_manager, accountant, cashier
  - IsFinanceManager: finance_manager, accountant
- **All these roles exist in frontend (RoleGuard + Sidebar)**
- **However**: Several frontend roles are NOT in backend staff model (see Issue #4 & #5)
- **Status**: ✓ No backend-only roles, but ⚠️ Many frontend roles missing from backend

---

## Question 4: Which roles can access /admin, /finance, /hr, /hr/employees, /patients, /billing?

### /admin

| Role            | Access                                     |
| --------------- | ------------------------------------------ |
| admin           | ✓ YES (all /admin/\* routes)               |
| super_admin     | ✓ YES (all /admin/\* routes)               |
| doctor          | ✗ NO                                       |
| receptionist    | ✗ NO                                       |
| nurse           | ✓ PARTIAL (/admin/rooms, /admin/beds only) |
| pharmacist      | ✗ NO                                       |
| lab_technician  | ✗ NO                                       |
| radiographer    | ✗ NO                                       |
| accountant      | ✗ NO                                       |
| finance         | ✗ NO                                       |
| finance_manager | ✗ NO                                       |
| cashier         | ✗ NO                                       |
| hr_manager      | ✗ NO                                       |
| hr_officer      | ✗ NO                                       |
| hr              | ✗ NO                                       |

### /finance and /finance/\* routes

| Role            | /finance | /finance/budgets | /finance/expenses | /finance/payroll | /finance/payroll-config | /finance/accounting | /finance/reports |
| --------------- | -------- | ---------------- | ----------------- | ---------------- | ----------------------- | ------------------- | ---------------- |
| admin           | ✓        | ✓                | ✓                 | ✓                | ✓                       | ✓                   | ✓                |
| super_admin     | ✓        | ✓                | ✓                 | ✓                | ✓                       | ✓                   | ✓                |
| doctor          | ✗        | ✗                | ✗                 | ✗                | ✗                       | ✗                   | ✗                |
| receptionist    | ✗        | ✗                | ✗                 | ✗                | ✗                       | ✗                   | ✗                |
| nurse           | ✗        | ✗                | ✗                 | ✗                | ✗                       | ✗                   | ✗                |
| pharmacist      | ✗        | ✗                | ✗                 | ✗                | ✗                       | ✗                   | ✗                |
| lab_technician  | ✗        | ✗                | ✗                 | ✗                | ✗                       | ✗                   | ✗                |
| radiographer    | ✗        | ✗                | ✗                 | ✗                | ✗                       | ✗                   | ✗                |
| accountant      | ✓        | ✓                | ✓                 | ✓                | ✓                       | ✓                   | ✓                |
| finance         | ✓        | ✓                | ✓                 | ✓                | ✓                       | ✓                   | ✓                |
| finance_manager | ✓        | ✓                | ✓                 | ✓                | ✓                       | ✓                   | ✓                |
| cashier         | ✗        | ✗                | ✗                 | ✓                | ✗                       | ✗                   | ✗                |
| hr_manager      | ✓        | ✓                | ✓                 | ✓                | ✓                       | ✗                   | ✓                |
| hr_officer      | ✗        | ✗                | ✗                 | ✗                | ✗                       | ✗                   | ✗                |
| hr              | ✗        | ✗                | ✗                 | ✗                | ✗                       | ✗                   | ✗                |

### /hr and /hr/\* routes

| Role            | /hr | /hr/employees | /hr/employees/new | /hr/positions | /hr/contracts | /hr/attendance | /hr/leave-requests | /hr/shifts |
| --------------- | --- | ------------- | ----------------- | ------------- | ------------- | -------------- | ------------------ | ---------- |
| admin           | ✓   | ✓             | ✓                 | ✓             | ✓             | ✓              | ✓                  | ✓          |
| super_admin     | ✓   | ✓             | ✓                 | ✓             | ✓             | ✓              | ✓                  | ✓          |
| doctor          | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| receptionist    | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| nurse           | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| pharmacist      | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| lab_technician  | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| radiographer    | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| accountant      | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| finance         | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| finance_manager | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| cashier         | ✗   | ✗             | ✗                 | ✗             | ✗             | ✗              | ✗                  | ✗          |
| hr_manager      | ✓   | ✓             | ✓                 | ✓             | ✓             | ✓              | ✓                  | ✓          |
| hr_officer      | ✓   | ✓             | ✗                 | ✗             | ✗             | ✓              | ✓                  | ✓          |
| hr              | ✓   | ✓             | ✗                 | ✗             | ✗             | ✓              | ✓                  | ✗          |

### /patients

| Role            | Can Access                        |
| --------------- | --------------------------------- |
| admin           | ✓ YES                             |
| super_admin     | ✓ YES                             |
| doctor          | ✓ YES (/doctors/queue, /patients) |
| receptionist    | ✓ YES (/patients, /patients/add)  |
| nurse           | ✓ YES                             |
| pharmacist      | ✗ NO                              |
| lab_technician  | ✓ YES                             |
| radiographer    | ✓ YES                             |
| accountant      | ✗ NO                              |
| finance         | ✗ NO                              |
| finance_manager | ✗ NO                              |
| cashier         | ✗ NO                              |
| hr_manager      | ✗ NO                              |
| hr_officer      | ✗ NO                              |
| hr              | ✗ NO                              |

### /billing

| Role            | Can Access |
| --------------- | ---------- |
| admin           | ✓ YES      |
| super_admin     | ✓ YES      |
| doctor          | ✗ NO       |
| receptionist    | ✓ YES      |
| nurse           | ✗ NO       |
| pharmacist      | ✗ NO       |
| lab_technician  | ✗ NO       |
| radiographer    | ✗ NO       |
| accountant      | ✓ YES      |
| finance         | ✓ YES      |
| finance_manager | ✓ YES      |
| cashier         | ✓ YES      |
| hr_manager      | ✗ NO       |
| hr_officer      | ✗ NO       |
| hr              | ✗ NO       |

---

## Question 5: Are there any mismatches between frontend and backend permissions?

### YES - Multiple Critical Mismatches:

#### Mismatch 1: **Role Definition Gap** ⚠️ CRITICAL

- **Frontend Roles**: 15 roles (admin, super_admin, doctor, receptionist, nurse, pharmacist, lab_technician, radiographer, accountant, finance, finance_manager, cashier, hr_manager, hr_officer, hr)
- **Backend Staff Model**: 8 roles (admin, doctor, nurse, receptionist, pharmacist, lab_technician, radiographer, accountant)
- **Missing in Backend Model**: super_admin, finance, finance_manager, cashier, hr_manager, hr_officer, hr (7 roles)
- **Impact**: Cannot create staff users with these 7 roles through standard Django admin
- **Evidence**:
  - `backend/staff/models.py` lines 7-18 only defines 8 roles
  - `backend/staff/migrations/0001_initial.py` line 23 only has these 8 choices

#### Mismatch 2: **Case Sensitivity Mismatch** ⚠️ HIGH

- **Frontend (lowercase)**: hr, hr_manager, hr_officer
- **Backend Permission Classes (UPPERCASE)**: HR, HR_MANAGER, HR_OFFICER
- **Files**:
  - `backend/human_resources/permissions.py` lines 30-35: Uses UPPERCASE
  - `frontend/src/components/auth/RoleGuard.jsx`: Uses lowercase
- **Impact**: Potential authorization bypass if comparison is case-sensitive or inconsistent
- **Example**: If a user has role='hr_manager' in database, checking `role in {'HR_MANAGER'}` would fail

#### Mismatch 3: **Finance Role Implementation** ⚠️ HIGH

- **Frontend Definition**: cashier, finance, finance_manager have routes and sidebar items
- **Backend Implementation**:
  - No staff model roles for these
  - Only exist in permission classes (IsFinanceUser, IsFinanceManager)
  - `get_user_role_name()` function handles lowercasing but no validation source
- **Impact**: These roles work through permission classes but cannot be assigned through staff model
- **Files**:
  - `backend/finance/accounting_permissions.py` lines 4-18
  - `backend/staff/models.py` does NOT include them

#### Mismatch 4: **HR Role Implementation** ⚠️ HIGH

- **Frontend Definition**: hr, hr_manager, hr_officer have routes and sidebar items
- **Backend Implementation**:
  - No staff model roles for these
  - Only exist in permission classes (IsHRUser, IsHRManager)
  - Use GROUP-based role system in tests, not staff profile roles
- **Impact**: These roles work through permission classes but cannot be assigned through staff model
- **Evidence**:
  - `backend/test_hr_module.py` lines 87-96: Assigns roles directly to User object, not StaffProfile
  - `backend/human_resources/permissions.py` uses uppercase for comparison

#### Mismatch 5: **Super Admin Role Handling** ⚠️ MEDIUM

- **Frontend Definition**: super_admin role in RoleGuard and Sidebar
- **Backend Implementation**: Derived from `is_superuser` flag, not a staff role
- **Code Paths Differ**:
  - Frontend: `localStorage.getItem("role") === "super_admin"`
  - Backend: `user.is_superuser`
- **Impact**: Different authentication and authorization logic
- **Evidence**:
  - `frontend/src/components/auth/RoleGuard.jsx` lines 116-120: Checks for role "super_admin"
  - `backend/config/urls.py` line 1210: Checks `user.is_superuser`
  - `backend/config/urls.py` line 1235: Returns role as 'super_admin' if is_superuser=True

#### Mismatch 6: **Backend Permission Class Coverage** ⚠️ MEDIUM

- **Roles with Limited Backend Support**:
  - pharmacist, lab_technician, radiographer: No dedicated permission classes
  - Only have staff model role, rely on IsAuthenticated
- **Impact**: Limited fine-grained RBAC for clinical roles
- **Files Affected**:
  - `backend/pharmacy/views.py`: Uses `IsAuthenticated` only
  - `backend/imaging/views.py`: Uses `IsAuthenticated` only
  - `backend/laboratory/views.py`: (if exists) likely `IsAuthenticated` only

#### Mismatch 7: **IPD Role Requirements vs Staff Model** ⚠️ MEDIUM

- **Staff Model Roles**: admin, doctor, nurse, receptionist, pharmacist, lab_technician, radiographer, accountant
- **IPD Role Sets**:
  - `READ_ROLES`: admin, doctor, nurse, receptionist, cashier, accountant, pharmacist, lab_technician, radiographer (includes cashier not in model)
  - `CLINICAL_ROLES`: admin, doctor, nurse
  - `ADMISSION_ROLES`: admin, doctor, receptionist
  - `DISCHARGE_ROLES`: admin, doctor
- **Impact**: IPD module includes cashier (not in model) in READ_ROLES
- **Evidence**: `backend/ipd/views.py` line 46 includes "cashier" in READ_ROLES

---

## Question 6: What about roles: lab, lab_technician, radiographer, cashier, finance, finance_manager?

### Role Analysis:

#### lab (NOT A ROLE)

- **Status**: Does NOT exist in frontend or backend
- **Frontend**: Uses `lab_technician` instead (✓)
- **Backend**: Uses `lab_technician` instead (✓)
- **Conclusion**: No "lab" role - use `lab_technician`

#### lab_technician ✓

- **Frontend**: Defined in RoleGuard and Sidebar
- **Backend**: Defined in staff model ✓
- **Routes**: `/dashboard`, `/admin/lab`, `/patients`
- **Sidebar**: Lab Dashboard, All Tests, Patients
- **Backend Permissions**:
  - In IPD READ_ROLES ✓
  - No dedicated permission class
- **Status**: ✓ Consistent

#### radiographer ✓

- **Frontend**: Defined in RoleGuard and Sidebar
- **Backend**: Defined in staff model ✓
- **Routes**: `/dashboard`, `/admin/imaging`, `/patients`
- **Sidebar**: Dashboard, Imaging, Patients
- **Backend Permissions**:
  - In IPD READ_ROLES ✓
  - No dedicated permission class
- **Status**: ✓ Consistent

#### cashier ⚠️

- **Frontend**: Defined in RoleGuard and Sidebar
- **Backend**: NOT in staff model ✗
- **Routes**: `/dashboard`, `/billing`, `/finance/payroll`
- **Sidebar**: Dashboard, Billing, Insurance, Reports
- **Backend Permissions**:
  - In IsFinanceUser ✓
  - In IPD READ_ROLES ✓
  - Referenced in cashier_report
- **Status**: ⚠️ Works but not in staff model
- **Files Using Cashier**:
  - `backend/finance/accounting_permissions.py` line 11
  - `backend/ipd/views.py` line 46
  - `backend/reports/views.py` line 161

#### finance ⚠️

- **Frontend**: Defined in RoleGuard and Sidebar
- **Backend**: NOT in staff model ✗
- **Routes**: `/dashboard`, `/finance`, `/finance/budgets`, `/finance/expenses`, `/finance/payroll`, `/finance/payroll-config`, `/finance/accounting`, `/finance/reports`, `/billing`, `/admin/reports`
- **Sidebar**: Full finance section
- **Backend Permissions**:
  - In IsFinanceUser ✓
  - NOT in IPD READ_ROLES ✗
- **Status**: ⚠️ Works but not in staff model
- **Files Using Finance**:
  - `backend/finance/accounting_permissions.py` lines 5, 23, 71

#### finance_manager ⚠️

- **Frontend**: Defined in RoleGuard and Sidebar
- **Backend**: NOT in staff model ✗
- **Routes**: Same as finance (10 routes)
- **Sidebar**: Same as finance
- **Backend Permissions**:
  - In IsFinanceManager ✓
  - In IsFinanceUser ✓
  - NOT in IPD READ_ROLES ✗
- **Status**: ⚠️ Works but not in staff model
- **Files Using Finance Manager**:
  - `backend/finance/accounting_permissions.py` lines 9, 18, 99

### Summary Table:

| Role            | In Frontend | In Backend Model | Backend Permissions | IPD Support      | Status       |
| --------------- | ----------- | ---------------- | ------------------- | ---------------- | ------------ |
| lab             | No          | No               | N/A                 | N/A              | ✗ Not a role |
| lab_technician  | Yes         | Yes              | IsAuthenticated     | Yes (READ_ROLES) | ✓ Consistent |
| radiographer    | Yes         | Yes              | IsAuthenticated     | Yes (READ_ROLES) | ✓ Consistent |
| cashier         | Yes         | No               | IsFinanceUser       | Yes (READ_ROLES) | ⚠️ Model gap |
| finance         | Yes         | No               | IsFinanceUser       | No               | ⚠️ Model gap |
| finance_manager | Yes         | No               | IsFinanceManager    | No               | ⚠️ Model gap |

---

## Summary of Findings

### By Question:

1. **All Sidebar roles in RoleGuard?** ✓ YES
2. **All RoleGuard roles in Sidebar?** ✓ YES
3. **Backend roles not in frontend?** ✓ NO
4. **Access to key routes?** Complex - See matrices above
5. **Frontend/Backend mismatches?** ✗ YES - 7 roles missing from model
6. **Specific roles analysis?**
   - lab_technician: ✓ OK
   - radiographer: ✓ OK
   - cashier: ⚠️ Missing from model
   - finance: ⚠️ Missing from model
   - finance_manager: ⚠️ Missing from model

### Critical Actions Required:

1. Add missing roles to `backend/staff/models.py` ROLES list
2. Create/update migration to add new role choices
3. Fix case sensitivity (use lowercase everywhere)
4. Create permission classes for missing roles (IsPharmacist, IsLabTechnician, IsRadiographer)
5. Document super_admin role derivation
