import type { Site } from '../types'

export interface SiteNode extends Site {
  children?: SiteNode[]
  total_specimens: number
}

/** Build a forest from a flat list. Sites whose parent isn't in the list (e.g. filtered out) become roots. */
export function buildSiteTree(sites: Site[], counts: Record<string, number> = {}): SiteNode[] {
  const nodes = new Map<number, SiteNode>()
  sites.forEach((s) => nodes.set(s.id, { ...s, total_specimens: counts[s.id] ?? 0 }))
  const roots: SiteNode[] = []
  nodes.forEach((n) => {
    const parent = n.parent_id != null ? nodes.get(n.parent_id) : undefined
    if (parent) (parent.children ??= []).push(n)
    else roots.push(n)
  })
  const sortAndSum = (list: SiteNode[]): number => {
    list.sort((a, b) => a.name.localeCompare(b.name))
    let sum = 0
    list.forEach((n) => {
      if (n.children) n.total_specimens += sortAndSum(n.children)
      sum += n.total_specimens
    })
    return sum
  }
  sortAndSum(roots)
  return roots
}

/** Ids of a site and everything beneath it. */
export function subtreeIds(sites: Site[], id: number): Set<number> {
  const out = new Set<number>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const s of sites) {
      if (s.parent_id != null && out.has(s.parent_id) && !out.has(s.id)) {
        out.add(s.id)
        grew = true
      }
    }
  }
  return out
}

/** A site's own coordinates, or those of its nearest ancestor that has any. */
export function effectiveLocation(
  site: Site,
  sites: Site[],
): { lat: number; lon: number; radius_m?: number | null; boundary?: Site['boundary']; inheritedFrom?: Site } | null {
  const byId = new Map(sites.map((s) => [s.id, s]))
  let cur: Site | undefined = site
  const seen = new Set<number>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    if (cur.lat != null && cur.lon != null) {
      return { lat: cur.lat, lon: cur.lon, radius_m: cur.radius_m, boundary: cur.boundary, inheritedFrom: cur.id === site.id ? undefined : cur }
    }
    cur = cur.parent_id != null ? byId.get(cur.parent_id) : undefined
  }
  return null
}

const COUNTRY_LEVELS = ['country']
const STATE_LEVELS = ['state', 'province', 'territory', 'state/province']

/** Country / state a new sub-site would inherit from parentId: nearest Country/State-level ancestor
 *  (the parent itself included), falling back to the country/state text on the nearest ancestor that has it. */
export function geoFromParent(sites: Site[], parentId: number): { country?: string; state?: string } {
  const byId = new Map(sites.map((s) => [s.id, s]))
  const out: { country?: string; state?: string } = {}
  const textFallback: { country?: string; state?: string } = {}
  const seen = new Set<number>()
  let cur = byId.get(parentId)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    const lvl = (cur.level ?? '').trim().toLowerCase()
    if (!out.country && COUNTRY_LEVELS.includes(lvl)) out.country = cur.name
    if (!out.state && STATE_LEVELS.includes(lvl)) out.state = cur.name
    if (!textFallback.country && cur.country) textFallback.country = cur.country
    if (!textFallback.state && cur.state_province) textFallback.state = cur.state_province
    cur = cur.parent_id != null ? byId.get(cur.parent_id) : undefined
  }
  return { country: out.country ?? textFallback.country, state: out.state ?? textFallback.state }
}
