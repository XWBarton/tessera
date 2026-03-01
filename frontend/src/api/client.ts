import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      const current = window.location.pathname + window.location.search
      const redirect = current !== '/login' ? `?redirect=${encodeURIComponent(current)}` : ''
      window.location.href = `/login${redirect}`
    }
    return Promise.reject(error)
  }
)

export default apiClient
