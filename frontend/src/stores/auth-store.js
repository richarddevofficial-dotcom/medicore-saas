import { create } from "zustand";
import apiClient from "@/lib/api-client";

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  hospital: null,
  isAuthenticated: false,
  isLoading: false,

  login: (token, user, hospital) => {
    set({
      token,
      user,
      hospital,
      isAuthenticated: true,
    });
  },

  logout: () => {
    const trustedDeviceToken = localStorage.getItem("trusted_device_token");
    if (trustedDeviceToken) {
      apiClient
        .post("/auth/trusted-device/revoke/", {
          trusted_device_token: trustedDeviceToken,
        })
        .catch(() => {});
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("hospital");
    localStorage.removeItem("trusted_device_token");
    set({
      user: null,
      token: null,
      hospital: null,
      isAuthenticated: false,
    });
  },

  checkAuth: () => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    const hospital = localStorage.getItem("hospital");

    if (token && user) {
      let parsedUser = null;
      let parsedHospital = null;

      try {
        parsedUser = JSON.parse(user);
      } catch {
        parsedUser = null;
      }

      try {
        parsedHospital = JSON.parse(hospital);
      } catch {
        parsedHospital = null;
      }

      set({
        token,
        user: parsedUser,
        hospital: parsedHospital,
        isAuthenticated: Boolean(token && parsedUser),
      });
      return Boolean(token && parsedUser);
    }
    return false;
  },
}));

export default useAuthStore;
