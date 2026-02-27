import client from './client'

export interface SetupStatus {
  needs_setup: boolean
}

export interface SetupData {
  username: string
  full_name: string
  email: string
  password: string
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const { data } = await client.get<SetupStatus>('/setup/status')
  return data
}

export async function completeSetup(payload: SetupData): Promise<void> {
  await client.post('/setup/complete', payload)
}
