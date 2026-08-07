# MediCore SaaS System Test Case Book

**Purpose:** Repeatable manual acceptance testing for a MediCore release.

**Release gate:** A release passes only when all applicable cases pass, no critical/high defect remains open, and automated checks pass.

## 1. Test Execution

| Field               | Value                                  |
| ------------------- | -------------------------------------- |
| Build/version       |                                        |
| Environment         | Local / staging / production           |
| Tester              |                                        |
| Date                |                                        |
| Hospital under test |                                        |
| Browser/device      |                                        |
| Result              | Pass / Fail / Blocked / Not applicable |
| Defect reference    |                                        |

### Test Accounts

Create isolated accounts in a single test hospital. Do not use production patient data.

| Account                 | Required role                  |
| ----------------------- | ------------------------------ |
| Platform administrator  | Django superuser               |
| Hospital administrator  | `admin`                        |
| Doctor                  | `doctor`                       |
| Nurse                   | `nurse`                        |
| Reception user          | `receptionist`                 |
| Pharmacy user           | `pharmacist`                   |
| Lab user                | `lab_technician`               |
| Imaging user            | `radiographer`                 |
| Cashier/accounting user | `cashier` or `accountant`      |
| Finance user            | `finance` or `finance_manager` |
| HR user                 | `hr_officer` or `hr_manager`   |

### Standard Test Data

- Two hospitals: Hospital A and Hospital B.
- At least two departments, one ward, one room, and two beds in Hospital A.
- Two patients, one doctor, one medicine with available stock, one service catalog item, and one test user per role.
- A free Starter trial subscription for Hospital A and a paid Professional subscription for Hospital B.

## 2. Release Smoke Tests

| ID     | Scenario                 | Steps                                                 | Expected result                                                      |
| ------ | ------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------- |
| SMK-01 | Backend health           | Run `python manage.py check`.                         | No configuration errors.                                             |
| SMK-02 | Backend regression suite | Run `python manage.py test --verbosity 1`.            | All tests pass.                                                      |
| SMK-03 | Frontend lint            | Run `npm run lint` in `frontend`.                     | No lint errors or warnings.                                          |
| SMK-04 | Frontend load            | Open the public site and log-in page.                 | Page loads without console errors or failed critical assets.         |
| SMK-05 | API availability         | Request `/api/v1/` through the configured API domain. | HTTPS response is reachable; expected API response is returned.      |
| SMK-06 | Session protection       | Open a protected dashboard URL while signed out.      | User is redirected to authentication; protected data is not visible. |

## 3. Authentication and Security

| ID      | Scenario                 | Steps                                                                               | Expected result                                                                       |
| ------- | ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| AUTH-01 | Valid login              | Sign in with a valid hospital administrator account.                                | Session is created and dashboard opens.                                               |
| AUTH-02 | Invalid password         | Submit a valid account with an invalid password.                                    | Login is denied without revealing sensitive account information.                      |
| AUTH-03 | Unknown account          | Attempt login with a non-existent email/phone.                                      | Login is denied safely.                                                               |
| AUTH-04 | Logout                   | Sign in, then log out and revisit a protected URL.                                  | Session is removed and protected URL is blocked.                                      |
| AUTH-05 | Password reset           | Request a reset and complete it using a valid reset link.                           | Password changes; old password no longer works.                                       |
| AUTH-06 | CSRF/session behavior    | Submit a state-changing request from the browser after login.                       | Authorized request succeeds; missing/invalid CSRF request is rejected where required. |
| AUTH-07 | Login throttling         | Repeatedly submit invalid login requests from one test IP.                          | Rate limit is enforced without a server error.                                        |
| AUTH-08 | Registration throttling  | Submit four invalid public hospital registrations from one test IP within one hour. | First three are validated; fourth is rate-limited.                                    |
| AUTH-09 | Audit trail              | Complete login and a privileged change.                                             | Relevant audit events are visible to authorized administrators.                       |
| AUTH-10 | Cross-hospital isolation | Sign in as Hospital A user and request/view Hospital B object IDs.                  | Data is not returned or changed; response is denied/not found.                        |

## 4. Public Registration and Hospital Setup

| ID     | Scenario              | Steps                                                             | Expected result                                                                   |
| ------ | --------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| REG-01 | Hospital registration | Submit valid hospital and administrator details.                  | Hospital and administrator account are created; response is valid JSON.           |
| REG-02 | Required fields       | Omit each mandatory registration field in turn.                   | Clear validation error identifies the missing/invalid field.                      |
| REG-03 | Duplicate identity    | Register with an existing unique hospital/account value.          | Duplicate is rejected without duplicate records.                                  |
| REG-04 | Trial creation        | Complete a new hospital registration.                             | A 14-day Starter trial is created with $0.00 monthly price and $0.00 service fee. |
| REG-05 | Hospital profile      | Hospital administrator updates permitted hospital profile fields. | Changes persist only for that hospital.                                           |
| REG-06 | Department setup      | Create, edit, and deactivate a department.                        | Department lifecycle works and remains hospital scoped.                           |
| REG-07 | Department boundary   | Submit Hospital B department ID when creating Hospital A staff.   | Request is rejected; no cross-hospital staff association is created.              |

