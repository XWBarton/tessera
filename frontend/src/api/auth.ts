import apiClient from './client'
import type { Token, User } from '../types'

export const login = async (username: string, password: string): Promise<Token> => {
  const formData = new URLSearchParams()
  formData.append('username', username)
  formData.append('password', password)
  const { data } = await apiClient.post<Token>('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export const getMe = async (): Promise<User> => {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}

export const changePassword = async (
  current_password: string,
  new_password: string
): Promise<void> => {
  await apiClient.post('/auth/change-password', { current_password, new_password })
}
