import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Specimen } from '../../types'

interface Props {
  specimens: Specimen[]
}


export default function SpecimensByProject({ specimens }: Props) {
  const counts: Record<string, number> = {}
  specimens.forEach((s) => {
    const key = s.project?.code || 'Unknown'
    counts[key] = (counts[key] || 0) + 1
  })
  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ bottom: 70, top: 5, left: 0, right: 10 }}>
        <XAxis
          dataKey="name"
          angle={-40}
          textAnchor="end"
          interval={0}
          tick={{ fontSize: 12 }}
          tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + '…' : v}
        />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" name="Specimens" fill="#2e7d32" />
      </BarChart>
    </ResponsiveContainer>
  )
}