## 5. Roles and Access Control

| ID      | Scenario                    | Steps                                                                       | Expected result                                                                             |
| ------- | --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| RBAC-01 | Administrator access        | Sign in as `admin`.                                                         | Hospital administration, users, settings, billing, and reports are available as authorized. |
| RBAC-02 | Doctor navigation           | Sign in as `doctor`.                                                        | Clinical work areas are available; administration and HR pages are unavailable.             |
| RBAC-03 | Reception navigation        | Sign in as `receptionist`.                                                  | Patient and appointment workflows are available; doctor-only navigation is absent.          |
| RBAC-04 | Nursing navigation          | Sign in as `nurse`.                                                         | Nursing/IPD workflows are available within permissions.                                     |
| RBAC-05 | Pharmacy navigation         | Sign in as `pharmacist`.                                                    | Pharmacy workflows are available; financial administration is unavailable.                  |
| RBAC-06 | Lab navigation              | Sign in as `lab_technician`.                                                | Laboratory workflow is available; unrelated clinical administration is unavailable.         |
| RBAC-07 | Radiology navigation        | Sign in as `radiographer`.                                                  | Imaging workflow is available; unrelated administration is unavailable.                     |
| RBAC-08 | Finance access              | Sign in as `finance`/`finance_manager`.                                     | Permitted accounting/finance workflows load; non-finance users are denied.                  |
| RBAC-09 | HR access                   | Sign in as `hr_officer`/`hr_manager`.                                       | HR dashboard and allowed staff workflows load; non-HR user is denied.                       |
| RBAC-10 | Hospital admin-only billing | Request billing dashboard and plan changes as non-admin.                    | Request is denied with 403.                                                                 |
| RBAC-11 | Platform isolation          | Platform superuser opens hospital data without a selected hospital context. | Tenant data is not listed unintentionally.                                                  |

## 6. Staff and Human Resources

| ID    | Scenario                 | Steps                                                                      | Expected result                                                             |
| ----- | ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| HR-01 | Create staff user        | Hospital administrator creates a staff account with a role and department. | User, StaffProfile, and linked HR Employee are created.                     |
| HR-02 | Employee synchronization | Open HR employees after staff creation.                                    | The new staff member appears once with a hospital-specific employee number. |
| HR-03 | Duplicate prevention     | Edit/retry a staff creation path for the same user.                        | No duplicate employee record is created.                                    |
| HR-04 | Employee lifecycle       | HR user updates employee details and status.                               | Permitted fields persist and remain hospital scoped.                        |
| HR-05 | Attendance               | Assign shift, check in, and check out.                                     | Attendance record and hours are correct.                                    |
| HR-06 | Leave workflow           | Employee submits leave; HR officer/manager reviews it.                     | Status, reviewer, and review time are recorded.                             |
| HR-07 | Payroll access           | Open payroll as authorized finance/HR role.                                | Salary-slip/payroll data loads without authentication errors.               |
| HR-08 | Payroll restriction      | Open payroll as receptionist.                                              | Access is denied.                                                           |
| HR-09 | Personal shift report    | Create own and another user's activities, then request each report.        | Each report contains only that staff member's own eligible activities.      |

## 7. Patient, Appointment, and Billing Workflow

| ID      | Scenario               | Steps                                                       | Expected result                                                      |
| ------- | ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| PAT-01  | Patient registration   | Receptionist creates a patient with required demographics.  | Patient receives a record/MRN and appears only in Hospital A.        |
| PAT-02  | Patient validation     | Submit missing required patient fields.                     | Validation message is shown; no partial patient record is created.   |
| PAT-03  | Patient search         | Search by name/MRN/phone.                                   | Correct hospital records are returned.                               |
| PAT-04  | Appointment booking    | Book an appointment for a patient and doctor.               | Appointment appears in schedules with correct date/time/status.      |
| PAT-05  | Appointment completion | Mark an appointment completed.                              | Status is persisted and appears in reports.                          |
| PAT-06  | Appointment boundary   | Request Hospital B appointment from Hospital A credentials. | Object is inaccessible.                                              |
| BILL-01 | Service catalog        | Create a consultation/lab/imaging service.                  | Service is usable when creating bills.                               |
| BILL-02 | Create bill            | Create bill with one or more charge categories.             | Total and balance equal the calculated charges.                      |
| BILL-03 | Full payment           | Record a payment equal to balance.                          | Bill becomes paid; payment ledger has the correct amount/date/user.  |
| BILL-04 | Partial payment        | Record partial payment.                                     | Bill remains partial; remaining balance is correct.                  |
| BILL-05 | Payment isolation      | Request another hospital's bill/payment ID.                 | Record is inaccessible and cannot be modified.                       |
| BILL-06 | Receipt                | Generate/view receipt after a payment.                      | Receipt includes correct hospital, bill, amount, and payment status. |

