import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useBranding() {
  return useQuery({
    queryKey: ['hospital-branding'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hospitals/my_hospital/');
      return {
        name: data.name || 'MediCore',
        primaryColor: data.primary_color || '#F97316',
        secondaryColor: data.secondary_color || '#1E3A5F',
        customDomain: data.custom_domain || '',
      };
    },
    staleTime: 300000,
  });
}
