import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Specimen } from '../../types'

interface Props {
  specimens?: Specimen[]
  data?: { name: string; value: number }[]
}

export default function StorageUsageChart({ specimens, data: dataProp }: Props) {
  const data = dataProp ?? (() => {
    const counts: Record<string, number> = {}
    ;(specimens ?? []).forEach((s) => {
      const key = s.storage_location || 'No location'
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
  })()

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5 }}>
        <XAxis type="number" />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 12 }}
          tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 21) + '…' : v}
        />
        <Tooltip />
        <Bar dataKey="value" name="Tubes" fill="#1677ff" />
      </BarChart>
    </ResponsiveContainer>
  )
}
