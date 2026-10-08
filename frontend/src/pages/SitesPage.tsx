import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Tag, Select, Drawer, Spin, Tabs, TreeSelect, Alert, Tree, Dropdown, Collapse, Radio, Descriptions } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CopyOutlined, MergeCellsOutlined, ClusterOutlined, FolderOutlined, FolderOpenOutlined, EnvironmentOutlined, DownloadOutlined, BorderOutlined } from '@ant-design/icons'
import { MapContainer, TileLayer, LayersControl, CircleMarker, Circle, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useSites, useCreateSite, useUpdateSite, useDeleteSite, useSiteSpecimens, useSiteCounts, useSiteDuplicates, useMergeSite, useMoveSite, useBackfillHierarchy } from '../hooks/useSites'
import { buildSiteTree, subtreeIds, effectiveLocation, geoFromParent } from '../utils/siteTree'
import type { SiteNode } from '../utils/siteTree'
import type { TreeProps } from 'antd'
import BoundaryEditor from '../components/sites/BoundaryEditor'
import { boundaryAreaHa, formatHa } from '../utils/geo'
import { downloadSiteExport } from '../api/sites'
import type { SiteBoundary } from '../types'
import type { HierarchyBackfillResult } from '../api/sites'
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

// Only Country and State do anything (they fill in country / state on the sites beneath them);
// everything else is just a site or area, and the tree shows how deep it sits.
const LEVEL_CHOICES = [
  { label: 'Site or area', value: '' },
  { label: 'State / Territory', value: 'State' },
  { label: 'Country', value: 'Country' },
]

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

  const [boundary, setBoundary] = useState<SiteBoundary | null>(initialValues?.boundary ?? null)
  const [boundaryOpen, setBoundaryOpen] = useState(false)

  const name = Form.useWatch('name', form) as string | undefined
  const levelValue = Form.useWatch('level', form) as string | undefined
  const parentId = Form.useWatch('parent_id', form) as number | null | undefined
  const lat = Form.useWatch('lat', form) as number | null | undefined
  const lon = Form.useWatch('lon', form) as number | null | undefined
  const radius = Form.useWatch('radius_m', form) as number | null | undefined

  const parentSite = parentId != null ? allSites?.find((s) => s.id === parentId) : undefined
  const parentLevel = (parentSite?.level ?? '').toLowerCase()
  const suggestedLevel = parentLevel === 'country' ? 'State' : undefined
  // A site saved earlier with some other level (e.g. Town) keeps it as an extra choice
  const legacyLevel = initialValues?.level && !LEVEL_CHOICES.some((c) => c.value === initialValues.level) ? initialValues.level : undefined
  const levelChoices = legacyLevel ? [...LEVEL_CHOICES, { label: legacyLevel, value: legacyLevel }] : LEVEL_CHOICES
  // Open the optional sections up front only when editing a site that already has data in them
  const initialOpenPanels = [
    ...(initialValues && (initialValues.lat != null || initialValues.radius_m != null || initialValues.boundary || initialValues.precision) ? ['location'] : []),
    ...(initialValues && (initialValues.habitat_type || initialValues.description || initialValues.notes || initialValues.projects?.length) ? ['details'] : []),
  ]

  // Picking a parent fills country / state from it straight away
  useEffect(() => {
    if (parentId == null || !allSites) return
    const { country, state } = geoFromParent(allSites, parentId)
    const patch: Record<string, string> = {}
    if (country) patch.country = country
    if (state) patch.state_province = state
    if (Object.keys(patch).length) form.setFieldsValue(patch)
  }, [parentId, allSites, form])

  // Debounce so we don't hit the API on every keystroke
  const [debounced, setDebounced] = useState({ name, parentId, lat, lon, radius, boundary })
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ name, parentId, lat, lon, radius, boundary }), 400)
    return () => clearTimeout(t)
  }, [name, parentId, lat, lon, radius, boundary])

  const hasCoords = (debounced.lat != null && debounced.lon != null) || !!debounced.boundary
  const { data: matches } = useSiteDuplicates(
    {
      name: debounced.name,
      parent_id: debounced.parentId ?? null,
      lat: debounced.lat ?? null,
      lon: debounced.lon ?? null,
      radius_m: debounced.radius ?? null,
      boundary: debounced.boundary,
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
    <Form
      form={form}
      layout="vertical"
      onFinish={(values) => onFinish({ ...values, level: values.level || null, boundary })}
      initialValues={{ parent_id: defaultParentId, ...initialValues, level: initialValues?.level || '' }}
    >
      <Form.Item name="level" label="What is it?" style={{ marginBottom: 8 }}>
        <Radio.Group optionType="button" buttonStyle="solid" options={levelChoices} />
      </Form.Item>
      <div style={{ marginBottom: 16, minHeight: 22 }}>
        {suggestedLevel && suggestedLevel !== levelValue && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Under {parentSite?.name}, this is probably a{' '}
            <a onClick={() => form.setFieldsValue({ level: suggestedLevel })}>{suggestedLevel}</a>
          </Typography.Text>
        )}
      </div>

      <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Give it a name' }]} style={{ marginBottom: 8 }}>
        <Input placeholder={levelValue === 'State' ? 'e.g. Tasmania' : levelValue === 'Country' ? 'e.g. Australia' : 'e.g. Jemmys Point'} autoFocus />
      </Form.Item>

      <Form.Item
        name="parent_id"
        label={<>Inside <Typography.Text type="secondary">(optional)</Typography.Text></>}
        help={levelValue === 'Country' ? 'Countries are top-level, so leave this empty.' : 'The broader place this sits in. Leave empty for a top-level place.'}
        style={{ marginBottom: 12 }}
      >
        <TreeSelect
          allowClear
          showSearch
          treeDefaultExpandAll
          treeNodeFilterProp="title"
          placeholder="Nothing (top-level)"
          treeData={parentTree}
        />
      </Form.Item>
      {(name?.trim() || parentSite) && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
          Will be saved as: <strong>{[parentSite?.path, name?.trim() || '…'].filter(Boolean).join(' > ')}</strong>
        </Typography.Paragraph>
      )}

      <Collapse
        ghost
        style={{ marginBottom: 8 }}
        defaultActiveKey={initialOpenPanels}
        items={[
          {
            key: 'location',
            forceRender: true,
            label: <span>Location <Typography.Text type="secondary">(optional): coordinates, radius, boundary</Typography.Text></span>,
            children: (
              <>
                <Form.Item label="Coordinates">
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="lat" noStyle>
                      <InputNumber style={{ width: '50%' }} placeholder="Latitude" step={0.0001} />
                    </Form.Item>
                    <Form.Item name="lon" noStyle>
                      <InputNumber style={{ width: '50%' }} placeholder="Longitude" step={0.0001} />
                    </Form.Item>
                  </Space.Compact>
                </Form.Item>
                <Form.Item name="radius_m" label="Radius (metres)" help="How far the site extends from the point.">
                  <InputNumber style={{ width: '100%' }} min={0} step={50} placeholder="e.g. 150" />
                </Form.Item>
                <Form.Item
                  label="Boundary"
                  help="Outline the site on the map. Used for overlap checks, matching GPS points to sites, and Shapefile / GeoJSON export."
                >
                  <Space>
                    <Button icon={<BorderOutlined />} onClick={() => setBoundaryOpen(true)}>
                      {boundary ? 'Edit boundary' : 'Draw boundary'}
                    </Button>
                    {boundary && <Tag color="green">{formatHa(boundaryAreaHa(boundary))}</Tag>}
                  </Space>
                </Form.Item>
                <Form.Item name="precision" label="Location precision">
                  <Select placeholder="Select precision level" options={PRECISION_OPTIONS} allowClear />
                </Form.Item>
              </>
            ),
          },
          {
            key: 'details',
            forceRender: true,
            label: <span>More details <Typography.Text type="secondary">(optional): habitat, notes, projects</Typography.Text></span>,
            children: (
              <>
                <Form.Item name="habitat_type" label="Habitat type">
                  <Input placeholder="e.g. Wetland, Forest, Grassland" />
                </Form.Item>
                <Form.Item name="description" label="Description">
                  <Input placeholder="e.g. Northern section near dam wall" />
                </Form.Item>
                <Form.Item name="project_ids" label="Associated projects">
                  <Select
                    mode="multiple"
                    placeholder="Tag with one or more projects"
                    allowClear
                    options={projects?.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                  />
                </Form.Item>
                <Form.Item name="notes" label="Notes">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item label="Country / State" help="Filled in automatically from the place this sits in. Only fill these in for a site that isn't inside a Country / State.">
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="country" noStyle>
                      <Input style={{ width: '50%' }} placeholder="Country" />
                    </Form.Item>
                    <Form.Item name="state_province" noStyle>
                      <Input style={{ width: '50%' }} placeholder="State / Province" />
                    </Form.Item>
                  </Space.Compact>
                </Form.Item>
              </>
            ),
          },
        ]}
      />
      <BoundaryEditor
        open={boundaryOpen}
        value={boundary}
        lat={lat}
        lon={lon}
        radiusM={radius}
        onCancel={() => setBoundaryOpen(false)}
        onSave={(b) => { setBoundary(b); setBoundaryOpen(false) }}
      />
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

async function runSiteExport(
  format: 'geojson' | 'shapefile',
  opts: { siteId?: number; projectId?: number; name?: string },
) {
  try {
    await downloadSiteExport(format, opts)
    message.success(format === 'geojson' ? 'GeoJSON downloaded' : 'Shapefile downloaded')
  } catch (e: unknown) {
    message.error((e as Error).message && !('response' in (e as object)) ? (e as Error).message : 'Export failed')
  }
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

function SiteTreeView({ tree, sites, canEdit, onSelect, onAddChild }: {
  tree: SiteNode[]
  sites: Site[]
  canEdit: boolean
  onSelect: (site: Site) => void
  onAddChild: (parent: Site) => void
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
      icon: n.children?.length
        ? ({ expanded }: { expanded?: boolean }) => (expanded ? <FolderOpenOutlined /> : <FolderOutlined />)
        : <EnvironmentOutlined style={{ color: '#8c8c8c' }} />,
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
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            title={`Add a site under ${n.name}`}
            style={{ marginLeft: 6, color: '#1677ff' }}
            onClick={(e) => { e.stopPropagation(); onAddChild(n) }}
          >
            Add
          </Button>
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
          Click a site to see its details, edit it or export it. Use + Add on a site to create one inside it.{canEdit ? ' Drag one onto another to move it.' : ''}
        </Typography.Text>
      </Space>
      <Tree
        showLine
        showIcon
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
        {...(loc.boundary
          ? { bounds: L.geoJSON({ type: 'Feature', properties: {}, geometry: loc.boundary } as GeoJSON.Feature).getBounds().pad(0.15) }
          : { center: pos, zoom })}
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
        {loc.boundary ? (
          <GeoJSON
            data={{ type: 'Feature', properties: {}, geometry: loc.boundary } as GeoJSON.Feature}
            style={{ color: '#1565c0', weight: 2, fillColor: '#1565c0', fillOpacity: 0.2 }}
          />
        ) : radiusM ? (
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
      ) : loc.boundary ? (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          Boundary covers {formatHa(boundaryAreaHa(loc.boundary))}
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

function SiteDrawer({ site, sites, isAdmin, onClose, onEdit, onAddChild, onMerge, onDelete }: {
  site: Site
  sites: Site[]
  isAdmin: boolean
  onClose: () => void
  onEdit: (site: Site) => void
  onAddChild: (site: Site) => void
  onMerge: (site: Site) => void
  onDelete: (site: Site) => void
}) {
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

  const detailRows: { label: string; value: React.ReactNode }[] = [
    { label: 'Path', value: site.path },
    ...(site.level ? [{ label: 'Type', value: site.level }] : []),
    ...(site.country || site.state_province
      ? [{ label: 'geo_loc_name', value: <Typography.Text code>{[site.country, site.state_province, site.name].filter(Boolean).join(':')}</Typography.Text> }]
      : []),
    ...(site.projects?.length ? [{ label: 'Projects', value: <Space size={4} wrap>{site.projects.map((p) => <Tag key={p.id} color="blue">{p.code}</Tag>)}</Space> }] : []),
    ...(site.habitat_type ? [{ label: 'Habitat', value: site.habitat_type }] : []),
    ...(site.description ? [{ label: 'Description', value: site.description }] : []),
    ...(site.lat != null
      ? [{
          label: 'Coordinates',
          value: (
            <Space size={4}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{site.lat}, {site.lon}</span>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                style={{ color: '#aaa', padding: '0 2px' }}
                onClick={() => { navigator.clipboard.writeText(`${site.lat}, ${site.lon}`); message.success('Copied to clipboard') }}
              />
            </Space>
          ),
        }]
      : []),
    ...(site.radius_m ? [{ label: 'Radius', value: `${site.radius_m} m` }] : []),
    ...(site.boundary ? [{ label: 'Boundary', value: formatHa(boundaryAreaHa(site.boundary)) }] : []),
    ...(site.notes ? [{ label: 'Notes', value: site.notes }] : []),
  ]

  const tabItems = [
    {
      key: 'details',
      label: 'Details',
      children: (
        <Descriptions bordered size="small" column={1} labelStyle={{ width: 130 }}>
          {detailRows.map((r) => <Descriptions.Item key={r.label} label={r.label}>{r.value}</Descriptions.Item>)}
        </Descriptions>
      ),
    },
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
      extra={
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={() => onAddChild(site)}>Add under</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(site)}>Edit</Button>
          <Dropdown
            menu={{
              items: [
                { key: 'geojson', label: 'Export GeoJSON (.geojson)' },
                { key: 'shapefile', label: 'Export Shapefile (.zip)' },
                ...(isAdmin ? [{ key: 'merge', label: 'Merge into another site…', icon: <MergeCellsOutlined /> }] : []),
              ],
              onClick: ({ key }) =>
                key === 'merge'
                  ? onMerge(site)
                  : runSiteExport(key as 'geojson' | 'shapefile', { siteId: site.id, name: site.name.replace(/[^\w-]+/g, '_') }),
            }}
          >
            <Button size="small">More</Button>
          </Dropdown>
          {isAdmin && (
            <Popconfirm
              title="Delete this site?"
              description="Any sub-sites move up one level."
              onConfirm={() => onDelete(site)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      }
    >
      <Tabs defaultActiveKey="details" items={tabItems} />
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
  const backfill = useBackfillHierarchy()
  // One-off cleanup: only offer it while some top-level site still has country/state text but no place above it
  const needsTidy = (allSites ?? []).some((s) =>
    s.parent_id == null &&
    !!(s.country?.trim() || s.state_province?.trim()) &&
    !['country', 'state', 'province', 'territory', 'state/province'].includes((s.level ?? '').trim().toLowerCase()),
  )
  const [tidyPlan, setTidyPlan] = useState<HierarchyBackfillResult | null>(null)
  const openTidy = async () => {
    try {
      setTidyPlan(await backfill.mutateAsync(false))
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Could not build a preview')
    }
  }
  const applyTidy = async () => {
    try {
      const r = await backfill.mutateAsync(true)
      message.success(`Created ${r.created.length} place${r.created.length !== 1 ? 's' : ''}, moved ${r.moved.length} site${r.moved.length !== 1 ? 's' : ''}`)
      setTidyPlan(null)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to apply')
    }
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Sites</Typography.Title>
        <Space>
          <Dropdown
            menu={{
              items: [
                { key: 'geojson', label: 'GeoJSON (.geojson)' },
                { key: 'shapefile', label: 'Shapefile (.zip)' },
              ],
              onClick: ({ key }) => runSiteExport(key as 'geojson' | 'shapefile', { projectId: projectFilter }),
            }}
          >
            <Button icon={<DownloadOutlined />}>Export boundaries</Button>
          </Dropdown>
          {user?.is_admin && needsTidy && (
            <Button icon={<ClusterOutlined />} onClick={openTidy} loading={backfill.isPending && !tidyPlan}>
              Build hierarchy from country / state
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Add Site
          </Button>
        </Space>
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
      </div>
      <Spin spinning={isLoading}>
        <SiteTreeView
          tree={tree}
          sites={sites ?? []}
          canEdit={!!user}
          onSelect={setSelectedSite}
          onAddChild={(p) => { setNewParentId(p.id); setCreateOpen(true) }}
        />
      </Spin>

      <Modal
        title="Build hierarchy from country / state"
        open={!!tidyPlan}
        onCancel={() => setTidyPlan(null)}
        onOk={applyTidy}
        okText="Apply changes"
        okButtonProps={{ disabled: !tidyPlan || (tidyPlan.created.length === 0 && tidyPlan.moved.length === 0), loading: backfill.isPending }}
        width={640}
      >
        {tidyPlan && (tidyPlan.created.length === 0 && tidyPlan.moved.length === 0 && tidyPlan.skipped.length === 0 ? (
          <Typography.Paragraph>Nothing to do: every site with a country or state is already placed under one.</Typography.Paragraph>
        ) : (
          <div>
            <Typography.Paragraph type="secondary">
              Preview only, nothing has been changed yet. Sites at the top level that have a country or state/province
              are moved under matching Country and State places, which are created if they don't exist.
            </Typography.Paragraph>
            {tidyPlan.created.length > 0 && (
              <>
                <Typography.Text strong>New places ({tidyPlan.created.length})</Typography.Text>
                <ul style={{ maxHeight: 140, overflow: 'auto' }}>
                  {tidyPlan.created.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </>
            )}
            {tidyPlan.moved.length > 0 && (
              <>
                <Typography.Text strong>Sites to move ({tidyPlan.moved.length})</Typography.Text>
                <ul style={{ maxHeight: 220, overflow: 'auto' }}>
                  {tidyPlan.moved.map((m) => <li key={m.id}>{m.name} <Typography.Text type="secondary">→ {m.to}</Typography.Text></li>)}
                </ul>
              </>
            )}
            {tidyPlan.skipped.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`${tidyPlan.skipped.length} site${tidyPlan.skipped.length !== 1 ? 's' : ''} left where ${tidyPlan.skipped.length !== 1 ? 'they are' : 'it is'}`}
                description={<ul style={{ margin: 0, paddingLeft: 18 }}>{tidyPlan.skipped.map((k) => <li key={k.id}><strong>{k.name}</strong>: {k.reason}</li>)}</ul>}
              />
            )}
          </div>
        ))}
      </Modal>

      <Modal
        title={newParentId != null ? `Add a site under ${(allSites ?? []).find((x) => x.id === newParentId)?.path ?? '…'}` : 'Add a site'}
        zIndex={1100}
        open={createOpen} onCancel={() => { setCreateOpen(false); setNewParentId(undefined) }} footer={null} width={520} destroyOnClose>
        <SiteForm onFinish={handleCreate} loading={createSite.isPending} defaultParentId={newParentId} />
      </Modal>

      <Modal
        title={`Merge "${mergingSite?.path}"`}
        zIndex={1100}
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
        zIndex={1100}
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
        <SiteDrawer
          // use the freshest copy so edits show up without reopening
          site={allSites?.find((x) => x.id === selectedSite.id) ?? selectedSite}
          sites={allSites ?? []}
          isAdmin={!!user?.is_admin}
          onClose={() => setSelectedSite(null)}
          onEdit={setEditingSite}
          onAddChild={(p) => { setNewParentId(p.id); setCreateOpen(true) }}
          onMerge={(x) => { setMergingSite(x); setMergeTarget(undefined) }}
          onDelete={(x) =>
            deleteSite
              .mutateAsync(x.id)
              .then(() => { message.success('Deleted'); setSelectedSite(null) })
              .catch((e: { response?: { data?: { detail?: string } } }) => message.error(e.response?.data?.detail || 'Failed to delete'))
          }
        />
      )}
    </div>
  )
}
