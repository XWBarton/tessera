import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getStorageUnits, createStorageUnit, updateStorageUnit, deleteStorageUnit,
  getStorageTrays, getStorageTray, createStorageTray, updateStorageTray, deleteStorageTray,
  getStorageTrayPositions,
} from '../api/storage'
import type { StorageUnitInput, StorageTrayInput } from '../api/storage'

export const useStorageUnits = () =>
  useQuery({ queryKey: ['storage_units'], queryFn: getStorageUnits })

export const useCreateStorageUnit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createStorageUnit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage_units'] }),
  })
}

export const useUpdateStorageUnit = (id: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<StorageUnitInput>) => updateStorageUnit(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage_units'] }),
  })
}

export const useDeleteStorageUnit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteStorageUnit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['storage_units'] })
      qc.invalidateQueries({ queryKey: ['storage_trays'] })
    },
  })
}

export const useStorageTrays = (unitId?: number) =>
  useQuery({ queryKey: ['storage_trays', unitId], queryFn: () => getStorageTrays(unitId) })

export const useStorageTray = (id: number) =>
  useQuery({ queryKey: ['storage_tray', id], queryFn: () => getStorageTray(id), enabled: !!id })

export const useCreateStorageTray = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createStorageTray,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage_trays'] }),
  })
}

export const useUpdateStorageTray = (id: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<StorageTrayInput>) => updateStorageTray(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['storage_trays'] })
      qc.invalidateQueries({ queryKey: ['storage_tray', id] })
    },
  })
}

export const useDeleteStorageTray = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteStorageTray,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage_trays'] }),
  })
}

export const useStorageTrayPositions = (trayId: number) =>
  useQuery({
    queryKey: ['storage_tray_positions', trayId],
    queryFn: () => getStorageTrayPositions(trayId),
    enabled: !!trayId,
  })
