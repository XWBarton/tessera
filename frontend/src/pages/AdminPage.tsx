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
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useUsers, useCreateUser, useUpdateUser, useHardDeleteUser } from '../hooks/useUsers'
import { useSampleTypes, useCreateSampleType, useDeleteSampleType } from '../hooks/useSampleTypes'
import type { User, SampleType } from '../types'
import { useAuth } from '../context/AuthContext'
import { useLookupOptions, useAddLookupOption, useDeleteLookupOption } from '../hooks/useLookups'

function UsersTab() {
  const { user: currentUser } = useAuth()
  const { data: users, isLoading } = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const hardDelete = useHardDeleteUser()
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
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: User) => (
        <Popconfirm
          title={`Permanently delete ${record.username}?`}
          description="This cannot be undone. The user will be removed from the database."
          okText="Delete"
          okButtonProps={{ danger: true }}
          disabled={record.id === currentUser?.id}
          onConfirm={() =>
            hardDelete
              .mutateAsync(record.id)
              .then(() => message.success('User deleted'))
              .catch(() => message.error('Failed to delete user'))
          }
        >
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            disabled={record.id === currentUser?.id}
          >
            Delete
          </Button>
        </Popconfirm>
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
  const deleteSampleType = useDeleteSampleType()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const { data: unitOpts } = useLookupOptions('unit')
  const unitOptions = (unitOpts ?? []).map((o) => ({ value: o.value }))

  const handleCreate = async (values: { name: string; default_unit?: string }) => {
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
        <Form form={form} layout="vertical" onFinish={handleCreate}>
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

export default function AdminPage() {
  return (
    <div>
      <Typography.Title level={3}>Settings</Typography.Title>
      <Tabs
        items={[
          { key: 'users', label: 'Users', children: <UsersTab /> },
          { key: 'sample-types', label: 'Sample Types', children: <SampleTypesTab /> },
          { key: 'options', label: 'Dropdown Options', children: <OptionsTab /> },
        ]}
      />
    </div>
  )
}
