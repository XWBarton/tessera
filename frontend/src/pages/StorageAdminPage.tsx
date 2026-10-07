import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Table, Button, Modal, Form, Input, InputNumber, Select, Space, message, Popconfirm, Tabs } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, AppstoreOutlined } from '@ant-design/icons'
import {
  useStorageUnits, useCreateStorageUnit, useUpdateStorageUnit, useDeleteStorageUnit,
  useStorageTrays, useCreateStorageTray, useUpdateStorageTray, useDeleteStorageTray,
} from '../hooks/useStorage'
import { useAuth } from '../context/AuthContext'
import type { StorageUnit, StorageTray } from '../types'

function UnitsTab() {
  const { user } = useAuth()
  const { data: units, isLoading } = useStorageUnits()
  const createUnit = useCreateStorageUnit()
  const deleteUnit = useDeleteStorageUnit()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StorageUnit | null>(null)
  const updateUnit = useUpdateStorageUnit(editing?.id ?? 0)
  const [form] = Form.useForm()

  const handleCreate = async (values: { name: string; notes?: string }) => {
    try {
      await createUnit.mutateAsync(values)
      message.success('Fridge/freezer added')
      setModalOpen(false)
      form.resetFields()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to add')
    }
  }

  const handleEdit = async (values: { name: string; notes?: string }) => {
    try {
      await updateUnit.mutateAsync(values)
      message.success('Updated')
      setEditing(null)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to update')
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', render: (v: string) => v || '—' },
    ...(user?.is_admin ? [{
      title: '',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: StorageUnit) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => setEditing(record)} />
          <Popconfirm
            title="Delete this fridge/freezer? Its trays will also be deleted."
            onConfirm={() =>
              deleteUnit.mutateAsync(record.id).then(() => message.success('Deleted')).catch(() => message.error('Failed to delete'))
            }
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {user?.is_admin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add Fridge/Freezer
          </Button>
        )}
      </div>
      <Table dataSource={units} columns={columns} rowKey="id" loading={isLoading} />

      <Modal title="Add Fridge/Freezer" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Fridge 1" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createUnit.isPending}>Add</Button>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Edit — ${editing?.name ?? ''}`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        footer={null}
        destroyOnClose
      >
        {editing && (
          <Form key={editing.id} layout="vertical" onFinish={handleEdit} initialValues={editing}>
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={updateUnit.isPending}>Save</Button>
                <Button onClick={() => setEditing(null)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

function TraysTab() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: units } = useStorageUnits()
  const { data: trays, isLoading } = useStorageTrays()
  const createTray = useCreateStorageTray()
  const deleteTray = useDeleteStorageTray()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StorageTray | null>(null)
  const updateTray = useUpdateStorageTray(editing?.id ?? 0)
  const [form] = Form.useForm()

  const unitOptions = (units ?? []).map((u) => ({ value: u.id, label: u.name }))

  const handleCreate = async (values: { unit_id: number; name: string; capacity: number; notes?: string }) => {
    try {
      await createTray.mutateAsync(values)
      message.success('Tray added')
      setModalOpen(false)
      form.resetFields()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to add')
    }
  }

  const handleEdit = async (values: { unit_id: number; name: string; capacity: number; notes?: string }) => {
    try {
      await updateTray.mutateAsync(values)
      message.success('Updated')
      setEditing(null)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to update')
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Fridge/Freezer', key: 'unit', render: (_: unknown, r: StorageTray) => r.unit?.name || '—' },
    { title: 'Capacity', dataIndex: 'capacity', key: 'capacity' },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', render: (v: string) => v || '—' },
    {
      title: '',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: StorageTray) => (
        <Space>
          <Button size="small" icon={<AppstoreOutlined />} onClick={() => navigate(`/storage/trays/${record.id}`)}>
            Browse
          </Button>
          {user?.is_admin && (
            <>
              <Button icon={<EditOutlined />} size="small" onClick={() => setEditing(record)} />
              <Popconfirm
                title="Delete this tray?"
                onConfirm={() =>
                  deleteTray.mutateAsync(record.id).then(() => message.success('Deleted')).catch(() => message.error('Failed to delete'))
                }
              >
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {user?.is_admin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add Tray
          </Button>
        )}
      </div>
      <Table dataSource={trays} columns={columns} rowKey="id" loading={isLoading} />

      <Modal title="Add Tray" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ capacity: 50 }}>
          <Form.Item name="unit_id" label="Fridge/Freezer" rules={[{ required: true }]}>
            <Select placeholder="Select" options={unitOptions} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Tray A12" />
          </Form.Item>
          <Form.Item name="capacity" label="Capacity (positions)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createTray.isPending}>Add</Button>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Edit — ${editing?.name ?? ''}`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        footer={null}
        destroyOnClose
      >
        {editing && (
          <Form key={editing.id} layout="vertical" onFinish={handleEdit} initialValues={editing}>
            <Form.Item name="unit_id" label="Fridge/Freezer" rules={[{ required: true }]}>
              <Select options={unitOptions} />
            </Form.Item>
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="capacity" label="Capacity (positions)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={updateTray.isPending}>Save</Button>
                <Button onClick={() => setEditing(null)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default function StorageAdminPage() {
  return (
    <div>
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>Storage</Typography.Title>
      <Tabs items={[
        { key: 'units', label: 'Fridges/Freezers', children: <UnitsTab /> },
        { key: 'trays', label: 'Trays', children: <TraysTab /> },
      ]} />
    </div>
  )
}
