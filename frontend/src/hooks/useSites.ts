import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSites, createSite, updateSite, deleteSite, getSiteSpecimens, getSiteCounts, checkSiteDuplicates, mergeSite } from '../api/sites'
import type { DuplicateCheckParams } from '../api/sites'
import type { SiteCreate, SiteUpdate } from '../types'

export const useSites = (params?: { q?: string; project_id?: number }) =>
  useQuery({
    queryKey: ['sites', params],
    queryFn: () => getSites(params),
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

export const useSiteSpecimens = (siteId: number | null) =>
  useQuery({
    queryKey: ['site-specimens', siteId],
    queryFn: () => getSiteSpecimens(siteId!),
    enabled: siteId !== null,
  })

export const useDeleteSite = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  })
}

export const useSiteCounts = () =>
  useQuery({ queryKey: ['site-counts'], queryFn: getSiteCounts })

export const useSiteDuplicates = (params: DuplicateCheckParams, enabled: boolean) =>
  useQuery({
    queryKey: ['site-duplicates', params],
    queryFn: () => checkSiteDuplicates(params),
    enabled,
    staleTime: 10_000,
  })

export const useMergeSite = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, targetId }: { id: number; targetId: number }) => mergeSite(id, targetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['site-counts'] })
      qc.invalidateQueries({ queryKey: ['site-specimens'] })
      qc.invalidateQueries({ queryKey: ['specimens'] })
    },
  })
}
