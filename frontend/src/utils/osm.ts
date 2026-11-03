import type { SiteBoundary } from '../types'

const NOMINATIM = 'https://nominatim.openstreetmap.org'
// Mirrors MAX_VERTICES in backend/app/geo.py
export const MAX_VERTICES = 5000
// Server-side simplification in degrees (~10 m); keeps big reserves under the vertex limit
const SIMPLIFY_DEG = 0.0001

export interface OsmResult {
  id: string
  /** e.g. "R1629146", for re-fetching the same feature via /lookup */
  osmRef?: string
  name: string
  kind: string
  boundary: SiteBoundary
  vertices: number
  lat: number | null
  lon: number | null
}

interface RawPlace {
  osm_type?: string
  osm_id?: number
  display_name?: string
  name?: string
  category?: string
  type?: string
  lat?: string
  lon?: string
  geojson?: { type: string; coordinates: unknown }
}

function countVertices(c: unknown): number {
  if (!Array.isArray(c)) return 0
  if (typeof c[0] === 'number') return 1
  return (c as unknown[]).reduce<number>((s, x) => s + countVertices(x), 0)
}

function toResult(p: RawPlace): OsmResult | null {
  const g = p.geojson
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return null
  const typeLetter = p.osm_type ? p.osm_type[0].toUpperCase() : undefined
  return {
    id: `${p.osm_type ?? 'osm'}/${p.osm_id ?? Math.random()}`,
    osmRef: typeLetter && p.osm_id != null ? `${typeLetter}${p.osm_id}` : undefined,
    name: p.display_name || p.name || 'Unnamed feature',
    kind: [p.category, p.type].filter(Boolean).join(': '),
    boundary: g as SiteBoundary,
    vertices: countVertices(g.coordinates),
    lat: p.lat != null && isFinite(+p.lat) ? +(+p.lat).toFixed(6) : null,
    lon: p.lon != null && isFinite(+p.lon) ? +(+p.lon).toFixed(6) : null,
  }
}

async function get(path: string, params: Record<string, string | number>, simplifyDeg = SIMPLIFY_DEG): Promise<unknown> {
  const qs = new URLSearchParams({
    format: 'jsonv2',
    polygon_geojson: '1',
    polygon_threshold: String(simplifyDeg),
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })
  const res = await fetch(`${NOMINATIM}${path}?${qs}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`OpenStreetMap lookup failed (${res.status})`)
  return res.json()
}

/** Search OSM by name; only features that have an area outline are returned. */
export async function searchOsmPolygons(q: string, near?: { lat: number; lon: number }): Promise<OsmResult[]> {
  const params: Record<string, string | number> = { q, limit: 10 }
  if (near) {
    // Bias (not restrict) results towards the current map centre
    const d = 2
    params.viewbox = `${near.lon - d},${near.lat + d},${near.lon + d},${near.lat - d}`
  }
  const data = (await get('/search', params)) as RawPlace[]
  return data.map(toResult).filter((r): r is OsmResult => r !== null)
}

/** The OSM area at a point; zoom sets how large a feature to pick (18 plot, 16 park, 13 locality, 8 region, 3 country). */
export async function osmPolygonAt(lat: number, lon: number, zoom: number): Promise<OsmResult | null> {
  const data = (await get('/reverse', { lat, lon, zoom })) as RawPlace & { error?: string }
  if (data.error) return null
  return toResult(data)
}

// Coarser simplification steps (degrees; 0.001 ≈ 100 m) tried when an outline is too detailed
const COARSER_DEG = [0.0005, 0.001, 0.003, 0.01, 0.03]

/**
 * Large areas (countries, archipelagos) come back with far more points than a site can store.
 * Re-fetch the same feature at coarser simplification until it fits under MAX_VERTICES.
 * Returns the result unchanged if it already fits, or null if it never does.
 */
export async function fitOutline(r: OsmResult): Promise<(OsmResult & { simplifiedM?: number }) | null> {
  if (r.vertices <= MAX_VERTICES) return r
  if (!r.osmRef) return null
  for (const deg of COARSER_DEG) {
    const data = (await get('/lookup', { osm_ids: r.osmRef }, deg)) as RawPlace[]
    const next = data[0] ? toResult(data[0]) : null
    if (next && next.vertices <= MAX_VERTICES) return { ...next, simplifiedM: Math.round(deg * 111_000) }
  }
  return null
}
