import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLookupOptions, addLookupOption, deleteLookupOption } from '../api/lookups'

export const useLookupOptions = (category: string) =>
  useQuery({
    queryKey: ['lookups', category],
    queryFn: () => getLookupOptions(category),
  })

export const useAddLookupOption = (category: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (value: string) => addLookupOption(category, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lookups', category] }),
  })
}

export const useDeleteLookupOption = (category: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteLookupOption(category, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lookups', category] }),
  })
}
