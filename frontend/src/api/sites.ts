import apiClient from './client'
import type { Site, SiteCreate, SiteUpdate, Specimen } from '../types'

export const getSites = async (q?: string): Promise<Site[]> => {
  const { data } = await apiClient.get<Site[]>('/sites/', {
    params: q !== undefined ? { q } : {},
  })
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

export const getSiteSpecimens = async (siteId: number): Promise<Specimen[]> => {
  const { data } = await apiClient.get<Specimen[]>(`/sites/${siteId}/specimens`)
  return data
}
