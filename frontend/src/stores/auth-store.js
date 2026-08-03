import { create } from "zustand";
import apiClient from "@/lib/api-client";

const useAuthStore = create((set, get) => ({
  user: null,
  hospital: null,
  isAuthenticated: false,
  isLoading: false,

  login: (user, hospital) => {
    // ✅ SECURITY: Token is now in httpOnly cookie, not stored in frontend
    // Only store user info and hospital info for UI purposes
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("hospital", JSON.stringify(hospital));
    localStorage.setItem("role", user?.role || "");

    set({
      user,
      hospital,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
    localStorage.removeItem("hospital");
    localStorage.removeItem("role");
    localStorage.removeItem("impersonating_hospital_id");
    sessionStorage.removeItem("impersonating_hospital_id");
    sessionStorage.removeItem("super_admin_state");

    set({
      user: null,
      hospital: null,
      isAuthenticated: false,
    });
  },

  checkAuth: () => {
    // ✅ SECURITY: Check for user in localStorage instead of token
    // Token is automatically sent by axios via httpOnly cookie
    const user = localStorage.getItem("user");
    const hospital = localStorage.getItem("hospital");

    if (user) {
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
        user: parsedUser,
        hospital: parsedHospital,
        isAuthenticated: Boolean(parsedUser),
      });
      return Boolean(parsedUser);
    }
    return false;
  },
}));

export default useAuthStore;
