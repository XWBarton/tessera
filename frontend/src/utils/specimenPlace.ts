import type { Site, SiteBoundary, Specimen } from '../types'

/** Tubes known only to lie somewhere within one site's outline. */
export interface SiteArea {
  site: Site
  boundary: SiteBoundary
  specimens: Specimen[]
}

const same = (a?: number | null, b?: number | null) => a != null && b != null && Math.abs(a - b) < 1e-6

/**
 * Whether a tube should be drawn as its site's outline rather than a point: the site has a
 * boundary and the tube has no position of its own. That is, no coordinates, coordinates copied from
 * the site, or a site that is itself imprecise (e.g. "Azores", where any point would be made up).
 */
export function placedByArea(s: Specimen): boolean {
  const site = s.sites?.[0]
  if (!site?.boundary) return false
  if (s.collection_lat == null || s.collection_lon == null) return true
  if (site.precision && site.precision !== 'GPS') return true
  return same(s.collection_lat, site.lat) && same(s.collection_lon, site.lon)
}

/** Split tubes into those drawn as points and those drawn as their site's outline (one per site). */
export function placeSpecimens(specimens: Specimen[]): { points: Specimen[]; areas: SiteArea[] } {
  const points: Specimen[] = []
  const bySite = new Map<number, SiteArea>()
  for (const s of specimens) {
    if (placedByArea(s)) {
      const site = s.sites[0]
      let area = bySite.get(site.id)
      if (!area) bySite.set(site.id, (area = { site, boundary: site.boundary!, specimens: [] }))
      area.specimens.push(s)
    } else if (s.collection_lat != null && s.collection_lon != null) {
      points.push(s)
    }
  }
  return { points, areas: [...bySite.values()] }
}
