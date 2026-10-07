import apiClient from './client'
import type { StorageUnit, StorageTray, StorageTrayPosition } from '../types'

export const getStorageUnits = async (): Promise<StorageUnit[]> => {
  const { data } = await apiClient.get<StorageUnit[]>('/storage/units')
  return data
}

export type StorageUnitInput = { name: string; notes?: string }

export const createStorageUnit = async (unit: StorageUnitInput): Promise<StorageUnit> => {
  const { data } = await apiClient.post<StorageUnit>('/storage/units', unit)
  return data
}

export const updateStorageUnit = async (id: number, updates: Partial<StorageUnitInput>): Promise<StorageUnit> => {
  const { data } = await apiClient.put<StorageUnit>(`/storage/units/${id}`, updates)
  return data
}

export const deleteStorageUnit = async (id: number): Promise<void> => {
  await apiClient.delete(`/storage/units/${id}`)
}

export const getStorageTrays = async (unitId?: number): Promise<StorageTray[]> => {
  const { data } = await apiClient.get<StorageTray[]>('/storage/trays', {
    params: unitId !== undefined ? { unit_id: unitId } : {},
  })
  return data
}

export const getStorageTray = async (id: number): Promise<StorageTray> => {
  const { data } = await apiClient.get<StorageTray>(`/storage/trays/${id}`)
  return data
}

export type StorageTrayInput = { unit_id: number; name: string; capacity?: number; notes?: string }

export const createStorageTray = async (tray: StorageTrayInput): Promise<StorageTray> => {
  const { data } = await apiClient.post<StorageTray>('/storage/trays', tray)
  return data
}

export const updateStorageTray = async (id: number, updates: Partial<StorageTrayInput>): Promise<StorageTray> => {
  const { data } = await apiClient.put<StorageTray>(`/storage/trays/${id}`, updates)
  return data
}

export const deleteStorageTray = async (id: number): Promise<void> => {
  await apiClient.delete(`/storage/trays/${id}`)
}

export const getStorageTrayPositions = async (trayId: number): Promise<StorageTrayPosition[]> => {
  const { data } = await apiClient.get<StorageTrayPosition[]>(`/storage/trays/${trayId}/positions`)
  return data
}
