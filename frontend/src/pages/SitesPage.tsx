import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Tag, Select, Drawer, Spin } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useSites, useCreateSite, useUpdateSite, useDeleteSite, useSiteSpecimens } from '../hooks/useSites'
import { useAuth } from '../context/AuthContext'
import type { Site, Specimen } from '../types'

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

function SiteSpecimensDrawer({ site, onClose }: { site: Site; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: specimens, isLoading } = useSiteSpecimens(site.id)

  const specimenColumns = [
    {
      title: 'Code',
      dataIndex: 'specimen_code',
      key: 'specimen_code',
      render: (v: string, record: Specimen) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => { onClose(); navigate(`/specimens/${record.id}`) }}>
          {v}
        </Button>
      ),
    },
    { title: 'Project', key: 'project', render: (_: unknown, r: Specimen) => r.project?.code ?? '—' },
    { title: 'Date', dataIndex: 'collection_date', key: 'collection_date', render: (v: string) => v ?? '—' },
    {
      title: 'Species',
      key: 'species',
      render: (_: unknown, r: Specimen) => {
        const first = r.species_associations[0]
        return first ? <em style={{ fontSize: 12 }}>{first.species?.scientific_name || first.free_text_species}</em> : '—'
      },
    },
    { title: 'Sample Type', key: 'sample_type', render: (_: unknown, r: Specimen) => r.sample_type?.name ?? '—' },
  ]

  return (
    <Drawer
      title={
        <span>
          {site.name}
          {site.habitat_type && <Tag style={{ marginLeft: 8 }}>{site.habitat_type}</Tag>}
          {site.precision && <Tag color={PRECISION_COLORS[site.precision] || 'default'} style={{ marginLeft: 4 }}>{site.precision}</Tag>}
        </span>
      }
      open
      onClose={onClose}
      width={700}
    >
      {isLoading ? (
        <Spin />
      ) : (
        <>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            {specimens?.length ?? 0} tube{specimens?.length !== 1 ? 's' : ''} collected at this site
          </Typography.Text>
          <Table
            dataSource={specimens}
            columns={specimenColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
          />
        </>
      )}
    </Drawer>
  )
}

export default function SitesPage() {
  const { user } = useAuth()
  const { data: sites, isLoading } = useSites()
  const createSite = useCreateSite()
  const deleteSite = useDeleteSite()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
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
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record: Site) => (
        <Button type="link" style={{ padding: 0, fontWeight: 500 }} onClick={() => setSelectedSite(record)}>
          {v}
        </Button>
      ),
    },
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
          <Button icon={<EditOutlined />} size="small" onClick={(e) => { e.stopPropagation(); setEditingSite(record) }} />
          <Popconfirm
            title="Delete this site?"
            onConfirm={() =>
              deleteSite
                .mutateAsync(record.id)
                .then(() => message.success('Deleted'))
                .catch(() => message.error('Failed to delete'))
            }
          >
            <Button icon={<DeleteOutlined />} size="small" danger onClick={(e) => e.stopPropagation()} />
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
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Click a site name to view associated tubes.
      </Typography.Text>
      <Table dataSource={sites} columns={columns} rowKey="id" loading={isLoading} />

      <Modal title="Add Site" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} width={520} destroyOnClose>
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

      {selectedSite && (
        <SiteSpecimensDrawer site={selectedSite} onClose={() => setSelectedSite(null)} />
      )}
    </div>
  )
}
