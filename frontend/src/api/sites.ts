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

export const getSiteSpecimens = async (siteId: number): Promise<Specimen[]> => {
  const { data } = await apiClient.get<Specimen[]>(`/sites/${siteId}/specimens`)
  return data
}
