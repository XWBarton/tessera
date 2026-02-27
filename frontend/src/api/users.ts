import apiClient from './client'
import type { User } from '../types'

export const getUsers = async (): Promise<User[]> => {
  const { data } = await apiClient.get<User[]>('/users/')
  return data
}

export const createUser = async (user: {
  username: string
  full_name: string
  email: string
  password: string
  is_admin: boolean
}): Promise<User> => {
  const { data } = await apiClient.post<User>('/users/', user)
  return data
}

export const updateUser = async (
  id: number,
  updates: Partial<User & { password: string }>
): Promise<User> => {
  const { data } = await apiClient.put<User>(`/users/${id}`, updates)
  return data
}

export const deleteUser = async (id: number): Promise<User> => {
  const { data } = await apiClient.delete<User>(`/users/${id}`)
  return data
}

export const hardDeleteUser = async (id: number): Promise<void> => {
  await apiClient.delete(`/users/${id}/hard`)
}

export const uploadAvatar = async (file: File): Promise<User> => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<User>('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const deleteAvatar = async (): Promise<User> => {
  const { data } = await apiClient.delete<User>('/users/me/avatar')
  return data
}

export const getAvatarBlob = async (userId: number): Promise<string> => {
  const response = await apiClient.get(`/users/${userId}/avatar`, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}
