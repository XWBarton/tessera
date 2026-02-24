import client from './client'

export interface LookupOption {
  id: number
  category: string
  value: string
  sort_order: number
}

export const getLookupOptions = (category: string) =>
  client.get<LookupOption[]>(`/lookups/${category}`).then((r) => r.data)

export const addLookupOption = (category: string, value: string) =>
  client.post<LookupOption>(`/lookups/${category}`, { value }).then((r) => r.data)

export const deleteLookupOption = (category: string, id: number) =>
  client.delete(`/lookups/${category}/${id}`)
