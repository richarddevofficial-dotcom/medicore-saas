import apiClient from "@/lib/api-client";

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const list = async (url, params = {}) => {
  const response = await apiClient.get(url, { params });
  return unwrapList(response.data);
};

export const hrApi = {
  getEmployees(params = {}) {
    return list("/hr/employees/", params);
  },

  getDepartments(params = {}) {
    return list("/hr/departments/", params);
  },

  createDepartment(payload) {
    return apiClient
      .post("/hr/departments/", payload)
      .then((response) => response.data);
  },

  updateDepartment(id, payload) {
    return apiClient
      .patch(`/hr/departments/${id}/`, payload)
      .then((response) => response.data);
  },

  deleteDepartment(id) {
    return apiClient.delete(`/hr/departments/${id}/`);
  },

  getPositions(params = {}) {
    return list("/hr/positions/", params);
  },

  createPosition(payload) {
    return apiClient
      .post("/hr/positions/", payload)
      .then((response) => response.data);
  },

  updatePosition(id, payload) {
    return apiClient
      .patch(`/hr/positions/${id}/`, payload)
      .then((response) => response.data);
  },

  deletePosition(id) {
    return apiClient.delete(`/hr/positions/${id}/`);
  },

  getContracts(params = {}) {
    return list("/hr/contracts/", params);
  },

  getContract(id) {
    return apiClient
      .get(`/hr/contracts/${id}/`)
      .then((response) => response.data);
  },

  createContract(payload) {
    return apiClient
      .post("/hr/contracts/", payload)
      .then((response) => response.data);
  },

  updateContract(id, payload) {
    return apiClient
      .patch(`/hr/contracts/${id}/`, payload)
      .then((response) => response.data);
  },

  deleteContract(id) {
    return apiClient.delete(`/hr/contracts/${id}/`);
  },
};

export const getApiError = (
  error,
  fallback = "Something went wrong.",
) => {
  const data = error?.response?.data;

  if (typeof data === "string") return data;
  if (data?.detail) return data.detail;
  if (data?.error) return data.error;

  if (data && typeof data === "object") {
    const firstEntry = Object.entries(data)[0];

    if (firstEntry) {
      const [field, value] = firstEntry;
      const message = Array.isArray(value)
        ? value[0]
        : value;

      if (typeof message === "string") {
        return `${field}: ${message}`;
      }
    }
  }

  return fallback;
};
