import { GeoJSON, Popup, Tooltip } from 'react-leaflet'
import { Link } from 'react-router-dom'
import type { Specimen } from '../../types'
import type { SiteArea } from '../../utils/specimenPlace'

const MIXED = '#595959'
const LIST_MAX = 12

/**
 * One dashed outline per site for tubes placed only to that site (e.g. "Azores"), so a vague
 * location reads as an area rather than a made-up point. Coloured like the tubes when they agree.
 */
export default function SiteAreaLayer({ areas, colorOf, speciesOf }: {
  areas: SiteArea[]
  colorOf: (s: Specimen) => string
  speciesOf: (s: Specimen) => string
}) {
  return (
    <>
      {areas.map(({ site, boundary, specimens }) => {
        const colors = new Set(specimens.map(colorOf))
        const color = colors.size === 1 ? [...colors][0] : MIXED
        const n = specimens.length
        return (
          <GeoJSON
            // GeoJSON data is fixed once mounted, so remount when the area's contents change
            key={`${site.id}-${n}-${color}`}
            data={{ type: 'Feature', properties: {}, geometry: boundary } as GeoJSON.Feature}
            style={{ color, weight: 1.5, dashArray: '5 4', opacity: 0.9, fillColor: color, fillOpacity: 0.12 }}
          >
            <Tooltip sticky>{site.name}: {n} tube{n !== 1 ? 's' : ''} placed to this area</Tooltip>
            <Popup>
              <strong>{site.path || site.name}</strong>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>
                {n} tube{n !== 1 ? 's' : ''} located only to this area
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {specimens.slice(0, LIST_MAX).map((s) => (
                  <div key={s.id} style={{ fontSize: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colorOf(s), marginRight: 5 }} />
                    <Link to={`/specimens/${s.id}`}>{s.specimen_code}</Link> <em>{speciesOf(s)}</em>
                    {s.collection_date ? <span style={{ color: '#888' }}> · {s.collection_date}</span> : null}
                  </div>
                ))}
                {n > LIST_MAX && <div style={{ fontSize: 12, color: '#888' }}>+ {n - LIST_MAX} more</div>}
              </div>
            </Popup>
          </GeoJSON>
        )
      })}
    </>
  )
}

/** Legend swatch for the outline style. */
export function AreaSwatch() {
  return (
    <span style={{
      width: 16, height: 12, display: 'inline-block', borderRadius: 2,
      background: 'rgba(89,89,89,0.12)', border: '1.5px dashed #595959',
    }} />
  )
}
