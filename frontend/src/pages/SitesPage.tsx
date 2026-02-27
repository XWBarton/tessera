import { useState } from 'react'
import { Typography, Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Tag, Select } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useSites, useCreateSite, useUpdateSite, useDeleteSite } from '../hooks/useSites'
import { useAuth } from '../context/AuthContext'
import type { Site } from '../types'

const PRECISION_OPTIONS = [
  { value: 'GPS', label: 'GPS — exact point' },
  { value: 'Suburb', label: 'Suburb / locality' },
  { value: 'City', label: 'City / town' },
  { value: 'Region', label: 'Region / district' },
  { value: 'State', label: 'State / territory' },
]

const PRECISION_COLORS: Record<string, string> = {
  GPS: 'green',
  Suburb: 'blue',
  City: 'orange',
  Region: 'volcano',
  State: 'red',
}

function SiteForm({ onFinish, loading, initialValues }: {
  onFinish: (values: Record<string, unknown>) => void
  loading: boolean
  initialValues?: Partial<Site>
}) {
  const [form] = Form.useForm()

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} initialValues={initialValues}>
      <Form.Item name="name" label="Site Name" rules={[{ required: true }]}>
        <Input placeholder="e.g. Wetlands Reserve North" />
      </Form.Item>
      <Form.Item name="precision" label="Location Precision">
        <Select placeholder="Select precision level" options={PRECISION_OPTIONS} allowClear />
      </Form.Item>
      <Form.Item name="habitat_type" label="Habitat Type">
        <Input placeholder="e.g. Wetland, Forest, Grassland" />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <Input placeholder="e.g. Northern section near dam wall" />
      </Form.Item>
      <Form.Item label="Coordinates (optional)">
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item name="lat" noStyle>
            <InputNumber style={{ width: '50%' }} placeholder="Latitude" step={0.0001} />
          </Form.Item>
          <Form.Item name="lon" noStyle>
            <InputNumber style={{ width: '50%' }} placeholder="Longitude" step={0.0001} />
          </Form.Item>
        </Space.Compact>
      </Form.Item>
      <Form.Item name="notes" label="Notes">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default function SitesPage() {
  const { user } = useAuth()
  const { data: sites, isLoading } = useSites()
  const createSite = useCreateSite()
  const deleteSite = useDeleteSite()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const updateSite = useUpdateSite(editingSite?.id ?? 0)

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await createSite.mutateAsync(values as never)
      message.success('Site added')
      setCreateOpen(false)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to add site')
    }
  }

  const handleEdit = async (values: Record<string, unknown>) => {
    try {
      await updateSite.mutateAsync(values as never)
      message.success('Site updated')
      setEditingSite(null)
    } catch {
      message.error('Failed to update site')
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Precision',
      dataIndex: 'precision',
      key: 'precision',
      render: (v: string) => v
        ? <Tag color={PRECISION_COLORS[v] || 'default'}>{v}</Tag>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Habitat',
      dataIndex: 'habitat_type',
      key: 'habitat_type',
      render: (v: string) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'Coordinates',
      key: 'coords',
      render: (_: unknown, r: Site) => r.lat != null ? `${r.lat}, ${r.lon}` : '—',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    ...(user?.is_admin ? [{
      title: '',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: Site) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => setEditingSite(record)} />
          <Popconfirm
            title="Delete this site?"
            onConfirm={() =>
              deleteSite
                .mutateAsync(record.id)
                .then(() => message.success('Deleted'))
                .catch(() => message.error('Failed to delete'))
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Sites</Typography.Title>
        {user?.is_admin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Add Site
          </Button>
        )}
      </div>
      <Table dataSource={sites} columns={columns} rowKey="id" loading={isLoading} />

      <Modal title="Add Site" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} width={520}>
        <SiteForm onFinish={handleCreate} loading={createSite.isPending} />
      </Modal>

      <Modal
        title={`Edit — ${editingSite?.name}`}
        open={!!editingSite}
        onCancel={() => setEditingSite(null)}
        footer={null}
        width={520}
      >
        {editingSite && (
          <SiteForm
            key={editingSite.id}
            onFinish={handleEdit}
            loading={updateSite.isPending}
            initialValues={editingSite}
          />
        )}
      </Modal>
    </div>
  )
}
