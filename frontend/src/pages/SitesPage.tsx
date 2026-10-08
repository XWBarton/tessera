import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Tag, Select, Drawer, Spin, Tabs, TreeSelect, AutoComplete, Alert, Tree, Segmented } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CopyOutlined, MergeCellsOutlined, TableOutlined, ApartmentOutlined } from '@ant-design/icons'
import { MapContainer, TileLayer, LayersControl, CircleMarker, Circle, useMap } from 'react-leaflet'
import { useSites, useCreateSite, useUpdateSite, useDeleteSite, useSiteSpecimens, useSiteCounts, useSiteDuplicates, useMergeSite, useMoveSite } from '../hooks/useSites'
import { buildSiteTree, subtreeIds, effectiveLocation, SITE_LEVEL_SUGGESTIONS } from '../utils/siteTree'
import type { SiteNode } from '../utils/siteTree'
import type { TreeProps } from 'antd'
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

const REASON_TEXT: Record<string, string> = { name: 'similar name', nearby: 'overlapping / very close location' }

function SiteForm({ onFinish, loading, initialValues, editingId, defaultParentId }: {
  onFinish: (values: Record<string, unknown>) => void
  loading: boolean
  initialValues?: Partial<Site> & { project_ids?: number[] }
  editingId?: number
  defaultParentId?: number
}) {
  const [form] = Form.useForm()
  const { data: projects } = useProjects()
  const { data: allSites } = useSites()

  const name = Form.useWatch('name', form) as string | undefined
  const parentId = Form.useWatch('parent_id', form) as number | null | undefined
  const lat = Form.useWatch('lat', form) as number | null | undefined
  const lon = Form.useWatch('lon', form) as number | null | undefined
  const radius = Form.useWatch('radius_m', form) as number | null | undefined

  // Debounce so we don't hit the API on every keystroke
  const [debounced, setDebounced] = useState({ name, parentId, lat, lon, radius })
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ name, parentId, lat, lon, radius }), 400)
    return () => clearTimeout(t)
  }, [name, parentId, lat, lon, radius])

  const hasCoords = debounced.lat != null && debounced.lon != null
  const { data: matches } = useSiteDuplicates(
    {
      name: debounced.name,
      parent_id: debounced.parentId ?? null,
      lat: debounced.lat ?? null,
      lon: debounced.lon ?? null,
      radius_m: debounced.radius ?? null,
      exclude_id: editingId,
    },
    (debounced.name?.trim().length ?? 0) >= 3 || hasCoords,
  )

  const parentTree = useMemo(() => {
    const excluded = editingId != null && allSites ? subtreeIds(allSites, editingId) : new Set<number>()
    type TreeOpt = { value: number; title: string; children?: TreeOpt[] }
    const toTreeData = (nodes: SiteNode[]): TreeOpt[] =>
      nodes
        .filter((n) => !excluded.has(n.id))
        .map((n) => ({
          value: n.id,
          title: n.level ? `${n.name} (${n.level})` : n.name,
          children: n.children ? toTreeData(n.children) : undefined,
        }))
    return toTreeData(buildSiteTree(allSites ?? []))
  }, [allSites, editingId])

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ parent_id: defaultParentId, ...initialValues }}>
      <Form.Item name="parent_id" label="Parent Site" help="Place this inside a broader site, e.g. Jemmys Point under Lakes Entrance. Leave empty for a top-level site.">
        <TreeSelect
          allowClear
          showSearch
          treeDefaultExpandAll
          treeNodeFilterProp="title"
          placeholder="None (top-level)"
          treeData={parentTree}
        />
      </Form.Item>
      <Form.Item name="name" label="Site Name" rules={[{ required: true }]}>
        <Input placeholder="e.g. Wetlands Reserve North" />
      </Form.Item>
      <Form.Item name="level" label="Level" help="Optional label for this tier of the hierarchy">
        <AutoComplete
          allowClear
          placeholder="e.g. Town, Locality"
          options={SITE_LEVEL_SUGGESTIONS.map((v) => ({ value: v }))}
        />
      </Form.Item>
      <Form.Item name="country" label="Country" help="MIxS geo_loc_name level 1">
        <Input placeholder="e.g. Australia" />
      </Form.Item>
      <Form.Item name="state_province" label="State / Province" help="MIxS geo_loc_name level 2">
        <Input placeholder="e.g. Western Australia" />
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
      <Form.Item name="radius_m" label="Radius (metres)" help="How far the site extends from the point. Used to draw the area and to detect overlapping sites.">
        <InputNumber style={{ width: '100%' }} min={0} step={50} placeholder="e.g. 150" />
      </Form.Item>
      <Form.Item name="notes" label="Notes">
        <Input.TextArea rows={2} />
      </Form.Item>
      {matches && matches.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={editingId ? 'This site looks similar to existing sites' : 'Similar sites already exist: is this a duplicate?'}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {matches.map((m) => (
                <li key={m.site.id}>
                  <strong>{m.site.path}</strong>
                  {' — '}
                  {m.reasons.map((r) => REASON_TEXT[r]).join(', ')}
                  {m.distance_m != null && m.reasons.includes('nearby') && ` (${Math.round(m.distance_m)} m away)`}
                </li>
              ))}
            </ul>
          }
        />
      )}
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {!editingId && matches && matches.length > 0 ? 'Create anyway' : 'Save'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

function filterTree(nodes: SiteNode[], q: string): SiteNode[] {
  const out: SiteNode[] = []
  for (const n of nodes) {
    const kids = n.children ? filterTree(n.children, q) : []
    if (n.name.toLowerCase().includes(q) || kids.length) out.push({ ...n, children: kids.length ? kids : undefined })
  }
  return out
}

function collectKeys(nodes: SiteNode[]): number[] {
  return nodes.flatMap((n) => (n.children?.length ? [n.id, ...collectKeys(n.children)] : []))
}

function SiteTreeView({ tree, sites, canEdit, onSelect }: {
  tree: SiteNode[]
  sites: Site[]
  canEdit: boolean
  onSelect: (site: Site) => void
}) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<React.Key[]>([])
  const moveSite = useMoveSite()
  const q = search.trim().toLowerCase()
  const visible = useMemo(() => (q ? filterTree(tree, q) : tree), [tree, q])
  // Expand everything while searching so matches are visible
  const expandedKeys = q ? collectKeys(visible) : expanded
  const byId = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites])

  const toData = (nodes: SiteNode[]): NonNullable<TreeProps['treeData']> =>
    nodes.map((n) => ({
      key: n.id,
      title: (
        <span>
          <span style={{ fontWeight: n.children?.length ? 600 : 400 }}>{n.name}</span>
          {n.level && <Tag style={{ marginLeft: 8 }}>{n.level}</Tag>}
          {n.radius_m ? <Typography.Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            ~{n.radius_m >= 1000 ? `${(n.radius_m / 1000).toFixed(1)} km` : `${n.radius_m} m`}
          </Typography.Text> : null}
          <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            {n.total_specimens} specimen{n.total_specimens !== 1 ? 's' : ''}
          </Typography.Text>
        </span>
      ),
      children: n.children ? toData(n.children) : undefined,
    }))

  const handleDrop: TreeProps['onDrop'] = (info) => {
    const dragged = byId.get(Number(info.dragNode.key))
    const target = byId.get(Number(info.node.key))
    if (!dragged || !target) return
    // Dropped onto a node -> becomes its child; dropped in a gap -> becomes its sibling
    const newParentId = info.dropToGap ? (target.parent_id ?? null) : target.id
    if ((dragged.parent_id ?? null) === newParentId) return
    const destination = newParentId == null ? 'the top level' : byId.get(newParentId)?.path
    Modal.confirm({
      title: `Move "${dragged.name}"?`,
      content: `It will be placed under ${destination}.`,
      okText: 'Move',
      onOk: () =>
        moveSite.mutateAsync({ id: dragged.id, parentId: newParentId })
          .then(() => message.success('Site moved'))
          .catch((e: { response?: { data?: { detail?: string } } }) => {
            message.error(e.response?.data?.detail || 'Failed to move site')
          }),
    })
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Search sites"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button size="small" onClick={() => setExpanded(collectKeys(tree))}>Expand all</Button>
        <Button size="small" onClick={() => setExpanded([])}>Collapse all</Button>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {canEdit ? 'Click a site to open it. Drag one onto another to make it a sub-site.' : 'Click a site to open it.'}
        </Typography.Text>
      </Space>
      <Tree
        showLine
        blockNode
        draggable={canEdit && !q}
        treeData={toData(visible)}
        expandedKeys={expandedKeys}
        onExpand={(keys) => !q && setExpanded(keys)}
        onSelect={(keys) => {
          const site = keys.length ? byId.get(Number(keys[0])) : undefined
          if (site) onSelect(site)
        }}
        selectedKeys={[]}
        onDrop={handleDrop}
      />
    </div>
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

function SiteMap({ site, loc }: { site: Site; loc: NonNullable<ReturnType<typeof effectiveLocation>> }) {
  const precision = site.precision || 'GPS'
  const inherited = !!loc.inheritedFrom
  const radiusM = loc.radius_m || (inherited ? undefined : PRECISION_RADIUS_M[precision])
  const pos: [number, number] = [loc.lat, loc.lon]
  const zoom = loc.radius_m
    ? Math.max(5, Math.min(17, Math.round(16 - Math.log2(Math.max(loc.radius_m, 50) / 100))))
    : PRECISION_ZOOM[precision] ?? 10

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
      {inherited ? (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          No coordinates of its own, showing the location of {loc.inheritedFrom!.name}
        </Typography.Text>
      ) : loc.radius_m ? (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          Site extends about {loc.radius_m >= 1000 ? `${(loc.radius_m / 1000).toFixed(1)} km` : `${loc.radius_m} m`} from this point
        </Typography.Text>
      ) : precision !== 'GPS' && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          Location shown at {precision.toLowerCase()}-level precision
        </Typography.Text>
      )}
    </div>
  )
}

