import apiClient from './client'
import type { Specimen, SpecimenList, SpecimenCreate, SpecimenUpdate, SpecimenFilters } from '../types'

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

export const downloadLabel = async (id: number, format: 'zpl' | 'csv'): Promise<void> => {
  const response = await apiClient.get(`/specimens/${id}/label`, {
    params: { format },
    responseType: 'blob',
  })
  downloadBlob(response.data, `label_${id}.${format}`)
}

export const bulkDownloadLabels = async (
  specimen_ids: number[],
  format: 'zpl' | 'csv'
): Promise<void> => {
  const response = await apiClient.post(
    '/specimens/bulk-label',
    { specimen_ids, format },
    { responseType: 'blob' }
  )
  downloadBlob(response.data, `labels.${format}`)
}
