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

function getHeaders(customHeaders = {}) {
  const token = getAccessToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  };
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: getHeaders(options.headers),
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
    const message =
      data?.detail ||
      data?.message ||
      data?.error ||
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

  return request(
    `/hr/employees/${queryString ? `?${queryString}` : ""}`
  );
}

export function getEmployee(id) {
  return request(`/hr/employees/${id}/`);
}

export function createEmployee(payload) {
  return request("/hr/employees/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEmployee(id, payload) {
  return request(`/hr/employees/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
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
