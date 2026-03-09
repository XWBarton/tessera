import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Tag, Select, Drawer, Spin, Tabs } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CopyOutlined } from '@ant-design/icons'
import { MapContainer, TileLayer, LayersControl, CircleMarker, Circle, useMap } from 'react-leaflet'
import { useSites, useCreateSite, useUpdateSite, useDeleteSite, useSiteSpecimens } from '../hooks/useSites'
import { useProjects } from '../hooks/useProjects'
import { useAuth } from '../context/AuthContext'
import type { Site, Specimen } from '../types'
import 'leaflet/dist/leaflet.css'

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

const PRECISION_RADIUS_M: Record<string, number> = {
  Suburb: 1500,
  City: 8000,
  Region: 50000,
  State: 150000,
}

const PRECISION_ZOOM: Record<string, number> = {
  GPS: 14,
  Suburb: 12,
  City: 10,
  Region: 8,
  State: 6,
}

function SiteForm({ onFinish, loading, initialValues }: {
  onFinish: (values: Record<string, unknown>) => void
  loading: boolean
  initialValues?: Partial<Site> & { project_ids?: number[] }
}) {
  const [form] = Form.useForm()
  const { data: projects } = useProjects()

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} initialValues={initialValues}>
      <Form.Item name="name" label="Site Name" rules={[{ required: true }]}>
        <Input placeholder="e.g. Wetlands Reserve North" />
      </Form.Item>
      <Form.Item name="project_ids" label="Associated Projects">
        <Select
          mode="multiple"
          placeholder="Tag with one or more projects (optional)"
          allowClear
          options={projects?.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
        />
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

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(t)
  }, [map])
  return null
}

function SiteMap({ site }: { site: Site }) {
  const precision = site.precision || 'GPS'
  const radiusM = PRECISION_RADIUS_M[precision]
  const pos: [number, number] = [site.lat!, site.lon!]
  const zoom = PRECISION_ZOOM[precision] ?? 10

  return (
    <div>
      <MapContainer
        key={site.id}
        center={pos}
        zoom={zoom}
        style={{ height: 320, width: '100%', borderRadius: 8 }}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <InvalidateSize />
        {radiusM ? (
          <Circle
            center={pos}
            radius={radiusM}
            pathOptions={{ fillColor: '#1565c0', color: '#1565c0', weight: 1, opacity: 0.7, fillOpacity: 0.2 }}
          />
        ) : (
          <CircleMarker
            center={pos}
            radius={10}
            pathOptions={{ fillColor: '#1565c0', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.85 }}
          />
        )}
      </MapContainer>
      {precision !== 'GPS' && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          Location shown at {precision.toLowerCase()}-level precision
        </Typography.Text>
      )}
    </div>
  )
}

function SiteSpecimensDrawer({ site, onClose }: { site: Site; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: specimens, isLoading } = useSiteSpecimens(site.id)
  const hasCoords = site.lat != null && site.lon != null

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

  const specimenTab = isLoading ? <Spin /> : (
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
  )

  const tabItems = [
    ...(hasCoords ? [{
      key: 'map',
      label: 'Map',
      children: <SiteMap site={site} />,
    }] : []),
    {
      key: 'specimens',
      label: `Specimens${specimens ? ` (${specimens.length})` : ''}`,
      children: specimenTab,
    },
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
      <Tabs defaultActiveKey={hasCoords ? 'map' : 'specimens'} items={tabItems} />
    </Drawer>
  )
}

export default function SitesPage() {
  const { user } = useAuth()
  const [projectFilter, setProjectFilter] = useState<number | undefined>(undefined)
  const { data: sites, isLoading } = useSites(projectFilter ? { project_id: projectFilter } : undefined)
  const { data: projects } = useProjects()
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
      title: 'Projects',
      key: 'projects',
      render: (_: unknown, r: Site) =>
        r.projects?.length
          ? <Space size={4} wrap>{r.projects.map((p) => <Tag key={p.id} color="blue">{p.code}</Tag>)}</Space>
          : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Precision',
      dataIndex: 'precision',
      key: 'precision',
      width: 110,
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
      render: (_: unknown, r: Site) => r.lat != null ? (
        <Space size={4}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, whiteSpace: 'nowrap' }}>{r.lat}, {r.lon}</span>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            style={{ color: '#aaa', padding: '0 2px' }}
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard.writeText(`${r.lat}, ${r.lon}`)
              message.success('Copied to clipboard')
            }}
          />
        </Space>
      ) : '—',
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
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Add Site
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <Select
          placeholder="Filter by project"
          allowClear
          style={{ width: 220 }}
          value={projectFilter}
          onChange={(v) => setProjectFilter(v)}
          options={projects?.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
        />
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Click a site name to view its location and tubes.
        </Typography.Text>
      </div>
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
            initialValues={{ ...editingSite, project_ids: editingSite.projects?.map((p) => p.id) ?? [] }}
          />
        )}
      </Modal>

      {selectedSite && (
        <SiteSpecimensDrawer site={selectedSite} onClose={() => setSelectedSite(null)} />
      )}
    </div>
  )
}
