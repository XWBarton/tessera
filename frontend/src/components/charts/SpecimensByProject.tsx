import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Specimen } from '../../types'

interface Props {
  specimens: Specimen[]
}

const GREEN_SHADES = [
  '#1b5e20',
  '#2e7d32',
  '#388e3c',
  '#43a047',
  '#558b2f',
  '#33691e',
  '#00695c',
  '#004d40',
]

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
        <Bar dataKey="value" name="Specimens">
          {data.map((_, i) => (
            <Cell key={i} fill={GREEN_SHADES[i % GREEN_SHADES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
