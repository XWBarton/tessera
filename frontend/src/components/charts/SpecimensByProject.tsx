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
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ bottom: 20 }}>
        <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#2e7d32" name="Specimens" />
      </BarChart>
    </ResponsiveContainer>
  )
}
