import apiClient from "@/lib/api-client";

function ipdError(error, fallbackMessage) {
  return new Error(
    error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      fallbackMessage,
  );
}

// ==================== DASHBOARD ====================

export async function getIpdDashboard() {
  try {
    const response = await apiClient.get("/ipd/dashboard/");
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to load IPD dashboard");
  }
}

// ==================== LOOKUPS ====================

export async function getIpdLookups() {
  try {
    const response = await apiClient.get("/ipd/lookups/");
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to load IPD lookups");
  }
}

// ==================== ADMISSIONS ====================

export async function getAdmissions(params = {}) {
  try {
    const response = await apiClient.get("/ipd/admissions/", { params });
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to load admissions");
  }
}

export async function getAdmissionDetail(admissionId) {
  try {
    const response = await apiClient.get(`/ipd/admissions/${admissionId}/`);
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to load admission details");
  }
}

export async function createAdmission(data) {
  try {
    const response = await apiClient.post("/ipd/admissions/", data);
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to create admission");
  }
}

export async function updateAdmission(admissionId, data) {
  try {
    const response = await apiClient.patch(
      `/ipd/admissions/${admissionId}/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to update admission");
  }
}

// ==================== ADMISSION ACTIONS ====================

export async function admitPatient(admissionId, data) {
  try {
    const response = await apiClient.post(
      `/ipd/admissions/${admissionId}/admit/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to admit patient");
  }
}

export async function transferPatient(admissionId, data) {
  try {
    const response = await apiClient.post(
      `/ipd/admissions/${admissionId}/transfer/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to transfer patient");
  }
}

export async function dischargePatient(admissionId, data) {
  try {
    const response = await apiClient.post(
      `/ipd/admissions/${admissionId}/discharge/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to discharge patient");
  }
}

// ==================== NURSING OBSERVATIONS ====================

export async function getNursingObservations(admissionId) {
  try {
    const response = await apiClient.get(
      `/ipd/admissions/${admissionId}/observations/`,
    );
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to load nursing observations");
  }
}

export async function createNursingObservation(admissionId, data) {
  try {
    const response = await apiClient.post(
      `/ipd/admissions/${admissionId}/observations/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to create nursing observation");
  }
}

// ==================== MEDICATION ORDERS ====================

export async function getMedicationOrders(admissionId) {
  try {
    const response = await apiClient.get(
      `/ipd/admissions/${admissionId}/medications/`,
    );
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to load medication orders");
  }
}

export async function createMedicationOrder(admissionId, data) {
  try {
    const response = await apiClient.post(
      `/ipd/admissions/${admissionId}/medications/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to create medication order");
  }
}

export async function administerMedication(medicationId, data) {
  try {
    const response = await apiClient.post(
      `/ipd/medications/${medicationId}/administer/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw ipdError(error, "Failed to administer medication");
  }
}
