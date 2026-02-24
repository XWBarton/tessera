import apiClient from './client'

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

export const exportSpecimens = async (
  params: Record<string, unknown> = {}
): Promise<void> => {
  const response = await apiClient.get('/export/specimens', {
    params,
    responseType: 'blob',
  })
  downloadBlob(response.data, 'specimens_export.csv')
}

export const exportByProject = async (projectId: number): Promise<void> => {
  const response = await apiClient.get(
    `/export/specimens/project/${projectId}`,
    { responseType: 'blob' }
  )
  downloadBlob(response.data, `project_${projectId}_specimens.csv`)
}

export const exportByCollector = async (collectorId: number): Promise<void> => {
  const response = await apiClient.get(
    `/export/specimens/collector/${collectorId}`,
    { responseType: 'blob' }
  )
  downloadBlob(response.data, `collector_${collectorId}_specimens.csv`)
}

export const exportBySpecies = async (speciesId: number): Promise<void> => {
  const response = await apiClient.get(
    `/export/specimens/species/${speciesId}`,
    { responseType: 'blob' }
  )
  downloadBlob(response.data, `species_${speciesId}_specimens.csv`)
}

export const restoreBackup = async (file: File): Promise<void> => {
  const formData = new FormData()
  formData.append('file', file)
  await apiClient.post('/export/restore', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const downloadBackup = async (): Promise<void> => {
  const response = await apiClient.get('/export/backup', { responseType: 'blob' })
  const disposition = response.headers['content-disposition'] || ''
  const match = disposition.match(/filename="(.+)"/)
  const filename = match ? match[1] : 'tessera_backup.db'
  downloadBlob(response.data, filename)
}
