import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, LayersControl, CircleMarker, Circle, GeoJSON, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Button, Typography } from 'antd'
import type { Site } from '../../types'
import { boundaryAreaHa, formatHa } from '../../utils/geo'
import 'leaflet/dist/leaflet.css'

const PRECISION_HEX: Record<string, string> = {
  GPS: '#2e7d32',
  Suburb: '#1565c0',
  City: '#ef6c00',
  Region: '#d84315',
  State: '#c62828',
}
const DEFAULT_HEX = '#1565c0'

function FitAll({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize()
      if (bounds?.isValid()) map.fitBounds(bounds.pad(0.1), { maxZoom: 15 })
    }, 200)
    return () => clearTimeout(t)
  }, [map, bounds])
  return null
}

/** Every site that has its own boundary or coordinates, drawn on one map. */
export default function SitesOverviewMap({ sites, counts, onSelect }: {
  sites: Site[]
  counts?: Record<string, number>
  onSelect: (site: Site) => void
}) {
  const { mapped, bounds } = useMemo(() => {
    const mapped = sites.filter((s) => s.boundary || (s.lat != null && s.lon != null))
    const b = L.latLngBounds([])
    for (const s of mapped) {
      if (s.boundary) {
        b.extend(L.geoJSON({ type: 'Feature', properties: {}, geometry: s.boundary } as GeoJSON.Feature).getBounds())
      } else {
        b.extend([s.lat!, s.lon!])
      }
    }
    return { mapped, bounds: b.isValid() ? b : null }
  }, [sites])

  const unmapped = sites.length - mapped.length

  const popup = (s: Site) => (
    <Popup>
      <div style={{ minWidth: 160 }}>
        <strong>{s.name}</strong>
        <div style={{ fontSize: 12, color: '#666' }}>{s.path}</div>
        {counts?.[String(s.id)] != null && <div style={{ fontSize: 12 }}>{counts[String(s.id)]} specimens</div>}
        {s.boundary && <div style={{ fontSize: 12 }}>Boundary: {formatHa(boundaryAreaHa(s.boundary))}</div>}
        <Button size="small" type="link" style={{ padding: 0 }} onClick={() => onSelect(s)}>Open site</Button>
      </div>
    </Popup>
  )

  return (
    <div>
      <MapContainer center={[-25.5, 134]} zoom={4} style={{ height: 560, width: '100%', borderRadius: 8 }}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <FitAll bounds={bounds} />
        {mapped.map((s) => {
          const color = PRECISION_HEX[s.precision ?? 'GPS'] ?? DEFAULT_HEX
          if (s.boundary) {
            return (
              <GeoJSON
                key={`${s.id}-${JSON.stringify(s.boundary).length}`}
                data={{ type: 'Feature', properties: {}, geometry: s.boundary } as GeoJSON.Feature}
                style={{ color, weight: 2, fillColor: color, fillOpacity: 0.2 }}
              >
                {popup(s)}
              </GeoJSON>
            )
          }
          if (s.radius_m) {
            return (
              <Circle
                key={s.id}
                center={[s.lat!, s.lon!]}
                radius={s.radius_m}
                pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.2 }}
              >
                {popup(s)}
              </Circle>
            )
          }
          return (
            <CircleMarker
              key={s.id}
              center={[s.lat!, s.lon!]}
              radius={7}
              pathOptions={{ fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9 }}
            >
              {popup(s)}
            </CircleMarker>
          )
        })}
      </MapContainer>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
        {mapped.length} site{mapped.length !== 1 ? 's' : ''} shown
        {unmapped > 0 ? `, ${unmapped} without coordinates or a boundary not shown` : ''}. Colour shows location precision
        (green GPS, blue suburb, orange city, red region / state).
      </Typography.Text>
    </div>
  )
}
