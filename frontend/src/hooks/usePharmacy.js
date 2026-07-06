import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useMedicines() {
  return useQuery({
    queryKey: ['medicines'],
    queryFn: async () => {
      const { data } = await apiClient.get('/medicines/');
      return data.results || data;
    },
  });
}