## 8. Pharmacy, Laboratory, and Imaging

| ID       | Scenario            | Steps                                                       | Expected result                                                            |
| -------- | ------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| PHARM-01 | Medicine inventory  | Create medicine with quantity, prices, and reorder level.   | Stock values persist; low-stock indication appears at/below reorder level. |
| PHARM-02 | Prescription        | Create prescription for a patient.                          | Prescription is visible to authorized pharmacy users.                      |
| PHARM-03 | Dispense            | Dispense full and partial prescription quantities.          | Status, dispensed quantity, actor, and timestamp are correct.              |
| PHARM-04 | Stock safety        | Try dispensing more than available stock.                   | Request is rejected; inventory is not negative.                            |
| LAB-01   | Request lab test    | Create test for a Hospital A patient.                       | Test is visible to Hospital A lab user.                                    |
| LAB-02   | Complete lab test   | Lab technician completes own hospital test.                 | Status, `performed_by`, and completion timestamp are recorded.             |
| LAB-03   | Lab boundary        | List/read Hospital B lab test using Hospital A credentials. | No Hospital B data is returned; detail is inaccessible.                    |
| IMG-01   | Create imaging test | Create imaging request with type/body part/price.           | Test appears for authorized imaging user.                                  |
| IMG-02   | Complete imaging    | Mark test completed with result.                            | Completion metadata and revenue are available to reports.                  |
| IMG-03   | Imaging restriction | Attempt imaging completion as unauthorized user.            | Access is denied.                                                          |

## 9. IPD, Rooms, and Nursing

| ID     | Scenario                  | Steps                                                     | Expected result                                                            |
| ------ | ------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| IPD-01 | Ward/room/bed setup       | Create ward, room, and bed.                               | Hierarchy persists and bed is available.                                   |
| IPD-02 | Admission                 | Admit Hospital A patient to Hospital A bed.               | Admission is created and bed availability changes correctly.               |
| IPD-03 | Foreign-bed admission     | Attempt to admit Hospital A patient to Hospital B bed ID. | Request returns not found/denied; no admission or bed mutation occurs.     |
| IPD-04 | Transfer                  | Transfer admitted patient to another Hospital A bed.      | Admission and source/target bed states update correctly.                   |
| IPD-05 | Foreign-bed transfer      | Transfer to Hospital B bed ID.                            | Request is denied/not found; original admission/bed state stays unchanged. |
| IPD-06 | Nursing observations      | Nurse creates observation for an admitted patient.        | Observation stores staff/time and is visible only to authorized users.     |
| IPD-07 | Medication administration | Record administered and refused medication.               | Dose, user, time, and refusal reason are accurately stored.                |
| IPD-08 | Discharge                 | Discharge patient.                                        | Discharge time is captured and bed is released.                            |

## 10. Expenses, Finance, and Reports

| ID     | Scenario                 | Steps                                                               | Expected result                                                                       |
| ------ | ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| FIN-01 | Submit expense           | Authorized staff submits an expense.                                | Expense is pending review and audit activity is created.                              |
| FIN-02 | Approve expense          | `hr_manager` approves submitted expense.                            | Approval succeeds using StaffProfile role; obsolete Django group is not required.     |
| FIN-03 | Pay expense              | Record payment for approved expense.                                | Status, payment data, and audit record are correct.                                   |
| FIN-04 | Expense restriction      | Non-authorized user approves expense.                               | Access is denied.                                                                     |
| FIN-05 | Accounting entries       | Create permitted accounting entry/category.                         | Entry balances and is scoped to hospital.                                             |
| REP-01 | Daily detailed report    | Professional/Enterprise hospital admin opens detailed daily report. | Patient, billing, appointment, IPD, lab, imaging, pharmacy, and expense metrics load. |
| REP-02 | Basic access restriction | Basic hospital admin opens detailed report.                         | Access is denied if plan entitlement requires Professional.                           |
| REP-03 | Report date ranges       | Request daily, weekly, monthly, quarterly, and valid custom dates.  | Correct local-calendar boundaries and data are returned.                              |
| REP-04 | Invalid report range     | Submit end date before start date.                                  | 400 response explains invalid range.                                                  |
| REP-05 | Report tenant scope      | Compare Hospital A report data with Hospital B data.                | Each report excludes the other hospital.                                              |
| REP-06 | Payment-ledger revenue   | Record payments today against old/new bills.                        | Revenue is based on payment receipt date, not only bill creation date.                |
| REP-07 | Dashboard charts         | Create same-local-day appointment, lab, and dispense activity.      | Weekly chart reports all three values on the local day.                               |
| REP-08 | Reconciliation           | Professional hospital admin opens reconciliation.                   | Paid counts, receipt states, rows, and filtering are correct.                         |
| REP-09 | Print report             | Print/export operational report.                                    | Printout contains clear hospital/date context and all relevant sections.              |

