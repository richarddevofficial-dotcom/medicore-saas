export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface HRDepartmentSummary {
  department_id: number | null;
  department__name: string | null;
  total: number;
}

export interface HRDashboard {
  total_employees: number;
  active_employees: number;
  employees_on_leave: number;
  pending_leave_requests: number;
  present_today: number;
  absent_today: number;
  contracts_expiring_soon: number;
  departments: HRDepartmentSummary[];
}

export interface Department {
  id: number;
  name: string;
  code?: string;
}

export interface JobPosition {
  id: number;
  hospital?: number;
  department: number | null;
  department_name?: string | null;
  title: string;
  code: string;
  description: string;
  minimum_salary: string;
  maximum_salary: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type EmploymentType =
  | "PERMANENT"
  | "CONTRACT"
  | "PART_TIME"
  | "TEMPORARY"
  | "INTERN"
  | "VOLUNTEER";

export type EmploymentStatus =
  | "ACTIVE"
  | "PROBATION"
  | "SUSPENDED"
  | "ON_LEAVE"
  | "RESIGNED"
  | "TERMINATED"
  | "RETIRED";

export type Gender =
  | "MALE"
  | "FEMALE"
  | "OTHER"
  | "PREFER_NOT_TO_SAY";

export interface Employee {
  id: number;
  user: number | null;
  employee_number: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  gender: Gender | "";
  date_of_birth: string | null;
  national_id: string;
  passport_number: string;
  email: string;
  phone: string;
  alternative_phone: string;
  address: string;
  department: number | null;
  department_name?: string | null;
  position: number | null;
  position_title?: string | null;
  reports_to: number | null;
  reports_to_name?: string | null;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  hire_date: string;
  confirmation_date: string | null;
  termination_date: string | null;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  tax_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  notes: string;
  is_active: boolean;
  photo?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeePayload {
  employee_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender?: Gender | "";
  date_of_birth?: string | null;
  national_id?: string;
  passport_number?: string;
  email?: string;
  phone?: string;
  alternative_phone?: string;
  address?: string;
  department?: number | null;
  position?: number | null;
  reports_to?: number | null;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  hire_date: string;
  confirmation_date?: string | null;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  tax_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  notes?: string;
  is_active: boolean;
}
