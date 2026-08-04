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
let csrfToken = null;

export const setCsrfToken = (token) => {
  csrfToken = token || null;
  if (csrfToken) {
    sessionStorage.setItem("csrf_token", csrfToken);
  } else {
    sessionStorage.removeItem("csrf_token");
  }
};

const getCookie = (name) => {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
};

// Add custom headers for super admin impersonation
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const method = String(config.method || "get").toLowerCase();
    const storedCsrfToken =
      getCookie("csrftoken") ||
      csrfToken ||
      sessionStorage.getItem("csrf_token");
    if (storedCsrfToken && !["get", "head", "options"].includes(method)) {
      config.headers["X-CSRFToken"] = storedCsrfToken;
    }

    const impersonatingHospitalId = sessionStorage.getItem(
      "impersonating_hospital_id",
    );
    if (impersonatingHospitalId) {
      config.headers["X-Impersonating-Hospital-Id"] = impersonatingHospitalId;

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
      requestUrl.includes("/auth/login/verify/") ||
      requestUrl.includes("/auth/logout/")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshClient.post("/token/refresh/").finally(() => {
          refreshPromise = null;
        });
      }

      await refreshPromise;
      return apiClient(originalRequest);
    } catch (refreshError) {
      localStorage.removeItem("user");
      localStorage.removeItem("hospital");
      localStorage.removeItem("role");
      localStorage.removeItem("is_superuser");
      setCsrfToken(null);
      sessionStorage.removeItem("impersonating_hospital_id");
      sessionStorage.removeItem("super_admin_state");
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
