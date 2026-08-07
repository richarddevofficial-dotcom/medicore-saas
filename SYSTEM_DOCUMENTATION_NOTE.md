# MediCore SaaS Documentation Note

**Audience:** Hospital administrators, platform administrators, support staff, and deployment operators.

## 1. System Overview

MediCore SaaS is a multi-tenant hospital management system. Each hospital has its own users, clinical records, inventory, billing, staff, and subscription. Users must only see records belonging to their assigned hospital.

Core workflows include:

- Hospital registration and 14-day Starter trial
- Patient registration, appointments, billing, and payments
- Pharmacy, laboratory, and imaging operations
- IPD admissions, beds, nursing observations, and medication administration
- Staff management, attendance, leave, and payroll
- Expenses, accounting, finance, and operational reports
- Subscription management and platform administration

The frontend is Next.js and the backend is Django REST Framework. The API base path is `/api/v1`.

## 2. Roles

| Role                               | Main responsibility                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `admin`                            | Hospital administration, staff setup, settings, subscription, permitted reports |
| `doctor`                           | Clinical care and patient workflow                                              |
| `nurse`                            | Nursing and IPD workflow                                                        |
| `receptionist`                     | Patient registration and appointments                                           |
| `pharmacist`                       | Medicines, prescriptions, dispensing, stock                                     |
| `lab_technician`                   | Laboratory tests and results                                                    |
| `radiographer`                     | Imaging tests and results                                                       |
| `cashier` / `accountant`           | Billing, receipts, and accounting duties                                        |
| `finance` / `finance_manager`      | Finance and accounting workflows                                                |
| `hr` / `hr_officer` / `hr_manager` | Employees, attendance, leave, payroll permissions                               |
| Platform superuser                 | Platform-wide hospital management and support operations                        |

Role assignment is stored in `StaffProfile`. Do not depend on legacy Django groups for role-based access.

## 3. Hospital Administrator Guide

### Initial setup

1. Register the hospital through the public registration flow.
2. Sign in with the hospital administrator account.
3. Complete hospital details and create departments.
4. Create staff accounts and assign valid roles.
5. Confirm every new staff user appears under HR Employees.
6. Configure wards, rooms, beds, services, and medicine inventory before live clinical use.

### Staff creation

Creating a staff account creates three related records within the same hospital:

- Django user for authentication
- StaffProfile for role and hospital membership
- HR Employee record for HR/payroll workflows

A department selected for staff must belong to the same hospital. Cross-hospital department IDs are rejected.

### Daily operational flow

1. Reception registers patients and books appointments.
2. Clinical staff complete consultation, test, admission, or treatment activity.
3. Cashier/accountant records bill payments.
4. Pharmacy dispenses prescriptions and monitors stock.
5. Hospital administrator reviews reports, users, subscription, and exceptional activity.

## 4. Subscription Catalog and Upgrade Rules

| Plan         |    Monthly price | One-time service fee | Main limits                     |
| ------------ | ---------------: | -------------------: | ------------------------------- |
| Starter      | Free for 14 days |                $0.00 | 20 staff, 2,000 patients        |
| Basic        |           $49.90 |              $300.00 | 20 staff, 2,000 patients        |
| Professional |           $89.90 |              $500.00 | 100 staff, 20,000 patients      |
| Enterprise   |          $129.90 |            $1,000.00 | No configured staff/patient cap |

### Upgrade process

1. A hospital administrator clicks `Upgrade Now` or opens Settings > Billing > Plans.
2. The administrator selects an eligible target plan.
3. The system creates or reuses a pending plan-change invoice.
4. On the first paid activation, the target plan's service fee is included if no service fee has previously been paid.
5. For a Starter-to-Basic upgrade, the first invoice total is `$349.90` ($300.00 service fee + $49.90 subscription).
6. When payment settles, the target plan becomes active and the hospital plan limits update.

The service fee is charged only once. Later upgrades do not repeat a service fee after `service_fee_paid` is true. Downgrades are scheduled for the next billing date and may be rejected when current staff or patient usage exceeds the lower plan's limits.

Only the hospital `admin` role can view the subscription dashboard, plan options, or request a plan change.

