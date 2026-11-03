import apiClient from './client'
import type { Species } from '../types'
import type { TaxonValues } from '../components/species/TaxonForm'

export const getSpecies = async (q?: string): Promise<Species[]> => {
  const { data } = await apiClient.get<Species[]>('/species/', {
    params: q !== undefined ? { q } : {},
  })
  return data
}

export const createSpecies = async (species: TaxonValues & { scientific_name: string }): Promise<Species> => {
  const { data } = await apiClient.post<Species>('/species/', species)
  return data
}

export type SpeciesInput = TaxonValues

/** The "<Genus> sp." taxon for a genus/family already in the list, created on first use. */
export const getSpeciesAtRank = async (rank: 'genus' | 'family', name: string): Promise<Species> => {
  const { data } = await apiClient.post<Species>('/species/at-rank', { rank, name })
  return data
}

export const updateSpecies = async (
  id: number,
  updates: SpeciesInput
): Promise<Species> => {
  const { data } = await apiClient.put<Species>(`/species/${id}`, updates)
  return data
}

export const deleteSpecies = async (id: number): Promise<void> => {
  await apiClient.delete(`/species/${id}`)
}

export const importSpeciesCSV = async (
  file: File
): Promise<{ created: number; skipped: number; errors: string[] }> => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post('/species/bulk-import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
