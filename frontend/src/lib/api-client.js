import axios from "axios";

const configuredBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const baseURL = configuredBaseUrl.endsWith("/")
  ? configuredBaseUrl
  : `${configuredBaseUrl}/`;

const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const impersonatingHospitalId = sessionStorage.getItem(
      "impersonating_hospital_id",
    );
    if (impersonatingHospitalId) {
      config.headers["X-Impersonating-Hospital-Id"] = impersonatingHospitalId;

      const method = String(config.method || "get").toLowerCase();
      if (["get", "delete", "head", "options"].includes(method)) {
        config.params = {
          ...(config.params || {}),
          hospital_id: config.params?.hospital_id || impersonatingHospitalId,
        };
      }
    }
  }

  return config;
});

export default apiClient;
