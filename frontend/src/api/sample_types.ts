import apiClient from './client'
import type { SampleType, SampleTypeCreate } from '../types'

export const getSampleTypes = async (): Promise<SampleType[]> => {
  const { data } = await apiClient.get<SampleType[]>('/sample-types/')
  return data
}

export const createSampleType = async (data: SampleTypeCreate): Promise<SampleType> => {
  const { data: res } = await apiClient.post<SampleType>('/sample-types/', data)
  return res
}

export const updateSampleType = async (id: number, data: Partial<SampleTypeCreate>): Promise<SampleType> => {
  const { data: res } = await apiClient.put<SampleType>(`/sample-types/${id}`, data)
  return res
}

export const deleteSampleType = async (id: number): Promise<void> => {
  await apiClient.delete(`/sample-types/${id}`)
}
