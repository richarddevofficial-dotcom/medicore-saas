import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export function useInsuranceCompanies() {
  return useQuery({
    queryKey: ["insurance-companies"],
    queryFn: async () => {
      const { data } = await apiClient.get("/insurance-companies/");
      return data.results || data;
    },
  });
}

export function useInsuranceClaims() {
  return useQuery({
    queryKey: ["insurance-claims"],
    queryFn: async () => {
      const { data } = await apiClient.get("/insurance-claims/");
      return data.results || data;
    },
  });
}
