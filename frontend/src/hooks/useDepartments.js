import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await apiClient.get('/departments/');
      // Return results array (handle both paginated and non-paginated)
      return data.results || data;
    },
  });
}
