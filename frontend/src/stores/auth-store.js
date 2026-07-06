import { create } from "zustand";

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
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("hospital");
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

    if (token && user && hospital) {
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
