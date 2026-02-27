import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { getSetupStatus } from '../../api/setup'

export default function SetupGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    getSetupStatus()
      .then(({ needs_setup }) => {
        if (needs_setup && location.pathname !== '/setup') {
          navigate('/setup', { replace: true })
        } else {
          setChecked(true)
        }
      })
      .catch(() => {
        // If status check fails, let the app proceed normally
        setChecked(true)
      })
  }, [navigate, location.pathname])

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return <>{children}</>
}
