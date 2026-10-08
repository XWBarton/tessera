import apiClient from './client'
import type { Site, SiteCreate, SiteUpdate, SiteDuplicateMatch, Specimen } from '../types'

export const getSites = async (params?: { q?: string; project_id?: number }): Promise<Site[]> => {
  const { data } = await apiClient.get<Site[]>('/sites/', { params: params || {} })
  return data
}

export const createSite = async (site: SiteCreate): Promise<Site> => {
  const { data } = await apiClient.post<Site>('/sites/', site)
  return data
}

export const updateSite = async (id: number, updates: SiteUpdate): Promise<Site> => {
  const { data } = await apiClient.put<Site>(`/sites/${id}`, updates)
  return data
}

export const deleteSite = async (id: number): Promise<void> => {
  await apiClient.delete(`/sites/${id}`)
}

export interface SiteBulkImportRow {
  name: string
  description?: string
  habitat_type?: string
  lat?: number
  lon?: number
  precision?: string
  notes?: string
}

export interface SiteBulkImportResult {
  created: number
  skipped: number
  errors: string[]
}

export const bulkImportSites = async (rows: SiteBulkImportRow[]): Promise<SiteBulkImportResult> => {
  const { data } = await apiClient.post<SiteBulkImportResult>('/sites/bulk-import', { rows })
  return data
}

export const getSiteSpecimens = async (siteId: number, includeChildren = true): Promise<Specimen[]> => {
  const { data } = await apiClient.get<Specimen[]>(`/sites/${siteId}/specimens`, {
    params: { include_children: includeChildren },
  })
  return data
}

export const getSiteCounts = async (): Promise<Record<string, number>> => {
  const { data } = await apiClient.get<Record<string, number>>('/sites/counts')
  return data
}

export interface DuplicateCheckParams {
  name?: string
  parent_id?: number | null
  lat?: number | null
  lon?: number | null
  radius_m?: number | null
  exclude_id?: number
}

export const checkSiteDuplicates = async (params: DuplicateCheckParams): Promise<SiteDuplicateMatch[]> => {
  const { data } = await apiClient.post<SiteDuplicateMatch[]>('/sites/check-duplicates', params)
  return data
}

export interface HierarchyBackfillResult {
  created: string[]
  moved: { id: number; name: string; to: string }[]
  skipped: { id: number; name: string; reason: string }[]
  applied: boolean
}

export const backfillHierarchy = async (apply: boolean): Promise<HierarchyBackfillResult> => {
  const { data } = await apiClient.post<HierarchyBackfillResult>('/sites/hierarchy-backfill', null, { params: { apply } })
  return data
}

export const mergeSite = async (id: number, targetId: number): Promise<Site> => {
  const { data } = await apiClient.post<Site>(`/sites/${id}/merge`, { target_id: targetId })
  return data
}
