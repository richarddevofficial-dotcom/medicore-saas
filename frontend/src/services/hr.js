import apiClient from "@/lib/api-client";

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

export const hrApi = {
  async getDepartments(params = {}) {
    const response = await apiClient.get("/hr/departments/", { params });
    return unwrapList(response.data);
  },

  async createDepartment(payload) {
    const response = await apiClient.post("/hr/departments/", payload);
    return response.data;
  },

  async updateDepartment(id, payload) {
    const response = await apiClient.patch(
      `/hr/departments/${id}/`,
      payload,
    );
    return response.data;
  },

  async deleteDepartment(id) {
    await apiClient.delete(`/hr/departments/${id}/`);
  },

  async getPositions(params = {}) {
    const response = await apiClient.get("/hr/positions/", { params });
    return unwrapList(response.data);
  },

  async createPosition(payload) {
    const response = await apiClient.post("/hr/positions/", payload);
    return response.data;
  },

  async updatePosition(id, payload) {
    const response = await apiClient.patch(
      `/hr/positions/${id}/`,
      payload,
    );
    return response.data;
  },

  async deletePosition(id) {
    await apiClient.delete(`/hr/positions/${id}/`);
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
    const firstValue = Object.values(data)[0];

    if (Array.isArray(firstValue)) {
      return firstValue[0];
    }

    if (typeof firstValue === "string") {
      return firstValue;
    }
  }

  return fallback;
};
