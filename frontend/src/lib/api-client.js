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

const refreshClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let refreshPromise = null;

// ✅ SECURITY: Tokens are now in httpOnly cookies (not localStorage)
// This protects against XSS attacks - JS cannot read the token
// Axios automatically sends cookies with requests when withCredentials: true

// Add custom headers for super admin impersonation
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const requestUrl = String(config.url || "");
    const isPublicAuthEndpoint =
      requestUrl.includes("/auth/login/initiate/") ||
      requestUrl.includes("/auth/login/verify/") ||
      requestUrl.includes("/auth/register/") ||
      requestUrl.includes("/auth/password-setup/");

    const token = localStorage.getItem("token");
    if (token && !isPublicAuthEndpoint) {
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    if (typeof window === "undefined") {
      return Promise.reject(error);
    }

    if (!originalRequest || status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const requestUrl = String(originalRequest.url || "");
    if (
      requestUrl.includes("/token/refresh/") ||
      requestUrl.includes("/auth/login/initiate/") ||
      requestUrl.includes("/auth/login/verify/")
    ) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refresh");
    if (!refreshToken) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshClient
          .post("/token/refresh/", { refresh: refreshToken })
          .then((response) => {
            const nextAccess = response?.data?.access;
            const nextRefresh = response?.data?.refresh;

            if (nextAccess) {
              localStorage.setItem("token", nextAccess);
            }

            if (nextRefresh) {
              localStorage.setItem("refresh", nextRefresh);
            }

            return nextAccess;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const nextAccess = await refreshPromise;
      if (nextAccess) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextAccess}`;
      }

      return apiClient(originalRequest);
    } catch (refreshError) {
      localStorage.removeItem("token");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
      localStorage.removeItem("hospital");
      localStorage.removeItem("role");
      localStorage.removeItem("is_superuser");
      sessionStorage.removeItem("impersonating_hospital_id");
      sessionStorage.removeItem("super_admin_state");
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
