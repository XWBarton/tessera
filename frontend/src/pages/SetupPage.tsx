import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, message, Steps, Alert } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons'
import { completeSetup } from '../api/setup'

const { Text } = Typography

interface SetupFormValues {
  full_name: string
  username: string
  email: string
  password: string
  confirm_password: string
}

export default function SetupPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm<SetupFormValues>()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: SetupFormValues) => {
    setLoading(true)
    try {
      await completeSetup({
        username: values.username,
        full_name: values.full_name,
        email: values.email,
        password: values.password,
      })
      message.success('Setup complete! Please log in with your new account.')
      navigate('/login')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Setup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
      }}
    >
      <Card style={{ width: 460, boxShadow: '0 8px 40px rgba(46,125,50,0.12)', borderRadius: 12 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/tessera-logo.png"
            alt="Tessera"
            style={{ height: 72, marginBottom: 12, objectFit: 'contain' }}
          />
          <div
            className="brand-title"
            style={{ fontSize: 32, color: '#2e7d32', marginBottom: 6, lineHeight: 1.1 }}
          >
            Tessera
          </div>
          <Text type="secondary" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 11 }}>
            Initial Setup
          </Text>
        </div>

        <Steps
          size="small"
          current={0}
          items={[{ title: 'Create Admin' }, { title: 'Log In' }, { title: 'Ready' }]}
          style={{ marginBottom: 24 }}
        />

        <Alert
          message="Welcome to Tessera"
          description="Create your administrator account to get started. The default setup account will be removed."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form form={form} layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter your full name' }]}
          >
            <Input prefix={<IdcardOutlined />} placeholder="e.g. Jane Smith" autoFocus />
          </Form.Item>

          <Form.Item
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Please choose a username' },
              { min: 3, message: 'Username must be at least 3 characters' },
              { pattern: /^[a-zA-Z0-9_.-]+$/, message: 'Letters, numbers, _ . - only' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="e.g. jsmith" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Invalid email address' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="e.g. jane@example.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please choose a password' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Minimum 8 characters" />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="Confirm Password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve()
                  return Promise.reject(new Error('Passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Repeat password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Create Account &amp; Continue
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
