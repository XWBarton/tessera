import { useState, useMemo, useEffect } from 'react'
import { Typography, Card, Select, Space, Tabs } from 'antd'
import {
  MapContainer, TileLayer, LayersControl,
  CircleMarker, Circle, Popup, useMap,
} from 'react-leaflet'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { useSpecimens } from '../hooks/useSpecimens'
import { useProjects } from '../hooks/useProjects'
import { useUsers } from '../hooks/useUsers'
import { useSpecies } from '../hooks/useSpecies'
import 'leaflet/dist/leaflet.css'

// ── Shared constants ───────────────────────────────────────────────────────────

const OSM_LAYER = (
  <TileLayer
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
)
const SATELLITE_LAYER = (
  <TileLayer
    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  />
)

const CONFIDENCE_COLORS: Record<string, string> = {
  Confirmed: '#2e7d32',
  Probable:  '#1565c0',
  Possible:  '#e65100',
  Unknown:   '#757575',
}

const PRECISION_RADIUS_M: Record<string, number> = {
  Suburb: 1500, City: 8000, Region: 50000, State: 150000,
}

const PRECISION_LABEL: Record<string, string> = {
  GPS: 'GPS (exact)', Suburb: 'Suburb', City: 'City', Region: 'Region', State: 'State',
}

const PALETTE = [
  '#1677ff','#fa8c16','#722ed1','#13c2c2','#f5222d',
  '#52c41a','#eb2f96','#2f54eb','#fa541c','#fadb14',
]

// ── Leaflet helper ─────────────────────────────────────────────────────────────

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(t)
  }, [map])
  return null
}

// ── Filter bar ─────────────────────────────────────────────────────────────────

interface Filters {
  project_id?: number
  collector_id?: number
  species_id?: number
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const { data: projects } = useProjects()
  const { data: users } = useUsers()
  const { data: species } = useSpecies()

  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Select
        allowClear
        placeholder="All projects"
        style={{ minWidth: 180 }}
        value={filters.project_id}
        onChange={(v) => onChange({ ...filters, project_id: v })}
        options={(projects || []).map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
        showSearch
        filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
      />
      <Select
        allowClear
        placeholder="All collectors"
        style={{ minWidth: 160 }}
        value={filters.collector_id}
        onChange={(v) => onChange({ ...filters, collector_id: v })}
        options={(users || []).map((u) => ({ value: u.id, label: u.full_name }))}
        showSearch
        filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
      />
      <Select
        allowClear
        placeholder="All species"
        style={{ minWidth: 200 }}
        value={filters.species_id}
        onChange={(v) => onChange({ ...filters, species_id: v })}
        options={(species || []).map((s) => ({ value: s.id, label: s.scientific_name }))}
        showSearch
        filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
      />
    </Space>
  )
}

// ── Map tab ────────────────────────────────────────────────────────────────────

function MapView({ filters }: { filters: Filters }) {
  const { data } = useSpecimens({ limit: 2000, ...filters })

  const specimens = useMemo(
    () => (data?.items || []).filter((s) => s.collection_lat != null && s.collection_lon != null),
    [data]
  )

  const center: [number, number] =
    specimens.length > 0 ? [specimens[0].collection_lat!, specimens[0].collection_lon!] : [0, 0]

  const presentPrecisions = useMemo(() => {
    const seen = new Set<string>()
    specimens.forEach((s) => seen.add(s.sites?.[0]?.precision || 'GPS'))
    return Array.from(seen).sort((a, b) =>
      Object.keys(PRECISION_LABEL).indexOf(a) - Object.keys(PRECISION_LABEL).indexOf(b)
    )
  }, [specimens])

  return (
    <div>
      <Card bodyStyle={{ padding: 0, overflow: 'hidden', borderRadius: 8 }}>
        <MapContainer center={center} zoom={specimens.length > 0 ? 8 : 2} style={{ height: '65vh', width: '100%' }}>
          <InvalidateSize />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Street">{OSM_LAYER}</LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">{SATELLITE_LAYER}</LayersControl.BaseLayer>
          </LayersControl>
          {specimens.map((s) => {
            const first = s.species_associations[0]
            const color = first ? CONFIDENCE_COLORS[first.confidence] || '#757575' : '#757575'
            const precision = s.sites?.[0]?.precision || 'GPS'
            const radiusM = PRECISION_RADIUS_M[precision]
            const pos: [number, number] = [s.collection_lat!, s.collection_lon!]
            const popup = (
              <Popup>
                <strong>{s.specimen_code}</strong><br />
                {s.project?.code}<br />
                <em>{first?.species?.scientific_name || first?.free_text_species || 'Unknown species'}</em><br />
                {s.collection_date}
                {s.sites?.length > 0 && (
                  <><br /><span style={{ color: '#888', fontSize: 11 }}>
                    {s.sites.map((st) => st.name).join(', ')}{precision !== 'GPS' ? ` (${precision}-level)` : ''}
                  </span></>
                )}<br />
                {s.collector?.full_name || s.collector_name}
              </Popup>
            )
            if (radiusM) {
              return (
                <Circle key={s.id} center={pos} radius={radiusM}
                  pathOptions={{ fillColor: color, color, weight: 1, opacity: 0.6, fillOpacity: 0.25 }}>
                  {popup}
                </Circle>
              )
            }
            return (
              <CircleMarker key={s.id} center={pos} radius={8}
                pathOptions={{ fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.85 }}>
                {popup}
              </CircleMarker>
            )
          })}
        </MapContainer>
      </Card>

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '12px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Confidence:</span>
          {Object.entries(CONFIDENCE_COLORS).map(([k, v]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: v, display: 'inline-block', border: '2px solid #fff', boxShadow: '0 0 0 1px #ccc' }} />
              {k}
            </span>
          ))}
        </div>
        {presentPrecisions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Precision:</span>
            {presentPrecisions.map((p) => {
              const isPoint = !PRECISION_RADIUS_M[p]
              return (
                <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                  {isPoint
                    ? <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#555', display: 'inline-block', border: '2px solid #fff', boxShadow: '0 0 0 1px #ccc' }} />
                    : <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(80,80,80,0.15)', border: '1.5px solid #888', display: 'inline-block' }} />
                  }
                  {PRECISION_LABEL[p] || p}
                </span>
              )
            })}
          </div>
        )}
        {specimens.length === 0 && (
          <span style={{ color: '#888', fontSize: 12 }}>No tubes with coordinates to display.</span>
        )}
      </div>
    </div>
  )
}

