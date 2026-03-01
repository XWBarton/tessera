import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Spin, Typography } from 'antd'
import apiClient from '../api/client'

export default function FindSpecimenPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const code = searchParams.get('code')
  const elementa_ref = searchParams.get('elementa_ref')
  const run_type = searchParams.get('run_type')

  useEffect(() => {
    if (!code) { navigate('/specimens', { replace: true }); return }
    apiClient.get<{ id: number }>('/specimens/find-by-code', { params: { code } })
      .then(({ data }) => {
        const params = new URLSearchParams()
        if (elementa_ref) params.set('elementa_ref', elementa_ref)
        if (run_type) params.set('run_type', run_type)
        const qs = params.toString()
        navigate(`/specimens/${data.id}${qs ? `?${qs}` : ''}`, { replace: true })
      })
      .catch(() => navigate('/specimens', { replace: true }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <Spin size="large" />
      <Typography.Text style={{ display: 'block', marginTop: 16, color: '#888' }}>
        Looking up specimen…
      </Typography.Text>
    </div>
  )
}
