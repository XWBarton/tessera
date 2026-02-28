import { useState } from 'react'
import {
  Typography,
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  AutoComplete,
  Switch,
  Space,
  message,
  Tag,
  Popconfirm,
  Alert,
} from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, LinkOutlined } from '@ant-design/icons'
import { useUsers, useCreateUser, useUpdateUser } from '../hooks/useUsers'
import { useSampleTypes, useCreateSampleType, useUpdateSampleType, useDeleteSampleType } from '../hooks/useSampleTypes'
import type { User, SampleType } from '../types'
import { useAuth } from '../context/AuthContext'
import { useLookupOptions, useAddLookupOption, useDeleteLookupOption } from '../hooks/useLookups'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

function UsersTab() {
  const { user: currentUser } = useAuth()
  const { data: users, isLoading } = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const handleCreate = async (values: {
    username: string
    full_name: string
    email: string
    password: string
    is_admin: boolean
  }) => {
    try {
      await createUser.mutateAsync({ ...values, is_admin: values.is_admin || false })
      message.success('User created')
      setModalOpen(false)
      form.resetFields()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to create user')
    }
  }

  const columns = [
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Full Name', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Admin',
      dataIndex: 'is_admin',
      key: 'is_admin',
      render: (v: boolean, record: User) => (
        <Switch
          checked={v}
          onChange={() =>
            updateUser
              .mutateAsync({ id: record.id, updates: { is_admin: !v } })
              .catch(() => message.error('Failed to update user'))
          }
        />
      ),
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v: boolean, record: User) => (
        <Switch
          checked={v}
          onChange={() =>
            updateUser
              .mutateAsync({ id: record.id, updates: { is_active: !v } })
              .then(() => message.success(v ? 'User deactivated' : 'User activated'))
              .catch(() => message.error('Failed to update user'))
          }
        />
      ),
    },
  ]

  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          New User
        </Button>
      </div>
      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={isLoading}
      />
      <Modal
        title="Create User"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="is_admin"
            label="Grant Admin Access"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createUser.isPending}
              >
                Create
              </Button>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


