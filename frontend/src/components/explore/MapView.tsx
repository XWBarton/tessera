import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Segmented, Select, Slider, Space, Tooltip, Typography } from 'antd'
import { CaretRightOutlined, PauseOutlined, ExpandOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import {
  MapContainer, TileLayer, LayersControl, CircleMarker, Circle, Marker, Popup, useMap,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'
import dayjs from 'dayjs'
import type { Specimen } from '../../types'
import { DIM, DIM_OPTIONS, speciesLabel, type DimKey } from './dimensions'
import { makeColorScale, OTHER } from './colors'
import type { ExploreData } from './useExploreData'

const PRECISION_RADIUS_M: Record<string, number> = {
  Suburb: 1500, City: 8000, Region: 50000, State: 150000,
}

type Mode = 'points' | 'clusters' | 'heatmap'
type Playback = 'cumulative' | 'window'

// ── Leaflet helpers ────────────────────────────────────────────────────────────

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(t)
  }, [map])
  return null
}

function FitBounds({ points, trigger }: { points: [number, number][]; trigger: number }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], 10)
    else map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 13 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, trigger])
  return null
}

function HeatLayer({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    const layer = L.heatLayer(points.map(([a, b]) => [a, b, 1] as L.HeatLatLngTuple), {
      radius: 25, blur: 18, minOpacity: 0.35, maxZoom: 12,
    }).addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map, points])
  return null
}

