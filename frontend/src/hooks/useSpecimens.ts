import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSpecimens,
  getSpecimen,
  createSpecimen,
  updateSpecimen,
  deleteSpecimen,
  getSpecimenStats,
} from '../api/specimens'
import type { SpecimenFilters, SpecimenCreate, SpecimenUpdate } from '../types'

export const useSpecimens = (filters: SpecimenFilters = {}) =>
  useQuery({
    queryKey: ['specimens', filters],
    queryFn: () => getSpecimens(filters),
  })

export const useSpecimen = (id: number) =>
  useQuery({
    queryKey: ['specimen', id],
    queryFn: () => getSpecimen(id),
    enabled: !!id,
  })

export const useCreateSpecimen = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SpecimenCreate) => createSpecimen(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['specimens'] }),
  })
}

export const useUpdateSpecimen = (id: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SpecimenUpdate) => updateSpecimen(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['specimens'] })
      qc.invalidateQueries({ queryKey: ['specimen', id] })
    },
  })
}

export const useDeleteSpecimen = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteSpecimen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['specimens'] }),
  })
}

export function useSpecimenStats() {
  return useQuery({ queryKey: ['specimen_stats'], queryFn: getSpecimenStats, staleTime: 60_000 })
}
