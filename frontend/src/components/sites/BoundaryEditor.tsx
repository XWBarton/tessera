import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Modal, Space, Typography } from 'antd'
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import type { SiteBoundary } from '../../types'
import { boundaryAreaHa, circleToPolygon, formatHa } from '../../utils/geo'

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
  const canCircle = lat != null && lon != null && !!radiusM

  const center: [number, number] = lat != null && lon != null ? [lat, lon] : [-25.5, 134]
  const zoom = lat != null && lon != null ? 14 : 4

  return (
    <Modal
      title="Site boundary"
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
      <MapContainer center={center} zoom={zoom} style={{ height: 460, width: '100%', borderRadius: 8 }}>
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
        <DrawLayer initial={value} apiRef={apiRef} onChange={setDraft} />
      </MapContainer>
    </Modal>
  )
}
