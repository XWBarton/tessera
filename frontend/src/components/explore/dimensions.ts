import type { Specimen } from '../../types'
import { rankValue } from '../species/SpeciesTree'

// Every grouping/filtering axis on the Explore page is a "dimension": a label plus
// a function returning the value(s) a specimen has on that axis. Multi-valued
// dimensions (species, sites…) return several strings.

export type DimKey =
  | 'project' | 'species' | 'family' | 'order' | 'genus' | 'site' | 'collector'
  | 'sample_type' | 'confidence' | 'life_stage' | 'sex' | 'status' | 'year' | 'month'

export const NONE = '—'

const uniq = (xs: string[]) => (xs.length ? Array.from(new Set(xs)) : [NONE])

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const speciesName = (a: Specimen['species_associations'][number]) =>
  a.species?.scientific_name || a.free_text_species?.trim() || 'Unknown species'

function taxon(s: Specimen, rank: 'order' | 'family' | 'genus'): string[] {
  return uniq(s.species_associations.map((a) => (a.species ? rankValue(a.species, rank) : 'Unassigned')))
}

export interface Dimension {
  key: DimKey
  label: string
  values: (s: Specimen) => string[]
  /** Optional fixed ordering of values (otherwise sorted by count). */
  order?: string[]
}

export const DIMENSIONS: Dimension[] = [
  { key: 'project', label: 'Project', values: (s) => [s.project?.code || NONE] },
  { key: 'species', label: 'Species', values: (s) => uniq(s.species_associations.map(speciesName)) },
  { key: 'order', label: 'Order', values: (s) => taxon(s, 'order') },
  { key: 'family', label: 'Family', values: (s) => taxon(s, 'family') },
  { key: 'genus', label: 'Genus', values: (s) => taxon(s, 'genus') },
  { key: 'site', label: 'Site', values: (s) => uniq((s.sites || []).map((st) => st.name)) },
  { key: 'collector', label: 'Collector', values: (s) => [s.collector?.full_name || s.collector_name?.trim() || NONE] },
  { key: 'sample_type', label: 'Sample type', values: (s) => [s.sample_type?.name || NONE] },
  {
    key: 'confidence', label: 'Confidence',
    values: (s) => uniq(s.species_associations.map((a) => a.confidence)),
    order: ['Confirmed', 'Probable', 'Possible', 'Unknown', NONE],
  },
  { key: 'life_stage', label: 'Life stage', values: (s) => uniq(s.species_associations.map((a) => a.life_stage || '').filter(Boolean)) },
  { key: 'sex', label: 'Sex', values: (s) => uniq(s.species_associations.map((a) => a.sex || '').filter(Boolean)) },
  { key: 'status', label: 'Status', values: (s) => [s.status || NONE] },
  { key: 'year', label: 'Year', values: (s) => [s.collection_date?.slice(0, 4) || NONE] },
  {
    key: 'month', label: 'Month',
    values: (s) => [s.collection_date ? MONTHS[Number(s.collection_date.slice(5, 7)) - 1] : NONE],
    order: [...MONTHS, NONE],
  },
]

export const DIM: Record<DimKey, Dimension> = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d])) as Record<DimKey, Dimension>

export const DIM_OPTIONS = DIMENSIONS.map((d) => ({ value: d.key, label: d.label }))

/** Count specimens per value of a dimension, sorted by the dimension's order or by count desc. */
export function countBy(specimens: Specimen[], dim: DimKey): { name: string; value: number }[] {
  const counts = new Map<string, number>()
  for (const s of specimens) for (const v of DIM[dim].values(s)) counts.set(v, (counts.get(v) || 0) + 1)
  const rows = Array.from(counts, ([name, value]) => ({ name, value }))
  const order = DIM[dim].order
  if (order) return rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
  if (dim === 'year') return rows.sort((a, b) => a.name.localeCompare(b.name))
  return rows.sort((a, b) => b.value - a.value)
}

export const speciesLabel = (s: Specimen) => {
  const first = s.species_associations[0]
  return first ? speciesName(first) : 'Unknown species'
}
