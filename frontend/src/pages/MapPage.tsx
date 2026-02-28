import { useMemo } from 'react'
import { Typography, Card } from 'antd'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup } from 'react-leaflet'
import { useSpecimens } from '../hooks/useSpecimens'
import 'leaflet/dist/leaflet.css'

const CONFIDENCE_COLORS: Record<string, string> = {
  Confirmed: '#2e7d32',
  Probable: '#1565c0',
  Possible: '#e65100',
  Unknown: '#757575',
}

// Radius in metres for each precision level (used with <Circle>)
const PRECISION_RADIUS_M: Record<string, number> = {
  Suburb: 1500,
  City:   8000,
  Region: 50000,
  State:  150000,
}

const PRECISION_LABEL: Record<string, string> = {
  GPS:    'GPS (exact)',
  Suburb: 'Suburb',
  City:   'City',
  Region: 'Region',
  State:  'State',
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

  // Which precision levels are present (for legend)
  const presentPrecisions = useMemo(() => {
    const seen = new Set<string>()
    specimens.forEach((s) => seen.add(s.sites?.[0]?.precision || 'GPS'))
    return Array.from(seen).sort((a, b) =>
      Object.keys(PRECISION_LABEL).indexOf(a) - Object.keys(PRECISION_LABEL).indexOf(b)
    )
  }, [specimens])

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
            const first = s.species_associations[0]
            const color = first ? CONFIDENCE_COLORS[first.confidence] || '#757575' : '#757575'
            const precision = s.sites?.[0]?.precision || 'GPS'
            const radiusM = PRECISION_RADIUS_M[precision]
            const pos: [number, number] = [s.collection_lat!, s.collection_lon!]

            const popup = (
              <Popup>
                <strong>{s.specimen_code}</strong>
                <br />
                {s.project?.code}
                <br />
                <em>
                  {first?.species?.scientific_name || first?.free_text_species || 'Unknown species'}
                </em>
                <br />
                {s.collection_date}
                {s.sites?.length > 0 && (
                  <>
                    <br />
                    <span style={{ color: '#888', fontSize: 11 }}>
                      {s.sites.map(st => st.name).join(', ')}{precision !== 'GPS' ? ` (${precision}-level)` : ''}
                    </span>
                  </>
                )}
                <br />
                {s.collector?.full_name || s.collector_name}
              </Popup>
            )

            if (radiusM) {
              return (
                <Circle
                  key={s.id}
                  center={pos}
                  radius={radiusM}
                  pathOptions={{
                    fillColor: color,
                    color: color,
                    weight: 1,
                    opacity: 0.6,
                    fillOpacity: 0.25,
                  }}
                >
                  {popup}
                </Circle>
              )
            }

            return (
              <CircleMarker
                key={s.id}
                center={pos}
                radius={8}
                pathOptions={{
                  fillColor: color,
                  color: '#fff',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.85,
                }}
              >
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
              <span style={{
                width: 11, height: 11, borderRadius: '50%', background: v,
                display: 'inline-block', border: '2px solid #fff', boxShadow: '0 0 0 1px #ccc',
              }} />
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
                  {isPoint ? (
                    <span style={{
                      width: 11, height: 11, borderRadius: '50%', background: '#555',
                      display: 'inline-block', border: '2px solid #fff', boxShadow: '0 0 0 1px #ccc',
                    }} />
                  ) : (
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'rgba(80,80,80,0.15)', border: '1.5px solid #888',
                      display: 'inline-block',
                    }} />
                  )}
                  {PRECISION_LABEL[p] || p}
                </span>
              )
            })}
          </div>
        )}

        {specimens.length === 0 && (
          <span style={{ color: '#888', fontSize: 12 }}>
            No tubes with coordinates to display.
          </span>
        )}
      </div>
    </div>
  )
}
