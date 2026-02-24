import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSampleTypes, createSampleType, deleteSampleType } from '../api/sample_types'
import type { SampleTypeCreate } from '../types'

export const useSampleTypes = () =>
  useQuery({ queryKey: ['sample-types'], queryFn: getSampleTypes })

export const useCreateSampleType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SampleTypeCreate) => createSampleType(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sample-types'] }),
  })
}

export const useDeleteSampleType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSampleType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sample-types'] }),
  })
}
