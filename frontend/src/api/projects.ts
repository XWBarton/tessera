import apiClient from './client'
import type { Project, SpecimenList } from '../types'

export const getProjects = async (): Promise<Project[]> => {
  const { data } = await apiClient.get<Project[]>('/projects/')
  return data
}

export const getProject = async (id: number): Promise<Project> => {
  const { data } = await apiClient.get<Project>(`/projects/${id}`)
  return data
}

export const createProject = async (project: {
  code: string
  name: string
  description?: string
}): Promise<Project> => {
  const { data } = await apiClient.post<Project>('/projects/', project)
  return data
}

export const updateProject = async (
  id: number,
  updates: { name?: string; description?: string }
): Promise<Project> => {
  const { data } = await apiClient.put<Project>(`/projects/${id}`, updates)
  return data
}

export const deleteProject = async (id: number): Promise<void> => {
  await apiClient.delete(`/projects/${id}`)
}

export const getProjectSpecimens = async (
  id: number,
  skip = 0,
  limit = 50
): Promise<SpecimenList> => {
  const { data } = await apiClient.get<SpecimenList>(`/projects/${id}/specimens`, {
    params: { skip, limit },
  })
  return data
}
