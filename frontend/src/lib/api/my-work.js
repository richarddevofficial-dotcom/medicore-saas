import apiClient from "@/lib/api-client";

function normalizeResults(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data;
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

  return (
    data?.detail || data?.message || data?.error || fieldMessage || fallback
  );
}

async function list(url, params) {
  try {
    const response = await apiClient.get(url, { params });
    return normalizeResults(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load your work data."));
  }
}

export function getMyShifts(params = {}) {
  return list("hr/me/shifts/", params);
}

export function getMyAttendance(params = {}) {
  return list("hr/me/attendance/", params);
}

export async function getMyAttendanceStatus() {
  try {
    const response = await apiClient.get("hr/me/attendance/status/");
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to load your attendance status."),
    );
  }
}

async function attendanceAction(action) {
  try {
    const response = await apiClient.post(`hr/me/attendance/${action}/`);
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to update your attendance."),
    );
  }
}

export function clockIn() {
  return attendanceAction("clock-in");
}

export function clockOut() {
  return attendanceAction("clock-out");
}

export function getMyLeaveTypes() {
  return list("hr/me/leave-types/");
}

export function getMyLeaveBalances(params = {}) {
  return list("hr/me/leave-balances/", params);
}

export function getMyLeaveRequests() {
  return list("hr/me/leave-requests/");
}

export async function createMyLeaveRequest(payload) {
  try {
    const response = await apiClient.post("hr/me/leave-requests/", payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to submit leave request."));
  }
}
