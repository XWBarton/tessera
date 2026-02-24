import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Specimen } from '../../types'

interface Props {
  specimens: Specimen[]
}

const COLORS = [
  '#1b5e20',
  '#2e7d32',
  '#388e3c',
  '#558b2f',
  '#33691e',
  '#43a047',
  '#00695c',
  '#004d40',
  '#66bb6a',
  '#81c784',
]

export default function SpecimensBySpecies({ specimens }: Props) {
  const counts: Record<string, number> = {}
  specimens.forEach((s) => {
    const primary = s.species_associations.find((a) => a.is_primary)
    const key =
      primary?.species?.scientific_name ||
      primary?.free_text_species ||
      'Unknown'
    counts[key] = (counts[key] || 0) + 1
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