function SampleTypesTab() {
  const { data: sampleTypes, isLoading } = useSampleTypes()
  const createSampleType = useCreateSampleType()
  const updateSampleType = useUpdateSampleType()
  const deleteSampleType = useDeleteSampleType()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const { data: unitOpts } = useLookupOptions('unit')
  const unitOptions = (unitOpts ?? []).map((o) => ({ value: o.value }))

  const handleCreate = async (values: { name: string; default_unit?: string; is_specimen: boolean }) => {
    try {
      await createSampleType.mutateAsync(values)
      message.success('Sample type created')
      setModalOpen(false)
      form.resetFields()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to create sample type')
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Default Unit',
      dataIndex: 'default_unit',
      key: 'default_unit',
      render: (v: string) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'Auto-count',
      dataIndex: 'is_specimen',
      key: 'is_specimen',
      render: (v: boolean, record: SampleType) => (
        <Switch
          checked={v}
          checkedChildren="Specimen"
          unCheckedChildren="Sample"
          onChange={(checked) =>
            updateSampleType
              .mutateAsync({ id: record.id, data: { is_specimen: checked } })
              .catch(() => message.error('Failed to update'))
          }
        />
      ),
    },
    {
      title: 'Type',
      dataIndex: 'is_default',
      key: 'is_default',
      render: (v: boolean) => v ? <Tag color="blue">Built-in</Tag> : <Tag>Custom</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: SampleType) => (
        <Popconfirm
          title="Delete this sample type?"
          description={record.is_default ? 'This is a built-in type. Are you sure?' : undefined}
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={() =>
            deleteSampleType
              .mutateAsync(record.id)
              .then(() => message.success('Deleted'))
              .catch(() => message.error('Failed to delete'))
          }
        >
          <Button icon={<DeleteOutlined />} size="small" danger>
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          New Sample Type
        </Button>
      </div>
      <Table dataSource={sampleTypes} columns={columns} rowKey="id" loading={isLoading} />
      <Modal
        title="Add Sample Type"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ is_specimen: false }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Formalin-fixed tissue" />
          </Form.Item>
          <Form.Item name="default_unit" label="Default Unit">
            <AutoComplete
              options={unitOptions}
              placeholder="Select or type a unit"
              filterOption={(input, option) =>
                (option?.value as string).toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="is_specimen"
            label="Auto-count quantity"
            valuePropName="checked"
            extra="When on, quantity is derived from the species breakdown counts instead of being entered manually."
          >
            <Switch checkedChildren="Specimen" unCheckedChildren="Sample" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createSampleType.isPending}>
                Create
              </Button>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function OptionList({ category, label }: { category: string; label: string }) {
  const { data: options, isLoading } = useLookupOptions(category)
  const addOption = useAddLookupOption(category)
  const deleteOption = useDeleteLookupOption(category)
  const [newValue, setNewValue] = useState('')

  const handleAdd = async () => {
    const trimmed = newValue.trim()
    if (!trimmed) return
    try {
      await addOption.mutateAsync(trimmed)
      setNewValue('')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Already exists')
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <Typography.Title level={5} style={{ marginBottom: 12 }}>{label}</Typography.Title>
      <Table
        dataSource={options}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="small"
        style={{ maxWidth: 400, marginBottom: 12 }}
        columns={[
          { title: 'Value', dataIndex: 'value', key: 'value' },
          {
            title: '',
            key: 'actions',
            width: 60,
            render: (_: unknown, record: { id: number; value: string }) => (
              <Popconfirm
                title={`Remove "${record.value}"?`}
                onConfirm={() =>
                  deleteOption
                    .mutateAsync(record.id)
                    .catch(() => message.error('Failed to remove'))
                }
              >
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>
            ),
          },
        ]}
      />
      <Space.Compact style={{ maxWidth: 400 }}>
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={`Add ${label.toLowerCase()} option`}
          onPressEnter={handleAdd}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          loading={addOption.isPending}
        >
          Add
        </Button>
      </Space.Compact>
    </div>
  )
}

function OptionsTab() {
  return (
    <div>
      <OptionList category="life_stage" label="Life Stage" />
      <OptionList category="sex" label="Sex" />
      <OptionList category="unit" label="Units" />
    </div>
  )
}

function IntegrationsTab() {
  const qc = useQueryClient()
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [urlInput, setUrlInput] = useState<string | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<Record<string, string>>('/admin/settings/')
      return data
    },
  })

  const currentUrl = urlInput ?? settings?.elementa_url ?? ''

  const saveSetting = useMutation({
    mutationFn: async (value: string) => {
      await apiClient.put('/admin/settings/elementa_url', { value })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-settings'] })
      qc.invalidateQueries({ queryKey: ['app-config'] })
      message.success('Saved')
      setUrlInput(null)
    },
    onError: () => message.error('Failed to save'),
  })

  const testConnection = async () => {
    const url = currentUrl.trim()
    if (!url) return
    setTestStatus('testing')
    try {
      const { data } = await apiClient.get<{ ok: boolean }>('/admin/settings/test-connection', {
        params: { url },
      })
      setTestStatus(data.ok ? 'ok' : 'fail')
    } catch {
      setTestStatus('fail')
    }
  }

  const isDirty = urlInput !== null && urlInput !== (settings?.elementa_url ?? '')

  return (
    <div style={{ maxWidth: 560 }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Connect Tessera to an <strong>Elementa</strong> instance. Once configured, molecular
        references on tube records will link directly into Elementa and you can open new extractions
        pre-populated with the correct tube.
      </Typography.Paragraph>

      <Typography.Title level={5} style={{ marginBottom: 8 }}>Elementa URL</Typography.Title>
      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
        <Input
          prefix={<LinkOutlined style={{ color: '#bbb' }} />}
          placeholder="e.g. http://192.168.1.10:8080"
          value={currentUrl}
          onChange={(e) => { setUrlInput(e.target.value); setTestStatus('idle') }}
          disabled={isLoading}
          allowClear
          onClear={() => { setUrlInput(''); setTestStatus('idle') }}
        />
        <Button
          onClick={testConnection}
          loading={testStatus === 'testing'}
          disabled={!currentUrl.trim()}
        >
          Test
        </Button>
        <Button
          type="primary"
          onClick={() => saveSetting.mutate(currentUrl.trim())}
          loading={saveSetting.isPending}
          disabled={!isDirty}
        >
          Save
        </Button>
      </Space.Compact>

      {testStatus === 'ok' && (
        <Alert
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          message="Connected — Elementa is reachable"
          style={{ marginTop: 8 }}
        />
      )}
      {testStatus === 'fail' && (
        <Alert
          type="error"
          icon={<CloseCircleOutlined />}
          showIcon
          message="Could not reach Elementa at that URL"
          description="Check the URL and ensure Elementa is running and accessible from this browser."
          style={{ marginTop: 8 }}
        />
      )}
      {!isDirty && settings?.elementa_url && testStatus === 'idle' && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Saved URL: <code>{settings.elementa_url}</code>
        </Typography.Text>
      )}
    </div>
  )
}

function AboutTab() {
  return (
    <div style={{ maxWidth: 540, paddingTop: 8 }}>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src="/tessera-logo.png" alt="Tessera" style={{ height: 56, objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#2e7d32', lineHeight: 1.2 }}>Tessera</div>
          <div style={{ fontSize: 13, color: '#888' }}>Version 1.0</div>
        </div>
      </div>
      <Typography.Paragraph style={{ fontStyle: 'italic', color: '#555', borderLeft: '3px solid #e0e0e0', paddingLeft: 12, marginBottom: 24 }}>
        "A small quadrilateral tablet of wood, bone, ivory, or the like, used for various purposes,
        as a token, tally, ticket, label, etc."
        <br />
        <span style={{ fontSize: 12, color: '#999' }}>— Oxford English Dictionary</span>
      </Typography.Paragraph>
      <Typography.Text type="secondary">Created by Xavier Barton</Typography.Text>
    </div>
  )
}

export default function AdminPage() {
  return (
    <div>
      <Typography.Title level={3}>Settings</Typography.Title>
      <Tabs
        items={[
          { key: 'users', label: 'Users', children: <UsersTab /> },
          { key: 'sample-types', label: 'Sample Types', children: <SampleTypesTab /> },
          { key: 'options', label: 'Dropdown Options', children: <OptionsTab /> },
          { key: 'integrations', label: 'Integrations', children: <IntegrationsTab /> },
          { key: 'about', label: 'About', children: <AboutTab /> },
        ]}
      />
    </div>
  )
}
