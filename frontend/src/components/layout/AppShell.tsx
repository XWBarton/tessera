import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Typography, Space, Avatar } from 'antd'
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
} from '@ant-design/icons'
import { useAuth } from '../../context/AuthContext'

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

const adminItem = { key: '/admin', icon: <SettingOutlined />, label: 'Settings' }

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const allItems = user?.is_admin ? [...menuItems, adminItem] : menuItems

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
            <Avatar
              icon={<UserOutlined />}
              style={{ backgroundColor: '#2e7d32' }}
            />
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