// ── Timeline tab ───────────────────────────────────────────────────────────────

function TimelineView({ filters }: { filters: Filters }) {
  const { data } = useSpecimens({ limit: 1000, sort_by: 'collection_date', sort_dir: 'asc', ...filters })

  const { chartDataByProject, projectNames } = useMemo(() => {
    const items = data?.items || []
    const projectIndex: Record<string, number> = {}
    let idx = 0

    const allPoints = items
      .filter((s) => s.collection_date)
      .map((s) => {
        const project = s.project?.code || 'Unknown'
        if (!(project in projectIndex)) projectIndex[project] = idx++
        return {
          x: new Date(s.collection_date!).getTime(),
          y: projectIndex[project],
          code: s.specimen_code,
          project,
          collector: s.collector?.full_name || s.collector_name || '',
          date: s.collection_date,
        }
      })

    const chartDataByProject: Record<string, typeof allPoints> = {}
    allPoints.forEach((pt) => {
      if (!chartDataByProject[pt.project]) chartDataByProject[pt.project] = []
      chartDataByProject[pt.project].push(pt)
    })

    return { chartDataByProject, projectNames: Object.keys(projectIndex) }
  }, [data])

  return (
    <Card>
      {Object.keys(chartDataByProject).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          No tubes with collection dates to display.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(300, projectNames.length * 60 + 120)}>
          <ScatterChart margin={{ left: 90, right: 20, top: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x" type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => new Date(v).toLocaleDateString()}
              name="Date"
              label={{ value: 'Collection Date', position: 'bottom', offset: 30 }}
            />
            <YAxis
              dataKey="y" type="number"
              domain={[-0.5, projectNames.length - 0.5]}
              tickCount={projectNames.length}
              tickFormatter={(v) => projectNames[Math.round(v)] || ''}
              name="Project" width={80}
            />
            <RechartsTooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0].payload
                return (
                  <div style={{ background: '#fff', border: '1px solid #d9d9d9', padding: 8, borderRadius: 4, fontSize: 13 }}>
                    <div><strong>{d.code}</strong></div>
                    <div>Project: {d.project}</div>
                    <div>Date: {new Date(d.x).toLocaleDateString()}</div>
                    <div>Collector: {d.collector}</div>
                  </div>
                )
              }}
            />
            <Legend verticalAlign="top" />
            {Object.entries(chartDataByProject).map(([project, pts], i) => (
              <Scatter key={project} name={project} data={pts} fill={PALETTE[i % PALETTE.length]} opacity={0.85} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [filters, setFilters] = useState<Filters>({})

  return (
    <div>
      <Typography.Title level={3} style={{ marginBottom: 12 }}>Explore</Typography.Title>
      <FilterBar filters={filters} onChange={setFilters} />
      <Tabs
        items={[
          { key: 'map',      label: 'Map',      children: <MapView filters={filters} /> },
          { key: 'timeline', label: 'Timeline', children: <TimelineView filters={filters} /> },
        ]}
      />
    </div>
  )
}