function SiteSpecimensDrawer({ site, sites, onClose }: { site: Site; sites: Site[]; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: specimens, isLoading } = useSiteSpecimens(site.id)
  const loc = effectiveLocation(site, sites)
  const hasCoords = loc !== null
  const hasChildren = sites.some((s) => s.parent_id === site.id)

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
        {specimens?.length ?? 0} tube{specimens?.length !== 1 ? 's' : ''} collected at this site{hasChildren ? ' or its sub-sites' : ''}
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
      children: <SiteMap site={site} loc={loc!} />,
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
          {site.path}
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
  const { data: counts } = useSiteCounts()
  const { data: allSites } = useSites()
  const mergeSite = useMergeSite()
  const [view, setView] = useState<'table' | 'tree'>(() => {
    try { return localStorage.getItem('tessera.sitesView') === 'tree' ? 'tree' : 'table' } catch { return 'table' }
  })
  const changeView = (v: 'table' | 'tree') => {
    setView(v)
    try { localStorage.setItem('tessera.sitesView', v) } catch { /* storage unavailable */ }
  }
  const [mergingSite, setMergingSite] = useState<Site | null>(null)
  const [mergeTarget, setMergeTarget] = useState<number | undefined>(undefined)
  const [newParentId, setNewParentId] = useState<number | undefined>(undefined)
  const tree = useMemo(() => buildSiteTree(sites ?? [], counts), [sites, counts])
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
      setNewParentId(undefined)
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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to update site')
    }
  }

  const handleMerge = async () => {
    if (!mergingSite || !mergeTarget) return
    try {
      await mergeSite.mutateAsync({ id: mergingSite.id, targetId: mergeTarget })
      message.success(`Merged "${mergingSite.name}" into the selected site`)
      setMergingSite(null)
      setMergeTarget(undefined)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Merge failed')
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
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (v: string) => v ? <Tag>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Specimens',
      key: 'total_specimens',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, r: SiteNode) => r.total_specimens || <span style={{ color: '#bbb' }}>0</span>,
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
      title: 'geo_loc_name',
      key: 'geo_loc_name',
      render: (_: unknown, r: Site) => {
        const parts = [r.country, r.state_province, r.name].filter(Boolean)
        return parts.length > 1
          ? <Typography.Text code style={{ fontSize: 12 }}>{parts.join(':')}</Typography.Text>
          : <span style={{ color: '#bbb' }}>—</span>
      },
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
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: Site) => (
        <Space>
          <Button
            icon={<PlusOutlined />}
            size="small"
            title="Add sub-site"
            onClick={(e) => { e.stopPropagation(); setNewParentId(record.id); setCreateOpen(true) }}
          />
          <Button icon={<EditOutlined />} size="small" onClick={(e) => { e.stopPropagation(); setEditingSite(record) }} />
          {user?.is_admin && (
            <Button
              icon={<MergeCellsOutlined />}
              size="small"
              title="Merge into another site"
              onClick={(e) => { e.stopPropagation(); setMergingSite(record); setMergeTarget(undefined) }}
            />
          )}
          {user?.is_admin && (
            <Popconfirm
              title="Delete this site?"
              description="Any sub-sites move up one level."
              onConfirm={() =>
                deleteSite
                  .mutateAsync(record.id)
                  .then(() => message.success('Deleted'))
                  .catch(() => message.error('Failed to delete'))
              }
            >
              <Button icon={<DeleteOutlined />} size="small" danger onClick={(e) => e.stopPropagation()} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
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
        <Segmented
          value={view}
          onChange={(v) => changeView(v as 'table' | 'tree')}
          options={[
            { value: 'table', icon: <TableOutlined />, label: 'Table' },
            { value: 'tree', icon: <ApartmentOutlined />, label: 'Tree' },
          ]}
        />
        {view === 'table' && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Click a site name to view its location and tubes.
          </Typography.Text>
        )}
      </div>
      {view === 'tree' ? (
        <SiteTreeView tree={tree} sites={sites ?? []} canEdit={!!user} onSelect={setSelectedSite} />
      ) : (
      <Table
        dataSource={tree}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        expandable={{ childrenColumnName: 'children' }}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
      />
      )}

      <Modal title="Add Site" open={createOpen} onCancel={() => { setCreateOpen(false); setNewParentId(undefined) }} footer={null} width={520} destroyOnClose>
        <SiteForm onFinish={handleCreate} loading={createSite.isPending} defaultParentId={newParentId} />
      </Modal>

      <Modal
        title={`Merge "${mergingSite?.path}"`}
        open={!!mergingSite}
        onCancel={() => setMergingSite(null)}
        onOk={handleMerge}
        okText="Merge"
        okButtonProps={{ disabled: !mergeTarget, danger: true, loading: mergeSite.isPending }}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          Use this when two entries are the same place. All specimens, sub-sites and project tags move to the site you pick, and this site is deleted. Blank fields on the target are filled from this site.
        </Typography.Paragraph>
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Merge into…"
          value={mergeTarget}
          onChange={setMergeTarget}
          optionFilterProp="label"
          options={(allSites ?? [])
            .filter((s) => mergingSite && !subtreeIds(allSites ?? [], mergingSite.id).has(s.id))
            .sort((a, b) => a.path.localeCompare(b.path))
            .map((s) => ({ value: s.id, label: s.path }))}
        />
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
            editingId={editingSite.id}
            onFinish={handleEdit}
            loading={updateSite.isPending}
            initialValues={{ ...editingSite, project_ids: editingSite.projects?.map((p) => p.id) ?? [] }}
          />
        )}
      </Modal>

      {selectedSite && (
        <SiteSpecimensDrawer site={selectedSite} sites={allSites ?? []} onClose={() => setSelectedSite(null)} />
      )}
    </div>
  )
}
