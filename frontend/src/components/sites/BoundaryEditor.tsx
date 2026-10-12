import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Input, List, Modal, Segmented, Space, Tag, Typography, message } from 'antd'
import { MapContainer, TileLayer, LayersControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import type { SiteBoundary } from '../../types'
import { boundaryAreaHa, circleToPolygon, formatHa } from '../../utils/geo'
import { MAX_VERTICES, osmPolygonAt, searchOsmPolygons, type OsmResult } from '../../utils/osm'

interface EditorApi {
  setBoundary: (b: SiteBoundary | null) => void
}

/** Collapse every polygon currently on the map into one Polygon / MultiPolygon, or null. */
function collect(map: L.Map, group: L.FeatureGroup): SiteBoundary | null {
  const polys: number[][][][] = []
  group.eachLayer((layer) => {
    if (!map.hasLayer(layer)) return
    const geom = (layer as L.Polygon).toGeoJSON().geometry
    if (geom.type === 'Polygon') polys.push(geom.coordinates)
    else if (geom.type === 'MultiPolygon') polys.push(...geom.coordinates)
  })
  if (polys.length === 0) return null
  return polys.length === 1
    ? { type: 'Polygon', coordinates: polys[0] }
    : { type: 'MultiPolygon', coordinates: polys }
}

function DrawLayer({ initial, apiRef, onChange }: {
  initial: SiteBoundary | null
  apiRef: React.MutableRefObject<EditorApi | null>
  onChange: (b: SiteBoundary | null) => void
}) {
  const map = useMap()

  useEffect(() => {
    const group = L.featureGroup().addTo(map)
    const emit = () => onChange(collect(map, group))

    const load = (b: SiteBoundary | null, fit: boolean) => {
      group.clearLayers()
      if (b) {
        L.geoJSON({ type: 'Feature', properties: {}, geometry: b } as GeoJSON.Feature).eachLayer((l) => {
          group.addLayer(l)
        })
        if (fit && group.getBounds().isValid()) map.fitBounds(group.getBounds(), { padding: [30, 30] })
      }
      emit()
    }

    map.pm.addControls({
      position: 'topleft',
      drawMarker: false, drawCircleMarker: false, drawPolyline: false, drawCircle: false, drawText: false,
      drawPolygon: true, drawRectangle: true,
      editMode: true, dragMode: false, cutPolygon: false, rotateMode: false, removalMode: true,
    })
    map.pm.setGlobalOptions({ layerGroup: group })

    const onCreate = (e: { layer: L.Layer }) => {
      group.addLayer(e.layer)
      emit()
    }
    map.on('pm:create', onCreate)
    map.on('pm:remove', emit)
    group.on('pm:edit', emit)
    group.on('pm:update', emit)

    apiRef.current = { setBoundary: (b) => load(b, true) }
    load(initial, true)

    return () => {
      map.off('pm:create', onCreate)
      map.off('pm:remove', emit)
      group.off('pm:edit', emit)
      group.off('pm:update', emit)
      map.pm.removeControls()
      map.pm.disableDraw()
      map.pm.disableGlobalEditMode()
      group.remove()
      apiRef.current = null
    }
    // initial is only the starting value; edits flow out through onChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  return null
}

function PickHandler({ active, onPick }: { active: boolean; onPick: (lat: number, lon: number) => void }) {
  const map = useMap()
  useEffect(() => {
    map.getContainer().style.cursor = active ? 'crosshair' : ''
    return () => { map.getContainer().style.cursor = '' }
  }, [map, active])
  useMapEvents({
    click: (e) => { if (active) onPick(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250)
    return () => clearTimeout(t)
  }, [map])
  return null
}

export default function BoundaryEditor({ open, value, lat, lon, radiusM, onCancel, onSave }: {
  open: boolean
  value: SiteBoundary | null
  lat?: number | null
  lon?: number | null
  radiusM?: number | null
  onCancel: () => void
  onSave: (b: SiteBoundary | null) => void
}) {
  const [draft, setDraft] = useState<SiteBoundary | null>(value)
  const apiRef = useRef<EditorApi | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OsmResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [pickZoom, setPickZoom] = useState<number>(16)
  const mapRef = useRef<L.Map | null>(null)
  const canCircle = lat != null && lon != null && !!radiusM

  const center: [number, number] = lat != null && lon != null ? [lat, lon] : [-25.5, 134]
  const zoom = lat != null && lon != null ? 14 : 4

  const useOutline = (r: OsmResult) => {
    if (r.vertices > MAX_VERTICES) {
      message.error(`That outline has ${r.vertices.toLocaleString()} points (limit ${MAX_VERTICES.toLocaleString()}). Pick a smaller feature.`)
      return
    }
    apiRef.current?.setBoundary(r.boundary)
    setResults(null)
    setPicking(false)
  }

  const runSearch = async () => {
    if (!query.trim()) return
    setBusy(true)
    try {
      const c = mapRef.current?.getCenter()
      const found = await searchOsmPolygons(query.trim(), c ? { lat: c.lat, lon: c.lng } : undefined)
      setResults(found)
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'OpenStreetMap search failed')
    } finally {
      setBusy(false)
    }
  }

  const pickAt = async (lat: number, lon: number) => {
    setBusy(true)
    try {
      const r = await osmPolygonAt(lat, lon, pickZoom)
      if (!r) message.warning('No OpenStreetMap area found there. Try a different feature size or spot.')
      else useOutline(r)
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'OpenStreetMap lookup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Site boundary"
      zIndex={1200}
      open={open}
      onCancel={onCancel}
      width={820}
      destroyOnClose
      afterOpenChange={(o) => { if (o) setDraft(value) }}
      footer={
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" onClick={() => onSave(draft)}>
            {draft ? 'Use this boundary' : 'Save without a boundary'}
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 10 }}
        message="Use the toolbar on the map: draw a polygon or rectangle, edit points, or delete a shape. Draw several shapes for a site made of separate parts."
      />
      <Space style={{ marginBottom: 10 }} wrap>
        <Button
          size="small"
          disabled={!canCircle}
          title={canCircle ? undefined : 'Needs latitude, longitude and radius on the site'}
          onClick={() => apiRef.current?.setBoundary(circleToPolygon(lat!, lon!, radiusM!))}
        >
          Start from radius circle
        </Button>
        <Button size="small" danger disabled={!draft} onClick={() => apiRef.current?.setBoundary(null)}>
          Clear
        </Button>
        <Typography.Text type="secondary">
          {draft ? `Area: ${formatHa(boundaryAreaHa(draft))}` : 'No boundary drawn yet'}
        </Typography.Text>
      </Space>
      <Space style={{ marginBottom: 10 }} wrap>
        <Input.Search
          placeholder="Import from OpenStreetMap by name (park, reserve, lake…)"
          style={{ width: 360 }}
          value={query}
          loading={busy}
          enterButton="Search"
          onChange={(e) => setQuery(e.target.value)}
          onSearch={runSearch}
        />
        <Button size="small" type={picking ? 'primary' : 'default'} onClick={() => setPicking((p) => !p)}>
          {picking ? 'Click the map…' : 'Pick area on map'}
        </Button>
        {picking && (
          <Segmented
            size="small"
            value={pickZoom}
            onChange={(v) => setPickZoom(v as number)}
            options={[{ label: 'Plot', value: 18 }, { label: 'Park / reserve', value: 16 }, { label: 'Locality', value: 13 }]}
          />
        )}
      </Space>
      {results && (
        <List
          size="small"
          bordered
          style={{ marginBottom: 10, maxHeight: 160, overflowY: 'auto' }}
          locale={{ emptyText: 'No areas with an outline found. Try a more specific name.' }}
          dataSource={results}
          renderItem={(r) => (
            <List.Item
              actions={[<Button key="use" size="small" type="link" onClick={() => useOutline(r)}>Use outline</Button>]}
            >
              <List.Item.Meta
                title={<span style={{ fontSize: 13 }}>{r.name}</span>}
                description={
                  <Space size={4}>
                    {r.kind && <Tag>{r.kind}</Tag>}
                    <span>{formatHa(boundaryAreaHa(r.boundary))}, {r.vertices.toLocaleString()} points</span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
      <MapContainer ref={mapRef} center={center} zoom={zoom} style={{ height: 460, width: '100%', borderRadius: 8 }}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="Street">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <InvalidateSize />
        <PickHandler active={picking && !busy} onPick={pickAt} />
        <DrawLayer initial={value} apiRef={apiRef} onChange={setDraft} />
      </MapContainer>
    </Modal>
  )
}