## 11. Subscription and Payment Workflow

| ID     | Scenario                      | Steps                                                               | Expected result                                                                                   |
| ------ | ----------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SUB-01 | Plan catalog                  | Run `seed_subscription_plans`, then view plans.                     | Starter, Basic, Professional, Enterprise are present once with canonical codes.                   |
| SUB-02 | Catalog prices                | Inspect catalog.                                                    | Starter: 14-day free; Basic: $49.90/month; Professional: $89.90/month; Enterprise: $129.90/month. |
| SUB-03 | Trial upgrade navigation      | As Starter hospital admin, click every `Upgrade Now` prompt.        | Each opens `/settings/billing/plans`.                                                             |
| SUB-04 | Non-admin restriction         | Non-admin requests billing plan changes.                            | 403 response.                                                                                     |
| SUB-05 | Starter to Basic invoice      | Request Basic during Starter trial with no prior service fee.       | Pending invoice is $300.00 fee + $49.90 subscription = $349.90.                                   |
| SUB-06 | Initial service fee once      | Mark first paid invoice settled; request later upgrade.             | Later upgrade does not repeat a paid service fee.                                                 |
| SUB-07 | Upgrade amount                | Change Basic to Professional after initial fee paid.                | Invoice includes only the positive monthly difference where applicable.                           |
| SUB-08 | Downgrade behavior            | Request a lower priced eligible plan.                               | Change is scheduled for next billing date; active plan remains unchanged until effective date.    |
| SUB-09 | Usage limit guard             | Add staff/patients above lower plan limit, request downgrade.       | Request is rejected with clear current usage/limit information.                                   |
| SUB-10 | Duplicate pending invoice     | Submit same plan-change request twice while pending invoice exists. | Existing invoice is reused; no duplicate charge/invoice is created.                               |
| SUB-11 | Payment activation            | Complete settlement of a pending upgrade invoice.                   | Subscription snapshot, hospital legacy fields, status, and plan are updated.                      |
| SUB-12 | Legacy catalog reconciliation | Seed database containing `Professional` record with legacy code.    | Existing record is reconciled to `pro`; no duplicate plan name error occurs.                      |

## 12. Platform Administration and Operations

| ID     | Scenario             | Steps                                                                       | Expected result                                                            |
| ------ | -------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ADM-01 | Platform dashboard   | Sign in as platform superuser.                                              | Platform hospital statistics and permitted controls load.                  |
| ADM-02 | Hospital activation  | Suspend/reactivate a test hospital.                                         | Hospital status changes and access follows the status policy.              |
| ADM-03 | Plan administration  | Update a test hospital plan through approved platform workflow.             | Change is recorded and does not alter other hospitals.                     |
| ADM-04 | Impersonation scope  | Select Hospital A context, inspect a tenant operation, then exit.           | Only selected hospital context is visible; exit restores platform context. |
| OPS-01 | Docker status        | Run `docker compose ps`.                                                    | PostgreSQL, Redis, backend, and frontend are running.                      |
| OPS-02 | Migration            | Run `docker compose exec backend python manage.py migrate`.                 | No failed migrations.                                                      |
| OPS-03 | Subscription seed    | Run `docker compose exec backend python manage.py seed_subscription_plans`. | Four plans update/create successfully.                                     |
| OPS-04 | Logs                 | Inspect backend/frontend logs after key workflows.                          | No repeated traceback, 5xx, or build failures.                             |
| OPS-05 | Backup restore drill | Restore an anonymized backup into a non-production environment.             | Database starts and core smoke tests pass.                                 |

## 13. Defect Template

```text
Defect ID:
Title:
Environment/build:
Test case ID:
Severity: Critical / High / Medium / Low
Preconditions:
Steps to reproduce:
Actual result:
Expected result:
Evidence: screenshot, video, API response, logs
Affected hospital/test account:
```

## 14. Exit Criteria

- All smoke tests pass.
- All applicable module test cases pass or have accepted written exceptions.
- No Critical or High defect remains open.
- Cross-hospital access checks pass for every module exercised.
- Subscription upgrade invoice and payment activation have been checked in a non-production environment.
- Production deployment, rollback owner, support contact, backup, and monitoring are confirmed.
