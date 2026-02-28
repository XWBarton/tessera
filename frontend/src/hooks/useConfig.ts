import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

interface AppConfig {
  elementa_url: string
}

export const useConfig = () =>
  useQuery<AppConfig>({
    queryKey: ['app-config'],
    queryFn: async () => {
      const { data } = await client.get<AppConfig>('/config')
      return data
    },
    staleTime: Infinity, // config doesn't change at runtime
  })
