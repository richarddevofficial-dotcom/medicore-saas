const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.medicorecloud.com/api/v1";

function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    localStorage.getItem("token")
  );
}

function getCsrfToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const prefix = "csrftoken=";
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix));

  return (
    (cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null) ||
    sessionStorage.getItem("csrf_token")
  );
}

function getHeaders(customHeaders = {}, body = null, method = "GET") {
  const token = getAccessToken();
  const csrfToken = getCsrfToken();
  const normalizedMethod = method.toUpperCase();
  const requiresCsrf = !["GET", "HEAD", "OPTIONS"].includes(normalizedMethod);

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(requiresCsrf && csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    ...customHeaders,
  };
}

function serializeBody(payload) {
  const isFormData =
    typeof FormData !== "undefined" && payload instanceof FormData;

  if (isFormData) {
    return payload;
  }

  if (payload === undefined) {
    return undefined;
  }

  return JSON.stringify(payload);
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: getHeaders(options.headers, options.body, options.method),
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 204) {
    return null;
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const fieldMessage =
      data && typeof data === "object"
        ? Object.entries(data)
            .flatMap(([field, value]) => {
              const messages = Array.isArray(value) ? value : [value];
              return messages
                .filter((item) => typeof item === "string")
                .map((item) => `${field.replaceAll("_", " ")}: ${item}`);
            })
            .join(" ")
        : "";
    const message =
      data?.detail ||
      data?.message ||
      data?.error ||
      fieldMessage ||
      "The request could not be completed.";

    throw new Error(message);
  }

  return data;
}

export function normalizeResults(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

export function getHRDashboard() {
  return request("/hr/dashboard/");
}

export function getEmployees(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();

  return request(`/hr/employees/${queryString ? `?${queryString}` : ""}`);
}

export function getEmployee(id) {
  return request(`/hr/employees/${id}/`);
}

export function createEmployee(payload) {
  return request("/hr/employees/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function updateEmployee(id, payload) {
  return request(`/hr/employees/${id}/`, {
    method: "PATCH",
    body: serializeBody(payload),
  });
}

export function deactivateEmployee(id) {
  return request(`/hr/employees/${id}/deactivate/`, {
    method: "POST",
  });
}

export function deleteEmployee(id) {
  return request(`/hr/employees/${id}/`, {
    method: "DELETE",
  });
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

/* =========================
   DEPARTMENTS
========================= */

export function getDepartments(params = {}) {
  return request(`/hr/departments/${buildQuery(params)}`);
}

export function getDepartment(id) {
  return request(`/hr/departments/${id}/`);
}

export function createDepartment(payload) {
  return request("/hr/departments/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function updateDepartment(id, payload) {
  return request(`/hr/departments/${id}/`, {
    method: "PATCH",
    body: serializeBody(payload),
  });
}

export function deleteDepartment(id) {
  return request(`/hr/departments/${id}/`, {
    method: "DELETE",
  });
}

/* =========================
   POSITIONS
========================= */

export function getPositions(params = {}) {
  return request(`/hr/positions/${buildQuery(params)}`);
}

export function getPosition(id) {
  return request(`/hr/positions/${id}/`);
}

export function createPosition(payload) {
  return request("/hr/positions/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function updatePosition(id, payload) {
  return request(`/hr/positions/${id}/`, {
    method: "PATCH",
    body: serializeBody(payload),
  });
}

export function deletePosition(id) {
  return request(`/hr/positions/${id}/`, {
    method: "DELETE",
  });
}

/* =========================
   CONTRACTS
========================= */

export function getContracts(params = {}) {
  return request(`/hr/contracts/${buildQuery(params)}`);
}

export function getContract(id) {
  return request(`/hr/contracts/${id}/`);
}

export function createContract(payload) {
  return request("/hr/contracts/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function updateContract(id, payload) {
  return request(`/hr/contracts/${id}/`, {
    method: "PATCH",
    body: serializeBody(payload),
  });
}

export function deleteContract(id) {
  return request(`/hr/contracts/${id}/`, {
    method: "DELETE",
  });
}

/* =========================
   SHIFTS
========================= */

export function getShifts(params = {}) {
  return request(`/hr/shifts/${buildQuery(params)}`);
}

export function getShift(id) {
  return request(`/hr/shifts/${id}/`);
}

export function createShift(payload) {
  return request("/hr/shifts/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function updateShift(id, payload) {
  return request(`/hr/shifts/${id}/`, {
    method: "PATCH",
    body: serializeBody(payload),
  });
}

export function deleteShift(id) {
  return request(`/hr/shifts/${id}/`, {
    method: "DELETE",
  });
}

/* =========================
   SHIFT ASSIGNMENTS
========================= */

export function getShiftAssignments(params = {}) {
  return request(`/hr/shift-assignments/${buildQuery(params)}`);
}

export function createShiftAssignment(payload) {
  return request("/hr/shift-assignments/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function updateShiftAssignment(id, payload) {
  return request(`/hr/shift-assignments/${id}/`, {
    method: "PATCH",
    body: serializeBody(payload),
  });
}

export function deleteShiftAssignment(id) {
  return request(`/hr/shift-assignments/${id}/`, {
    method: "DELETE",
  });
}

/* =========================
   ATTENDANCE
========================= */

export function getAttendance(params = {}) {
  return request(`/hr/attendance/${buildQuery(params)}`);
}

export function createAttendance(payload) {
  return request("/hr/attendance/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function updateAttendance(id, payload) {
  return request(`/hr/attendance/${id}/`, {
    method: "PATCH",
    body: serializeBody(payload),
  });
}

export function deleteAttendance(id) {
  return request(`/hr/attendance/${id}/`, {
    method: "DELETE",
  });
}

/* =========================
   LEAVE TYPES
========================= */

export function getLeaveTypes(params = {}) {
  return request(`/hr/leave-types/${buildQuery(params)}`);
}

export function createLeaveType(payload) {
  return request("/hr/leave-types/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function updateLeaveType(id, payload) {
  return request(`/hr/leave-types/${id}/`, {
    method: "PATCH",
    body: serializeBody(payload),
  });
}

export function deleteLeaveType(id) {
  return request(`/hr/leave-types/${id}/`, {
    method: "DELETE",
  });
}

/* =========================
   LEAVE BALANCES
========================= */

export function getLeaveBalances(params = {}) {
  return request(`/hr/leave-balances/${buildQuery(params)}`);
}

export function allocateLeaveBalance(payload) {
  return request("/hr/leave-balances/allocate/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

/* =========================
   LEAVE REQUESTS
========================= */

export function getLeaveRequests(params = {}) {
  return request(`/hr/leave-requests/${buildQuery(params)}`);
}

export function getLeaveRequest(id) {
  return request(`/hr/leave-requests/${id}/`);
}

export function createLeaveRequest(payload) {
  return request("/hr/leave-requests/", {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function updateLeaveRequest(id, payload) {
  return request(`/hr/leave-requests/${id}/`, {
    method: "PATCH",
    body: serializeBody(payload),
  });
}

export function deleteLeaveRequest(id) {
  return request(`/hr/leave-requests/${id}/`, {
    method: "DELETE",
  });
}

export function approveLeaveRequest(id, payload = {}) {
  return request(`/hr/leave-requests/${id}/approve/`, {
    method: "POST",
    body: serializeBody(payload),
  });
}

export function rejectLeaveRequest(id, payload = {}) {
  return request(`/hr/leave-requests/${id}/reject/`, {
    method: "POST",
    body: serializeBody(payload),
  });
}
