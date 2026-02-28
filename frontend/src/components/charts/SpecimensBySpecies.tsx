import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Specimen } from '../../types'

interface Props {
  specimens: Specimen[]
}

const COLORS = [
  '#6366f1',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
  '#10b981',
  '#8b5cf6',
  '#f97316',
  '#3b82f6',
  '#14b8a6',
  '#ef4444',
]

export default function SpecimensBySpecies({ specimens }: Props) {
  const counts: Record<string, number> = {}
  specimens.forEach((s) => {
    if (s.species_associations.length === 0) {
      counts['Unknown'] = (counts['Unknown'] || 0) + 1
    } else {
      s.species_associations.forEach((a) => {
        const key = a.species?.scientific_name || a.free_text_species || 'Unknown'
        counts[key] = (counts[key] || 0) + 1
      })
    }
  })
  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
