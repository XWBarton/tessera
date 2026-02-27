import { useRef, useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Typography, Space, Avatar, Tooltip, message } from 'antd'
import {
  DashboardOutlined,
  ExperimentOutlined,
  ProjectOutlined,
  EnvironmentOutlined,
  PushpinOutlined,
  BugOutlined,
  FieldTimeOutlined,
  ExportOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import { useAuth } from '../../context/AuthContext'
import { uploadAvatar, getAvatarBlob } from '../../api/users'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/specimens', icon: <ExperimentOutlined />, label: 'Tubes' },
  { key: '/projects', icon: <ProjectOutlined />, label: 'Projects' },
  { key: '/species', icon: <BugOutlined />, label: 'Species' },
  { key: '/map', icon: <EnvironmentOutlined />, label: 'Map' },
  { key: '/sites', icon: <PushpinOutlined />, label: 'Sites' },
  { key: '/timeline', icon: <FieldTimeOutlined />, label: 'Timeline' },
  { key: '/export', icon: <ExportOutlined />, label: 'Export' },
]

const adminItems = [
  { key: '/import', icon: <ImportOutlined />, label: 'Bulk Import' },
  { key: '/admin', icon: <SettingOutlined />, label: 'Settings' },
]

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, refreshUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    if (user?.avatar_filename) {
      getAvatarBlob(user.id).then((u) => { url = u; setAvatarUrl(u) }).catch(() => setAvatarUrl(null))
    } else {
      setAvatarUrl(null)
    }
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [user?.id, user?.avatar_filename])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadAvatar(file)
      await refreshUser()
      message.success('Profile photo updated')
    } catch {
      message.error('Failed to upload photo')
    }
    e.target.value = ''
  }

  const allItems = user?.is_admin ? [...menuItems, ...adminItems] : menuItems

  const selectedKey =
    allItems.find((item) => location.pathname.startsWith(item.key))?.key || '/dashboard'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #f0f0f0',
            textAlign: 'center',
          }}
        >
          <img
            src="/tessera-logo.png"
            alt="Tessera"
            style={{ height: 48, marginBottom: 6, objectFit: 'contain' }}
          />
          <div className="brand-title" style={{ fontSize: 22, fontWeight: 700, color: '#2e7d32', lineHeight: 1.2 }}>
            Tessera
          </div>
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Specimen Tracking
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={allItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <Space>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <Tooltip title="Click to change profile photo">
              <Avatar
                src={avatarUrl || undefined}
                icon={!avatarUrl ? <UserOutlined /> : undefined}
                style={{ backgroundColor: '#2e7d32', cursor: 'pointer' }}
                onClick={() => fileInputRef.current?.click()}
              />
            </Tooltip>
            <Text strong>{user?.full_name}</Text>
            {user?.is_admin && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                (Admin)
              </Text>
            )}
            <Button icon={<LogoutOutlined />} type="text" onClick={logout}>
              Logout
            </Button>
          </Space>
        </Header>
        <Content
          style={{
            padding: 24,
            background: '#f5f5f5',
            overflowY: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
