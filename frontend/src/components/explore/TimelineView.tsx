import { useMemo, useState } from 'react'
import { Card, Empty, Select, Space, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, Brush, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import dayjs from 'dayjs'
import { DIM, DIM_OPTIONS, countBy, unitLabel, weightOf, type DimKey } from './dimensions'
import { makeColorScale } from './colors'
import CalendarHeatmap from './CalendarHeatmap'
import type { ExploreData } from './useExploreData'

const MAX_LANES = 15

export default function TimelineView({ data }: { data: ExploreData }) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="Collection activity" size="small"
        extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Click a day, month or year to filter</Typography.Text>}>
        <CalendarHeatmap specimens={data.undated} measure={data.measure} selected={data.filters.dateRange} onSelectRange={data.setDateRange} />
      </Card>
      <MonthlyHistogram data={data} />
      <Lanes data={data} />
    </Space>
  )
}

// ── Monthly histogram with a brush that sets the date filter ───────────────────

function MonthlyHistogram({ data }: { data: ExploreData }) {
  const months = useMemo(() => {
    const counts = new Map<string, number>()
    data.undated.forEach((s) => {
      const m = s.collection_date?.slice(0, 7)
      if (m) counts.set(m, (counts.get(m) || 0) + weightOf(s, data.measure))
    })
    const keys = Array.from(counts.keys()).sort()
    if (!keys.length) return []
    const out: { month: string; count: number }[] = []
    let m = dayjs(keys[0] + '-01')
    const end = dayjs(keys[keys.length - 1] + '-01')
    while (!m.isAfter(end)) {
      const k = m.format('YYYY-MM')
      out.push({ month: k, count: counts.get(k) || 0 })
      m = m.add(1, 'month')
    }
    return out
  }, [data.undated, data.measure])

  const range = data.filters.dateRange
  const startIndex = range ? Math.max(0, months.findIndex((m) => m.month >= range[0].slice(0, 7))) : 0
  let endIndex = months.length - 1
  if (range) while (endIndex > startIndex && months[endIndex].month > range[1].slice(0, 7)) endIndex--

  const commit = ({ startIndex: a, endIndex: b }: { startIndex?: number; endIndex?: number }) => {
    if (a == null || b == null) return
    if (a === 0 && b === months.length - 1) { data.setDateRange(undefined); return }
    data.setDateRange([
      `${months[a].month}-01`,
      dayjs(months[b].month + '-01').endOf('month').format('YYYY-MM-DD'),
    ])
  }

  if (months.length < 2) return null

  return (
    <Card title={`${data.measure === 'tubes' ? 'Tubes' : 'Specimens'} per month`} size="small"
      extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Drag the handles below to set the date range</Typography.Text>}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={months} margin={{ left: 0, right: 16, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={(v) => dayjs(v + '-01').format('MMM YY')} tick={{ fontSize: 11 }} minTickGap={20} />
          <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={(v) => dayjs(v + '-01').format('MMMM YYYY')} formatter={(v) => [v, data.measure === 'tubes' ? 'Tubes' : 'Specimens']} />
          <Bar dataKey="count" fill="#2e7d32" radius={[2, 2, 0, 0]} />
          <Brush
            key={`${range?.join() ?? 'all'}-${months.length}`}
            dataKey="month"
            height={28}
            stroke="#2e7d32"
            startIndex={startIndex}
            endIndex={endIndex}
            tickFormatter={(v) => dayjs(v + '-01').format('MMM YY')}
            onDragEnd={(idx) => commit(idx as { startIndex?: number; endIndex?: number })}
          >
            <BarChart>
              <Bar dataKey="count" fill="#a5d6a7" />
            </BarChart>
          </Brush>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

// ── Swimlane scatter: one lane per value of any dimension ──────────────────────

function Lanes({ data }: { data: ExploreData }) {
  const [laneBy, setLaneBy] = useState<DimKey>('project')
  const navigate = useNavigate()

  const { lanes, series } = useMemo(() => {
    const dated = data.filtered.filter((s) => s.collection_date)
    const lanes = countBy(dated, laneBy, data.measure).slice(0, MAX_LANES).map((c) => c.name)
    const scale = makeColorScale(dated, laneBy, DIM[laneBy].values, data.measure)
    const series = lanes.map((lane, y) => ({
      lane,
      color: scale.value(lane),
      points: dated
        .filter((s) => DIM[laneBy].values(s).includes(lane))
        .map((s) => ({
          x: dayjs(s.collection_date).valueOf(),
          y,
          id: s.id,
          code: s.specimen_code,
          lane,
          collector: s.collector?.full_name || s.collector_name || '',
          n: weightOf(s, 'specimens'),
        })),
    }))
    return { lanes, series }
  }, [data.filtered, laneBy, data.measure])

  return (
    <Card
      size="small"
      title={<Space>Timeline by <Select size="small" value={laneBy} onChange={setLaneBy} options={DIM_OPTIONS} style={{ width: 140 }} /></Space>}
      extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Click a lane label to filter · click a point to open the tube</Typography.Text>}
    >
      {lanes.length === 0 ? (
        <Empty description="No tubes with collection dates" />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, lanes.length * 40 + 80)}>
          <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x" type="number" domain={['dataMin', 'dataMax']} scale="time"
              tickFormatter={(v) => dayjs(v).format('MMM YYYY')} tick={{ fontSize: 11 }}
            />
            <YAxis
              dataKey="y" type="number" width={150}
              domain={[-0.5, lanes.length - 0.5]}
              ticks={lanes.map((_, i) => i)}
              interval={0}
              reversed
              tick={(props: { x: number; y: number; payload: { value: number } }) => {
                const name = lanes[props.payload.value] ?? ''
                return (
                  <text x={props.x} y={props.y} dy={4} textAnchor="end" fontSize={11} fill="#555"
                    style={{ cursor: 'pointer' }} onClick={() => data.toggle(laneBy, name)}>
                    {name.length > 22 ? name.slice(0, 21) + '…' : name}
                  </text>
                )
              }}
            />
            {/* By specimens, point size shows how many individuals a tube holds. */}
            <ZAxis dataKey="n" range={data.measure === 'specimens' ? [30, 320] : [60, 60]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0].payload
                return (
                  <div style={{ background: '#fff', border: '1px solid #d9d9d9', padding: 8, borderRadius: 4, fontSize: 13 }}>
                    <div><strong>{d.code}</strong></div>
                    <div>{DIM[laneBy].label}: {d.lane}</div>
                    <div>Date: {dayjs(d.x).format('D MMM YYYY')}</div>
                    <div>{d.n} {unitLabel('specimens', d.n)}</div>
                    {d.collector && <div>Collector: {d.collector}</div>}
                  </div>
                )
              }}
            />
            {series.map((s) => (
              <Scatter
                key={s.lane} name={s.lane} data={s.points} fill={s.color} opacity={0.8}
                style={{ cursor: 'pointer' }}
                onClick={(p: { id?: number; payload?: { id: number } }) => {
                  const id = p.payload?.id ?? p.id
                  if (id) navigate(`/specimens/${id}`)
                }}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
