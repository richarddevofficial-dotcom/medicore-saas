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
  withCredentials: true, // ✅ CRITICAL: Enables httpOnly cookie sending
});

// ✅ SECURITY: Tokens are now in httpOnly cookies (not localStorage)
// This protects against XSS attacks - JS cannot read the token
// Axios automatically sends cookies with requests when withCredentials: true

// Add custom headers for super admin impersonation
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
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
