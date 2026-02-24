import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSpecies, createSpecies, updateSpecies, deleteSpecies } from '../api/species'

export const useSpecies = (q?: string) =>
  useQuery({
    queryKey: ['species', q],
    queryFn: () => getSpecies(q),
  })

export const useCreateSpecies = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSpecies,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['species'] }),
  })
}

export const useUpdateSpecies = (id: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      scientific_name?: string
      common_name?: string
      notes?: string
    }) => updateSpecies(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['species'] }),
  })
}

export const useDeleteSpecies = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSpecies,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['species'] }),
  })
}
