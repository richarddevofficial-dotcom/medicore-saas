import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useHospitalSettings() {
  return useQuery({
    queryKey: ['hospital-settings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hospitals/settings/');
      return data;
    },
    staleTime: 300000, // Cache for 5 minutes
  });
}
