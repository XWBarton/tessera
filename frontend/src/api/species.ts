import apiClient from './client'
import type { Species } from '../types'

export const getSpecies = async (q?: string): Promise<Species[]> => {
  const { data } = await apiClient.get<Species[]>('/species/', {
    params: q !== undefined ? { q } : {},
  })
  return data
}

export const createSpecies = async (species: {
  scientific_name: string
  common_name?: string
  notes?: string
}): Promise<Species> => {
  const { data } = await apiClient.post<Species>('/species/', species)
  return data
}

export const updateSpecies = async (
  id: number,
  updates: Partial<Pick<Species, 'scientific_name' | 'common_name' | 'notes'>>
): Promise<Species> => {
  const { data } = await apiClient.put<Species>(`/species/${id}`, updates)
  return data
}

export const deleteSpecies = async (id: number): Promise<void> => {
  await apiClient.delete(`/species/${id}`)
}
