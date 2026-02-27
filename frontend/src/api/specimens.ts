import apiClient from './client'
import type { Specimen, SpecimenList, SpecimenCreate, SpecimenUpdate, SpecimenFilters, SpecimenPhoto, BulkImportRow, BulkImportResult } from '../types'

export const getSpecimens = async (filters: SpecimenFilters = {}): Promise<SpecimenList> => {
  const { data } = await apiClient.get<SpecimenList>('/specimens/', { params: filters })
  return data
}

export const getSpecimen = async (id: number): Promise<Specimen> => {
  const { data } = await apiClient.get<Specimen>(`/specimens/${id}`)
  return data
}

export const createSpecimen = async (specimen: SpecimenCreate): Promise<Specimen> => {
  const { data } = await apiClient.post<Specimen>('/specimens/', specimen)
  return data
}

export const updateSpecimen = async (
  id: number,
  updates: SpecimenUpdate
): Promise<Specimen> => {
  const { data } = await apiClient.put<Specimen>(`/specimens/${id}`, updates)
  return data
}

export const deleteSpecimen = async (id: number): Promise<void> => {
  await apiClient.delete(`/specimens/${id}`)
}

export const bulkImportSpecimens = async (rows: BulkImportRow[]): Promise<BulkImportResult> => {
  const { data } = await apiClient.post<BulkImportResult>('/specimens/bulk-import', { rows })
  return data
}

const downloadBlob = (data: BlobPart, filename: string) => {
  const url = window.URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// ── Photos ─────────────────────────────────────────────────────────────────────

export const getPhotos = async (specimenId: number): Promise<SpecimenPhoto[]> => {
  const { data } = await apiClient.get<SpecimenPhoto[]>(`/specimens/${specimenId}/photos`)
  return data
}

export const uploadPhoto = async (
  specimenId: number,
  file: File,
  caption?: string,
): Promise<SpecimenPhoto> => {
  const formData = new FormData()
  formData.append('file', file)
  if (caption) formData.append('caption', caption)
  const { data } = await apiClient.post<SpecimenPhoto>(
    `/specimens/${specimenId}/photos`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export const deletePhoto = async (specimenId: number, photoId: number): Promise<void> => {
  await apiClient.delete(`/specimens/${specimenId}/photos/${photoId}`)
}

export const getPhotoBlob = async (specimenId: number, photoId: number): Promise<string> => {
  const response = await apiClient.get(
    `/specimens/${specimenId}/photos/${photoId}/file`,
    { responseType: 'blob' },
  )
  return URL.createObjectURL(response.data)
}

// ── Labels ─────────────────────────────────────────────────────────────────────

export type ZplTemplate =
  | 'standard'
  | 'eppendorf_cap'
  | 'eppendorf_side'
  | 'eppendorf_combo'
  | 'falcon'
  | 'bottle'

export const ZPL_TEMPLATE_OPTIONS: { value: ZplTemplate; label: string; description: string }[] = [
  { value: 'eppendorf_cap',   label: 'Eppendorf Cap',   description: '0.5"×0.5" spot for Eppendorf lid' },
  { value: 'eppendorf_side',  label: 'Eppendorf Side',  description: '1.75"×0.5" side strip for Eppendorf tube' },
  { value: 'eppendorf_combo', label: 'Eppendorf Combo', description: 'Cap spot + side strip (two labels)' },
  { value: 'falcon',          label: 'Falcon Tube',     description: '2"×0.875" for 20mL/50mL Falcon tubes' },
  { value: 'bottle',          label: 'Bottle',          description: '3"×2" for larger bottles' },
  { value: 'standard',        label: 'Standard',        description: 'Generic label (no fixed size)' },
]

export const downloadLabel = async (id: number, format: 'zpl' | 'csv', template: ZplTemplate = 'standard'): Promise<void> => {
  const response = await apiClient.get(`/specimens/${id}/label`, {
    params: { format, template },
    responseType: 'blob',
  })
  downloadBlob(response.data, `label_${id}_${template}.${format}`)
}

export const bulkDownloadLabels = async (
  specimen_ids: number[],
  format: 'zpl' | 'csv',
  template: ZplTemplate = 'standard'
): Promise<void> => {
  const response = await apiClient.post(
    '/specimens/bulk-label',
    { specimen_ids, format, template },
    { responseType: 'blob' }
  )
  downloadBlob(response.data, `labels_${template}.${format}`)
}
