import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data?: { name: string; value: number }[]
}

export default function StorageUsageChart({ data = [] }: Props) {
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
