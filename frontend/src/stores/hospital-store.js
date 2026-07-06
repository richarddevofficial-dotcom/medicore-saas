import { create } from "zustand";

const useHospitalStore = create((set) => ({
  hospital: null,
  stats: null,

  setHospital: (hospital) => set({ hospital }),

  setStats: (stats) => set({ stats }),

  clearHospital: () => set({ hospital: null, stats: null }),
}));

export default useHospitalStore;