const iconCache = new Map<string, L.DivIcon>()
function dotIcon(color: string) {
  let icon = iconCache.get(color)
  if (!icon) {
    icon = L.divIcon({
      className: '',
      iconSize: [16, 16],
      html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>`,
    })
    iconCache.set(color, icon)
  }
  return icon
}

function SpecimenPopup({ s }: { s: Specimen }) {
  const precision = s.sites?.[0]?.precision || 'GPS'
  return (
    <Popup>
      <Link to={`/specimens/${s.id}`}><strong>{s.specimen_code}</strong></Link><br />
      {s.project?.code}<br />
      <em>{speciesLabel(s)}</em><br />
      {s.collection_date}
      {s.sites?.length > 0 && (
        <><br /><span style={{ color: '#888', fontSize: 11 }}>
          {s.sites.map((st) => st.name).join(', ')}{precision !== 'GPS' ? ` (${precision}-level)` : ''}
        </span></>
      )}<br />
      {s.collector?.full_name || s.collector_name}
    </Popup>
  )
}

// ── Map view ───────────────────────────────────────────────────────────────────

export default function MapView({ data }: { data: ExploreData }) {
  const [mode, setMode] = useState<Mode>('points')
  const [colorBy, setColorBy] = useState<DimKey>('confidence')
  const [playback, setPlayback] = useState<Playback>('cumulative')
  const [frame, setFrame] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [fitTrigger, setFitTrigger] = useState(0)

  const geo = useMemo(
    () => data.filtered.filter((s) => s.collection_lat != null && s.collection_lon != null),
    [data.filtered]
  )

  // Months spanned by the georeferenced, dated tubes — the time slider's steps.
  const months = useMemo(() => {
    const dates = geo.map((s) => s.collection_date).filter(Boolean).sort() as string[]
    if (!dates.length) return []
    const out: string[] = []
    let m = dayjs(dates[0]).startOf('month')
    const end = dayjs(dates[dates.length - 1]).startOf('month')
    while (!m.isAfter(end) && out.length < 600) { out.push(m.format('YYYY-MM')); m = m.add(1, 'month') }
    return out
  }, [geo])

  useEffect(() => { setFrame(null); setPlaying(false) }, [months.length])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      setFrame((f) => {
        const next = (f ?? -1) + 1
        if (next >= months.length) { setPlaying(false); return months.length - 1 }
        return next
      })
    }, 500)
    return () => clearInterval(t)
  }, [playing, months.length])

  const visible = useMemo(() => {
    if (frame == null || !months[frame]) return geo
    const cur = months[frame]
    return geo.filter((s) => {
      const m = s.collection_date?.slice(0, 7)
      if (!m) return false
      return playback === 'cumulative' ? m <= cur : m === cur
    })
  }, [geo, frame, months, playback])

  const scale = useMemo(() => makeColorScale(geo, colorBy, DIM[colorBy].values), [geo, colorBy])
  const points = useMemo(() => visible.map((s) => [s.collection_lat!, s.collection_lon!] as [number, number]), [visible])
  const allPoints = useMemo(() => geo.map((s) => [s.collection_lat!, s.collection_lon!] as [number, number]), [geo])

  // Re-fit whenever the filtered set changes (not while scrubbing through time).
  useEffect(() => { setFitTrigger((n) => n + 1) }, [geo])

  const togglePlay = () => {
    if (playing) { setPlaying(false); return }
    if (frame == null || frame >= months.length - 1) setFrame(0)
    setPlaying(true)
  }

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          options={[
            { value: 'points', label: 'Points' },
            { value: 'clusters', label: 'Clusters' },
            { value: 'heatmap', label: 'Heatmap' },
          ]}
        />
        {mode !== 'heatmap' && (
          <Space size={6}>
            <Typography.Text type="secondary">Colour by</Typography.Text>
            <Select value={colorBy} onChange={setColorBy} options={DIM_OPTIONS} style={{ width: 150 }} />
          </Space>
        )}
        <Tooltip title="Zoom to all tubes">
          <Button icon={<ExpandOutlined />} onClick={() => setFitTrigger((n) => n + 1)} />
        </Tooltip>
      </Space>

      <Card styles={{ body: { padding: 0, overflow: 'hidden', borderRadius: 8 } }}>
        <MapContainer center={[0, 0]} zoom={2} style={{ height: '62vh', width: '100%' }}>
          <InvalidateSize />
          <FitBounds points={allPoints} trigger={fitTrigger} />
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

          {mode === 'heatmap' && <HeatLayer points={points} />}

          {mode === 'clusters' && (
            <MarkerClusterGroup key={`${colorBy}-${frame}-${playback}`} chunkedLoading showCoverageOnHover={false}>
              {visible.map((s) => (
                <Marker key={s.id} position={[s.collection_lat!, s.collection_lon!]} icon={dotIcon(scale.of(s))}>
                  <SpecimenPopup s={s} />
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}

          {mode === 'points' && visible.map((s) => {
            const color = scale.of(s)
            const radiusM = PRECISION_RADIUS_M[s.sites?.[0]?.precision || 'GPS']
            const pos: [number, number] = [s.collection_lat!, s.collection_lon!]
            return radiusM ? (
              <Circle key={s.id} center={pos} radius={radiusM}
                pathOptions={{ fillColor: color, color, weight: 1, opacity: 0.6, fillOpacity: 0.25 }}>
                <SpecimenPopup s={s} />
              </Circle>
            ) : (
              <CircleMarker key={s.id} center={pos} radius={8}
                pathOptions={{ fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.85 }}>
                <SpecimenPopup s={s} />
              </CircleMarker>
            )
          })}
        </MapContainer>
      </Card>

      {months.length > 1 && (
        <Card size="small" style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Button type="primary" shape="circle" icon={playing ? <PauseOutlined /> : <CaretRightOutlined />} onClick={togglePlay} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <Slider
                min={0}
                max={months.length - 1}
                value={frame ?? months.length - 1}
                onChange={(v) => { setPlaying(false); setFrame(v) }}
                tooltip={{ formatter: (v) => (v != null ? dayjs(months[v]).format('MMM YYYY') : '') }}
              />
            </div>
            <Typography.Text strong style={{ minWidth: 80 }}>
              {frame == null ? 'All time' : dayjs(months[frame]).format('MMM YYYY')}
            </Typography.Text>
            <Segmented
              size="small"
              value={playback}
              onChange={(v) => setPlayback(v as Playback)}
              options={[{ value: 'cumulative', label: 'Cumulative' }, { value: 'window', label: 'Month only' }]}
            />
            {frame != null && <Button size="small" onClick={() => { setPlaying(false); setFrame(null) }}>Show all</Button>}
          </div>
        </Card>
      )}

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center' }}>
        {mode !== 'heatmap' && (
          <>
            <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{DIM[colorBy].label}:</span>
            {scale.legend.map((l) => {
              const selected = data.filters.dims[colorBy]?.includes(l.name)
              return (
                <span
                  key={l.name}
                  onClick={() => l.name !== OTHER && data.toggle(colorBy, l.name)}
                  title={l.name !== OTHER ? 'Click to filter' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                    cursor: l.name !== OTHER ? 'pointer' : 'default',
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: l.color, display: 'inline-block', border: '2px solid #fff', boxShadow: '0 0 0 1px #ccc' }} />
                  {l.name} <span style={{ color: '#aaa' }}>{l.count}</span>
                </span>
              )
            })}
          </>
        )}
        <span style={{ color: '#888', fontSize: 12, marginLeft: 'auto' }}>
          {visible.length} of {data.filtered.length} tubes shown on map
          {geo.length < data.filtered.length && ` · ${data.filtered.length - geo.length} without coordinates`}
        </span>
      </div>
    </div>
  )
}
