import type { Specimen, SpecimenSpecies } from '../../types'
import { rankValue } from '../species/SpeciesTree'

// Every grouping/filtering axis on the Explore page is a "dimension": a label plus
// a function returning the value(s) a specimen has on that axis. Multi-valued
// dimensions (species, sites…) return several strings.

export type DimKey =
  | 'project' | 'species' | 'family' | 'order' | 'genus' | 'site' | 'collector'
  | 'sample_type' | 'confidence' | 'life_stage' | 'sex' | 'status' | 'year' | 'month'

/** What a count means: individual specimens (sum of per-species counts) or tubes. */
export type Measure = 'specimens' | 'tubes'

export const NONE = '—'

const uniq = (xs: string[]) => (xs.length ? Array.from(new Set(xs)) : [NONE])

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const speciesName = (a: SpecimenSpecies) =>
  a.species?.scientific_name || a.free_text_species?.trim() || 'Unknown species'

const taxon = (rank: 'order' | 'family' | 'genus') => (a: SpecimenSpecies) =>
  a.species ? rankValue(a.species, rank) : 'Unassigned'

export interface Dimension {
  key: DimKey
  label: string
  values: (s: Specimen) => string[]
  /** Set for dimensions that live on a species association rather than the tube. */
  assoc?: (a: SpecimenSpecies) => string
  /** Optional fixed ordering of values (otherwise sorted by count). */
  order?: string[]
}

type DimDef = Omit<Dimension, 'values'> & { values?: Dimension['values'] }

const DEFS: DimDef[] = [
  { key: 'project', label: 'Project', values: (s) => [s.project?.code || NONE] },
  { key: 'species', label: 'Species', assoc: speciesName },
  { key: 'order', label: 'Order', assoc: taxon('order') },
  { key: 'family', label: 'Family', assoc: taxon('family') },
  { key: 'genus', label: 'Genus', assoc: taxon('genus') },
  { key: 'site', label: 'Site', values: (s) => uniq((s.sites || []).map((st) => st.name)) },
  { key: 'collector', label: 'Collector', values: (s) => [s.collector?.full_name || s.collector_name?.trim() || NONE] },
  { key: 'sample_type', label: 'Sample type', values: (s) => [s.sample_type?.name || NONE] },
  {
    key: 'confidence', label: 'Confidence', assoc: (a) => a.confidence,
    order: ['Confirmed', 'Probable', 'Possible', 'Unknown', NONE],
  },
  { key: 'life_stage', label: 'Life stage', assoc: (a) => a.life_stage || NONE },
  { key: 'sex', label: 'Sex', assoc: (a) => a.sex || NONE },
  { key: 'status', label: 'Status', values: (s) => [s.status || NONE] },
  { key: 'year', label: 'Year', values: (s) => [s.collection_date?.slice(0, 4) || NONE] },
  {
    key: 'month', label: 'Month',
    values: (s) => [s.collection_date ? MONTHS[Number(s.collection_date.slice(5, 7)) - 1] : NONE],
    order: [...MONTHS, NONE],
  },
]

export const DIMENSIONS: Dimension[] = DEFS.map((d) => ({
  ...d,
  values: d.values ?? ((s: Specimen) => uniq(s.species_associations.map(d.assoc!))),
}))

export const DIM: Record<DimKey, Dimension> = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d])) as Record<DimKey, Dimension>

export const DIM_OPTIONS = DIMENSIONS.map((d) => ({ value: d.key, label: d.label }))

// ── Measures ───────────────────────────────────────────────────────────────────

/** Individual specimens in a tube; a missing per-species count counts as 0 (as on the Dashboard). */
export const individuals = (s: Specimen) =>
  s.species_associations.reduce((n, a) => n + (a.specimen_count ?? 0), 0)

export const weightOf = (s: Specimen, m: Measure) => (m === 'tubes' ? 1 : individuals(s))

/**
 * A tube broken into weighted "units" for counting. By tubes it is one unit of weight 1;
 * by specimens each species association is a unit weighted by its specimen count, so
 * association-level dimensions (species, life stage…) get exactly their own individuals.
 */
export interface Unit { weight: number; assoc?: SpecimenSpecies }

export function unitsOf(s: Specimen, m: Measure): Unit[] {
  if (m === 'tubes') return [{ weight: 1 }]
  return s.species_associations.map((a) => ({ weight: a.specimen_count ?? 0, assoc: a }))
}

export function unitValues(s: Specimen, u: Unit, dim: DimKey): string[] {
  const d = DIM[dim]
  return u.assoc && d.assoc ? [d.assoc(u.assoc)] : d.values(s)
}

/** Count per value of a dimension, sorted by the dimension's order or by count desc. */
export function countBy(specimens: Specimen[], dim: DimKey, m: Measure = 'tubes'): { name: string; value: number }[] {
  const counts = new Map<string, number>()
  for (const s of specimens) {
    for (const u of unitsOf(s, m)) {
      for (const v of unitValues(s, u, dim)) counts.set(v, (counts.get(v) || 0) + u.weight)
    }
  }
  const rows = Array.from(counts, ([name, value]) => ({ name, value }))
  const order = DIM[dim].order
  if (order) return rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
  if (dim === 'year') return rows.sort((a, b) => a.name.localeCompare(b.name))
  return rows.sort((a, b) => b.value - a.value)
}

export const unitLabel = (m: Measure, n: number) =>
  m === 'tubes' ? (n === 1 ? 'tube' : 'tubes') : (n === 1 ? 'specimen' : 'specimens')

export const speciesLabel = (s: Specimen) => {
  const first = s.species_associations[0]
  return first ? speciesName(first) : 'Unknown species'
}
