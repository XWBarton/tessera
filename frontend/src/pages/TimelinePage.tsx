import { Typography, Card } from 'antd'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useSpecimens } from '../hooks/useSpecimens'
import { useMemo } from 'react'

export default function TimelinePage() {
  const { data } = useSpecimens({
    limit: 1000,
    sort_by: 'collection_date',
    sort_dir: 'asc',
  })

  const { chartData, projectNames } = useMemo(() => {
    const items = data?.items || []
    const projectIndex: Record<string, number> = {}
    let idx = 0

    const chartData = items
      .filter((s) => s.collection_date)
      .map((s) => {
        const project = s.project?.code || 'Unknown'
        if (!(project in projectIndex)) {
          projectIndex[project] = idx++
        }
        return {
          x: new Date(s.collection_date!).getTime(),
          y: projectIndex[project],
          code: s.specimen_code,
          project,
          collector: s.collector?.full_name || '',
          date: s.collection_date,
        }
      })

    return { chartData, projectNames: Object.keys(projectIndex) }
  }, [data])

  return (
    <div>
      <Typography.Title level={3}>Collection Timeline</Typography.Title>
      <Card>
        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
            No tubes with collection dates to display.
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={Math.max(300, projectNames.length * 60 + 100)}
          >
            <ScatterChart
              margin={{ left: 90, right: 20, top: 20, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v) => new Date(v).toLocaleDateString()}
                name="Date"
                label={{
                  value: 'Collection Date',
                  position: 'bottom',
                  offset: 30,
                }}
              />
              <YAxis
                dataKey="y"
                type="number"
                domain={[-0.5, projectNames.length - 0.5]}
                tickCount={projectNames.length}
                tickFormatter={(v) => projectNames[Math.round(v)] || ''}
                name="Project"
                width={80}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid #d9d9d9',
                        padding: 8,
                        borderRadius: 4,
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <strong>{d.code}</strong>
                      </div>
                      <div>Project: {d.project}</div>
                      <div>
                        Date: {new Date(d.x).toLocaleDateString()}
                      </div>
                      <div>Collector: {d.collector}</div>
                    </div>
                  )
                }}
              />
              <Scatter data={chartData} fill="#2e7d32" opacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
