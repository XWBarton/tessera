import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSpecimens } from '../../hooks/useSpecimens'
import type { Specimen } from '../../types'
import { DIM, DIMENSIONS, type DimKey } from './dimensions'

export const FETCH_LIMIT = 5000

export interface ExploreFilters {
  dims: Partial<Record<DimKey, string[]>>
  dateRange?: [string, string]
}

// Filters live in the URL (?project=A&project=B&from=…&to=…) so a view can be shared or bookmarked.
function readFilters(params: URLSearchParams): ExploreFilters {
  const dims: ExploreFilters['dims'] = {}
  for (const d of DIMENSIONS) {
    const vals = params.getAll(d.key)
    if (vals.length) dims[d.key] = vals
  }
  const from = params.get('from')
  const to = params.get('to')
  return { dims, dateRange: from && to ? [from, to] : undefined }
}

function matches(s: Specimen, f: ExploreFilters, skip?: DimKey | 'date'): boolean {
  if (f.dateRange && skip !== 'date') {
    const d = s.collection_date
    if (!d || d < f.dateRange[0] || d > f.dateRange[1]) return false
  }
  for (const [key, selected] of Object.entries(f.dims) as [DimKey, string[]][]) {
    if (key === skip || !selected?.length) continue
    if (!DIM[key].values(s).some((v) => selected.includes(v))) return false
  }
  return true
}

export function useExploreData() {
  const [params, setParams] = useSearchParams()
  const { data, isLoading } = useSpecimens({ limit: FETCH_LIMIT, sort_by: 'collection_date', sort_dir: 'asc' })

  const all = useMemo(() => data?.items || [], [data])
  const filters = useMemo(() => readFilters(params), [params])
  const filtered = useMemo(() => all.filter((s) => matches(s, filters)), [all, filters])

  /** Matches every filter except the date range — lets date-brushing charts keep their full extent. */
  const undated = useMemo(() => all.filter((s) => matches(s, filters, 'date')), [all, filters])

  /** Specimens matching every filter except one dimension — used for facet counts. */
  const filterExcept = useCallback((dim: DimKey) => all.filter((s) => matches(s, filters, dim)), [all, filters])

  const update = useCallback((fn: (p: URLSearchParams) => void) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      fn(next)
      return next
    }, { replace: true })
  }, [setParams])

  const setDim = useCallback((dim: DimKey, values: string[]) => update((p) => {
    p.delete(dim)
    values.forEach((v) => p.append(dim, v))
  }), [update])

  const toggle = useCallback((dim: DimKey, value: string) => update((p) => {
    const cur = p.getAll(dim)
    p.delete(dim)
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
    next.forEach((v) => p.append(dim, v))
  }), [update])

  /** Apply several dimension values at once (e.g. a pivot cell), replacing those dimensions. */
  const select = useCallback((pairs: [DimKey, string][]) => update((p) => {
    pairs.forEach(([dim, value]) => { p.delete(dim); p.append(dim, value) })
  }), [update])

  const setDateRange = useCallback((range?: [string, string]) => update((p) => {
    p.delete('from'); p.delete('to')
    if (range) { p.set('from', range[0]); p.set('to', range[1]) }
  }), [update])

  const clear = useCallback(() => update((p) => {
    DIMENSIONS.forEach((d) => p.delete(d.key))
    p.delete('from'); p.delete('to')
  }), [update])

  return {
    all, filtered, undated, filters, isLoading,
    total: data?.total ?? 0,
    filterExcept, setDim, toggle, select, setDateRange, clear,
  }
}

export type ExploreData = ReturnType<typeof useExploreData>
