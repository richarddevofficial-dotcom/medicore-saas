import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import toast from "react-hot-toast";

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data } = await apiClient.get("/staff/");
      return data;
    },
  });
}

export function useDoctors() {
  return useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const { data } = await apiClient.get("/staff/", {
        params: { role: "doctor", is_active: true },
      });
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.results)) return data.results;
      return [];
    },
  });
}

export function useStaffStats() {
  return useQuery({
    queryKey: ["staff-stats"],
    queryFn: async () => {
      const { data } = await apiClient.get("/staff/stats/");
      return data;
    },
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (staffData) => {
      const payload = { ...staffData };
      if (!payload.department || payload.department === "") {
        delete payload.department;
      }
      const { data } = await apiClient.post("/staff/", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-stats"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("Staff added!");
    },
    onError: (error) => {
      console.error("Create error:", error.response?.data);
      toast.error(error.response?.data?.detail || "Failed to add staff");
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const payload = {};
      Object.keys(data).forEach((key) => {
        if (data[key] !== "" && data[key] !== undefined && data[key] !== null) {
          payload[key] = data[key];
        }
      });
      const { data: response } = await apiClient.patch(
        `/staff/${id}/`,
        payload,
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("Staff updated!");
    },
    onError: (err) => {
      console.error("Update error:", err.response?.data);
      toast.error("Failed to update staff");
    },
  });
}

export function useToggleStaffStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.post(`/staff/${id}/toggle_status/`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-stats"] });
      toast.success(data.message);
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });
}

export function useUpdateStaffRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }) => {
      const { data } = await apiClient.post(`/staff/${id}/update_role/`, {
        role,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success(data.message || "Role updated!");
    },
    onError: () => {
      toast.error("Failed to update role");
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`/staff/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-stats"] });
      toast.success("Staff removed");
    },
    onError: () => {
      toast.error("Failed to remove staff");
    },
  });
}

export function useBulkDeactivateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffIds, reason }) => {
      const { data } = await apiClient.post("/staff/bulk_deactivate/", {
        staff_ids: staffIds,
        reason,
        confirm_count: staffIds.length,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-stats"] });
      toast.success(
        `Deactivated ${data?.deactivated_count || 0} staff account(s)`,
      );
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.error || "Failed to deactivate selected staff",
      );
    },
  });
}