### Operational subscription commands

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_subscription_plans
docker compose exec backend python manage.py apply_scheduled_plan_changes
docker compose exec backend python manage.py run_monthly_billing
```

Run the catalog seed after deployment to reconcile existing plan records with the current canonical catalog.

## 5. Reporting Notes

- Detailed operational reports and reconciliation reports are restricted to authorized hospital administrators with the required plan entitlement.
- Report date filters use the configured local calendar date, not UTC day boundaries.
- Revenue in detailed reports is based on the payment ledger receipt date.
- Operational reports include patient, billing, appointment, IPD, laboratory, imaging, pharmacy, and expense metrics.
- Reports must remain hospital scoped. A hospital administrator must never see another hospital's data.

## 6. Security and Tenant Isolation

- Do not share accounts between staff members.
- Use unique, strong passwords and MFA/OTP controls where configured.
- Keep `DEBUG=false` in production.
- Store secrets only in `.env`; never commit `.env` files.
- Use HTTPS for both frontend and API domains.
- Limit CORS and CSRF trusted origins to real application domains.
- Verify every workflow with Hospital A and Hospital B test users before releasing tenant-sensitive changes.
- Review audit logs and notification failures as part of support operations.

## 7. Production Deployment

The Docker deployment includes PostgreSQL, Redis, Django backend, and Next.js frontend.

```bash
cd ~/medicore-saas
git pull origin main
docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_subscription_plans
docker compose ps
docker compose logs --tail=100 backend
```

Required frontend configuration:

```text
NEXT_PUBLIC_API_URL=https://api.medicorecloud.com/api/v1
```

Production environment requirements:

- New Django secret key and encryption keys
- PostgreSQL database credentials
- Allowed hosts, CORS, and CSRF origins for production domains
- Email provider credentials
- Automated encrypted backups and a tested restore procedure
- HTTPS termination and certificate renewal
- Monitoring for failed requests, container restarts, disk space, and database health

## 8. Scheduled Operations

Example cron schedule from the host repository directory:

```cron
*/30 * * * * docker compose exec -T backend python manage.py refresh_domain_health --limit 200
5 0 * * * docker compose exec -T backend python manage.py apply_scheduled_plan_changes
15 0 1 * * docker compose exec -T backend python manage.py run_monthly_billing
```

Confirm the server timezone intentionally matches the business/reporting timezone, or configure Django's timezone explicitly.

## 9. Support Triage

### Unable to log in

1. Confirm account email/phone and active staff status.
2. Check backend logs for authentication, OTP, CSRF, or email errors.
3. Check rate limits if repeated attempts occurred.
4. Use password reset rather than changing passwords directly in the database.

### HR dashboard or employees cannot load

1. Confirm the user has an HR role in StaffProfile.
2. Confirm browser session cookies are being sent to the API.
3. Confirm the user has an Employee record; create/repair through approved staff synchronization workflow.

### Finance/payroll cannot load

1. Confirm the user holds an authorized finance/HR role.
2. Confirm the hospital association in StaffProfile.
3. Inspect the API response and backend logs; do not grant broad superuser access as a workaround.

### Subscription plan change issue

1. Confirm the requester is the hospital `admin`.
2. Verify the catalog with `seed_subscription_plans`.
3. Check for an existing pending invoice before creating another request.
4. Verify current staff/patient usage is within target plan limits.
5. Confirm payment settlement before expecting the active plan to change.

### Cross-hospital data concern

Treat as high severity. Preserve request details, account, object ID, timestamp, and response; restrict the affected account if necessary; then review audit logs and backend access controls.

## 10. Release Checklist

Before each production deployment:

```bash
cd backend
python manage.py check
python manage.py test --verbosity 1

cd ../frontend
npm run lint
```

Then run the release smoke tests in `SYSTEM_TEST_CASE_BOOK.md`, especially:

- Login and logout
- Hospital registration/trial creation
- Patient-to-payment workflow
- Pharmacy/lab/imaging workflow
- IPD admission and discharge
- HR staff synchronization
- Expense approval
- Cross-hospital isolation
- Starter-to-Basic upgrade invoice and payment activation
- Detailed report and reconciliation access

## 11. Current Verified Baseline

As of August 7, 2026:

- Full Django test suite: 245 passing
- Frontend lint: passing with no warnings
- Subscription Upgrade Now navigation: working
- Starter-to-Basic first invoice: $349.90
- Reports suite: 20 passing; uses local-date report boundaries

Use the test case book as the source of truth for subsequent release acceptance.
