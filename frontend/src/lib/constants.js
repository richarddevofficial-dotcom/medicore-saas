// Blood groups
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Gender options
export const GENDER_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "O", label: "Other" },
];

// Patient status
export const PATIENT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

// API endpoints
export const API_ENDPOINTS = {
  LOGIN: "/auth/login/",
  REGISTER: "/auth/register/",
  PATIENTS: "/patients/",
  APPOINTMENTS: "/appointments/",
  STAFF: "/staff/",
  HOSPITAL: "/hospital/",
  DASHBOARD_STATS: "/dashboard/stats/",
};

// Pagination defaults
export const PAGE_SIZE = 10;

// Routes
export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  PATIENTS: "/patients",
  ADD_PATIENT: "/patients/add",
  PATIENT_PROFILE: (mrn) => `/patients/${mrn}`,
  EDIT_PATIENT: (mrn) => `/patients/${mrn}/edit`,
  APPOINTMENTS: "/appointments",
  SETTINGS: "/settings",
};
