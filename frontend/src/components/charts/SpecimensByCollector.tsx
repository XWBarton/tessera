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

export default function SpecimensByCollector({ specimens }: Props) {
  const counts: Record<string, number> = {}
  specimens.forEach((s) => {
    const key = s.collector?.full_name || 'Unknown'
    counts[key] = (counts[key] || 0) + 1
  })
  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ bottom: 20 }}>
        <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#388e3c" name="Specimens" />
      </BarChart>
    </ResponsiveContainer>
  )
}
