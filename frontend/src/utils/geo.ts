import type { SiteBoundary } from '../types'

/** A circle as a closed GeoJSON ring (counter-clockwise, [lon, lat]) approximating radiusM around a point. */
export function circleToPolygon(lat: number, lon: number, radiusM: number, steps = 64): SiteBoundary {
  const dLat = radiusM / 110540
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180))
  const ring: number[][] = []
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps
    ring.push([+(lon + dLon * Math.cos(a)).toFixed(6), +(lat + dLat * Math.sin(a)).toFixed(6)])
  }
  ring.push(ring[0])
  return { type: 'Polygon', coordinates: [ring] }
}

function ringAreaM2(ring: number[][], lat0: number): number {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const ky = 110540
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * kx * ring[i + 1][1] * ky - ring[i + 1][0] * kx * ring[i][1] * ky
  }
  return Math.abs(sum / 2)
}

/** Approximate area of a boundary in hectares (local flat projection; fine at site scale). */
export function boundaryAreaHa(b: SiteBoundary): number {
  const polys = (b.type === 'Polygon' ? [b.coordinates] : b.coordinates) as number[][][][]
  let total = 0
  for (const rings of polys) {
    const lat0 = rings[0].reduce((s, p) => s + p[1], 0) / rings[0].length
    rings.forEach((ring, i) => {
      total += (i === 0 ? 1 : -1) * ringAreaM2(ring, lat0)
    })
  }
  return total / 10000
}

export function formatHa(ha: number): string {
  if (ha >= 100) return `${Math.round(ha).toLocaleString()} ha`
  if (ha >= 1) return `${ha.toFixed(1)} ha`
  return `${(ha * 10000).toFixed(0)} m²`
}
