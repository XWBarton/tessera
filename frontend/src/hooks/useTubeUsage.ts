import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTubeUsage, recordUsage, deleteUsageEntry } from '../api/tube_usage'
import type { TubeUsageLogCreate } from '../types'

export const useTubeUsage = (specimenId: number) =>
  useQuery({
    queryKey: ['tube-usage', specimenId],
    queryFn: () => getTubeUsage(specimenId),
    enabled: !!specimenId,
  })

export const useRecordUsage = (specimenId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TubeUsageLogCreate) => recordUsage(specimenId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tube-usage', specimenId] })
      qc.invalidateQueries({ queryKey: ['specimen', specimenId] })
    },
  })
}

export const useDeleteUsageEntry = (specimenId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId: number) => deleteUsageEntry(specimenId, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tube-usage', specimenId] })
      qc.invalidateQueries({ queryKey: ['specimen', specimenId] })
    },
  })
}
