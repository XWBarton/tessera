import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSites, createSite, updateSite, deleteSite } from '../api/sites'
import type { SiteCreate, SiteUpdate } from '../types'

export const useSites = (q?: string) =>
  useQuery({
    queryKey: ['sites', q],
    queryFn: () => getSites(q),
  })

export const useCreateSite = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SiteCreate) => createSite(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  })
}

export const useUpdateSite = (id: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SiteUpdate) => updateSite(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  })
}

export const useDeleteSite = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  })
}
