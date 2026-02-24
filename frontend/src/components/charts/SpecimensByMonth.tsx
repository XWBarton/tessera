import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { Specimen } from '../../types'

interface Props {
  specimens: Specimen[]
}

export default function SpecimensByMonth({ specimens }: Props) {
  const counts: Record<string, number> = {}
  specimens.forEach((s) => {
    if (s.collection_date) {
      const key = s.collection_date.substring(0, 7)
      counts[key] = (counts[key] || 0) + 1
    }
  })
  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#2e7d32"
          strokeWidth={2}
          dot={false}
          name="Specimens"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
