import apiClient from './client'
import type { TubeUsageLog, TubeUsageLogCreate } from '../types'

export const getTubeUsage = async (specimenId: number): Promise<TubeUsageLog[]> => {
  const { data } = await apiClient.get<TubeUsageLog[]>(`/specimens/${specimenId}/usage`)
  return data
}

export const recordUsage = async (specimenId: number, data: TubeUsageLogCreate): Promise<TubeUsageLog> => {
  const { data: res } = await apiClient.post<TubeUsageLog>(`/specimens/${specimenId}/usage`, data)
  return res
}

export const deleteUsageEntry = async (specimenId: number, entryId: number): Promise<void> => {
  await apiClient.delete(`/specimens/${specimenId}/usage/${entryId}`)
}
