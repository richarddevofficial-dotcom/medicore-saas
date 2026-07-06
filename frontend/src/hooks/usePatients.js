import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import toast from 'react-hot-toast';

export function usePatients(search = '', page = 1, pageSize = 10) {
  return useQuery({
    queryKey: ['patients', search, page, pageSize],
    queryFn: async () => {
      const { data } = await apiClient.get('/patients/', {
        params: { search, page, page_size: pageSize }
      });
      return data;
    },
    keepPreviousData: true,
  });
}

export function usePatient(mrn) {
  return useQuery({
    queryKey: ['patient', mrn],
    queryFn: async () => {
      const { data } = await apiClient.get(`/patients/${mrn}/`);
      return data;
    },
    enabled: !!mrn,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (patientData) => {
      const { data } = await apiClient.post('/patients/', patientData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Patient registered successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to register patient');
    },
  });
}

export function useUpdatePatient(mrn) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (patientData) => {
      const { data } = await apiClient.put(`/patients/${mrn}/`, patientData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', mrn] });
      toast.success('Patient updated successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update patient');
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (mrn) => {
      await apiClient.delete(`/patients/${mrn}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Patient deleted successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete patient');
    },
  });
}
