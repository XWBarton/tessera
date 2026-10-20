import type { Specimen } from '../../types'
import { countBy, type DimKey, type Measure } from './dimensions'

export const CONFIDENCE_COLORS: Record<string, string> = {
  Confirmed: '#2e7d32',
  Probable:  '#1565c0',
  Possible:  '#e65100',
  Unknown:   '#757575',
}

export const PALETTE = [
  '#1677ff', '#fa8c16', '#722ed1', '#13c2c2', '#f5222d',
  '#52c41a', '#eb2f96', '#2f54eb', '#fa541c', '#d4b106',
]

export const OTHER = 'Other'
export const OTHER_COLOR = '#9e9e9e'

export interface LegendItem { name: string; color: string; count: number }

export interface ColorScale {
  /** Colour for a specimen (uses its first value on the dimension). */
  of: (s: Specimen) => string
  /** Colour for a raw dimension value. */
  value: (v: string) => string
  legend: LegendItem[]
}

// The most common values get a palette colour; the long tail collapses into "Other".
export function makeColorScale(
  specimens: Specimen[], dim: DimKey, dimValues: (s: Specimen) => string[], measure: Measure = 'tubes',
): ColorScale {
  const counts = countBy(specimens, dim, measure)
  const map = new Map<string, string>()
  if (dim === 'confidence') {
    counts.forEach((c) => map.set(c.name, CONFIDENCE_COLORS[c.name] || OTHER_COLOR))
  } else {
    [...counts].sort((a, b) => b.value - a.value).slice(0, PALETTE.length)
      .forEach((c, i) => map.set(c.name, PALETTE[i]))
  }
  const value = (v: string) => map.get(v) || OTHER_COLOR

  const legend: LegendItem[] = []
  let other = 0
  for (const c of counts) {
    if (map.has(c.name)) legend.push({ name: c.name, color: map.get(c.name)!, count: c.value })
    else other += c.value
  }
  if (other) legend.push({ name: OTHER, color: OTHER_COLOR, count: other })

  return { of: (s) => value(dimValues(s)[0]), value, legend }
}

/** Interpolate white → colour for heat shading; t in [0, 1]. */
export function heat(t: number, rgb: [number, number, number] = [46, 125, 50]): string {
  const k = Math.max(0, Math.min(1, t))
  const mix = (c: number) => Math.round(255 + (c - 255) * k)
  return `rgb(${mix(rgb[0])}, ${mix(rgb[1])}, ${mix(rgb[2])})`
}
