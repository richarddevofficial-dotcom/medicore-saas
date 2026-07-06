import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export function useWards() {
  return useQuery({
    queryKey: ["wards"],
    queryFn: async () => {
      const { data } = await apiClient.get("/wards/");
      return data.results || data;
    },
  });
}

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data } = await apiClient.get("/rooms/");
      return data.results || data;
    },
  });
}

export function useBeds() {
  return useQuery({
    queryKey: ["beds"],
    queryFn: async () => {
      const { data } = await apiClient.get("/beds/");
      return data.results || data;
    },
  });
}
