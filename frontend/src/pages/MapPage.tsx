import { useMemo } from 'react'
import { Typography, Card } from 'antd'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useSpecimens } from '../hooks/useSpecimens'
import 'leaflet/dist/leaflet.css'

const CONFIDENCE_COLORS: Record<string, string> = {
  Confirmed: '#2e7d32',
  Probable: '#1565c0',
  Possible: '#e65100',
  Unknown: '#757575',
}

export default function MapPage() {
  const { data } = useSpecimens({ limit: 2000 })

  const specimens = useMemo(
    () =>
      (data?.items || []).filter(
        (s) => s.collection_lat != null && s.collection_lon != null
      ),
    [data]
  )

  const center: [number, number] =
    specimens.length > 0
      ? [specimens[0].collection_lat!, specimens[0].collection_lon!]
      : [0, 0]

  return (
    <div>
      <Typography.Title level={3}>Collection Map</Typography.Title>
      <Card bodyStyle={{ padding: 0, overflow: 'hidden', borderRadius: 8 }}>
        <MapContainer
          center={center}
          zoom={specimens.length > 0 ? 8 : 2}
          style={{ height: '70vh', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {specimens.map((s) => {
            const primary = s.species_associations.find((a) => a.is_primary)
            const color = primary
              ? CONFIDENCE_COLORS[primary.confidence] || '#757575'
              : '#757575'
            return (
              <CircleMarker
                key={s.id}
                center={[s.collection_lat!, s.collection_lon!]}
                radius={8}
                pathOptions={{
                  fillColor: color,
                  color: '#fff',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <strong>{s.specimen_code}</strong>
                  <br />
                  {s.project?.code}
                  <br />
                  <em>
                    {primary?.species?.scientific_name ||
                      primary?.free_text_species ||
                      'Unknown species'}
                  </em>
                  <br />
                  {s.collection_date}
                  <br />
                  {s.collector?.full_name}
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </Card>
      <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {Object.entries(CONFIDENCE_COLORS).map(([k, v]) => (
          <span
            key={k}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: v,
                display: 'inline-block',
                border: '2px solid #fff',
                boxShadow: '0 0 0 1px #ccc',
              }}
            />
            {k}
          </span>
        ))}
        {specimens.length === 0 && (
          <span style={{ color: '#888' }}>
            No tubes with coordinates to display.
          </span>
        )}
      </div>
    </div>
  )
}
