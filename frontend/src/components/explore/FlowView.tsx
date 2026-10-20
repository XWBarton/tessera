import { useMemo, useState } from 'react'
import { Button, Card, Empty, InputNumber, Select, Space, Typography } from 'antd'
import { ArrowRightOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons'
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts'
import { DIM, DIM_OPTIONS, countBy, type DimKey } from './dimensions'
import { OTHER, OTHER_COLOR, PALETTE } from './colors'
import type { ExploreData } from './useExploreData'

interface FlowNode { name: string; dim: DimKey; value: string; color: string; stage: number }

interface NodeProps {
  x: number; y: number; width: number; height: number; index: number
  payload: FlowNode & { value: number }
  onPick: (n: FlowNode) => void
  lastStage: number
  nodes: FlowNode[]
}

function FlowNodeShape({ x, y, width, height, index, onPick, lastStage, nodes, payload }: NodeProps) {
  const n = nodes[index]
  if (!n) return null
  const rightEdge = n.stage === lastStage
  const label = n.value.length > 26 ? n.value.slice(0, 25) + '…' : n.value
  return (
    <g style={{ cursor: n.value === OTHER ? 'default' : 'pointer' }} onClick={() => n.value !== OTHER && onPick(n)}>
      <rect x={x} y={y} width={width} height={Math.max(height, 1)} fill={n.color} rx={2} />
      {height > 9 && (
        <text
          x={rightEdge ? x - 6 : x + width + 6}
          y={y + height / 2}
          dy={4}
          textAnchor={rightEdge ? 'end' : 'start'}
          fontSize={11}
          fill="#333"
        >
          {label} <tspan fill="#999">{payload.value}</tspan>
        </text>
      )}
    </g>
  )
}

export default function FlowView({ data }: { data: ExploreData }) {
  const [stages, setStages] = useState<DimKey[]>(['project', 'site', 'species'])
  const [topN, setTopN] = useState(8)

  const graph = useMemo(() => {
    const nodes: FlowNode[] = []
    const index = new Map<string, number>()
    // Per stage, keep the top-N values; the rest fold into "Other".
    const keep = stages.map((dim) => new Set(countBy(data.filtered, dim).slice(0, topN).map((c) => c.name)))
    const nodeId = (stage: number, value: string) => {
      const v = keep[stage].has(value) ? value : OTHER
      const key = `${stage}\u0000${v}`
      let id = index.get(key)
      if (id == null) {
        id = nodes.length
        index.set(key, id)
        const color = v === OTHER ? OTHER_COLOR : PALETTE[(keep[stage].size ? Array.from(keep[stage]).indexOf(v) : 0) % PALETTE.length]
        nodes.push({ name: `${DIM[stages[stage]].label}: ${v}`, dim: stages[stage], value: v, color, stage })
      }
      return id
    }

    const links = new Map<string, { source: number; target: number; value: number }>()
    for (const s of data.filtered) {
      const vals = stages.map((dim) => DIM[dim].values(s))
      for (let i = 0; i < stages.length - 1; i++) {
        // Split a tube's weight across its value combinations so totals stay honest.
        const w = 1 / (vals[i].length * vals[i + 1].length)
        for (const a of vals[i]) for (const b of vals[i + 1]) {
          const source = nodeId(i, a)
          const target = nodeId(i + 1, b)
          const k = `${source}-${target}`
          const l = links.get(k)
          if (l) l.value += w
          else links.set(k, { source, target, value: w })
        }
      }
    }
    return {
      nodes,
      links: Array.from(links.values()).map((l) => ({ ...l, value: Math.round(l.value * 100) / 100 })),
    }
  }, [data.filtered, stages, topN])

  const setStage = (i: number, dim: DimKey) => setStages((s) => s.map((d, j) => (j === i ? dim : d)))

  return (
    <Card size="small">
      <Space wrap style={{ marginBottom: 12 }}>
        {stages.map((dim, i) => (
          <Space key={i} size={4}>
            {i > 0 && <ArrowRightOutlined style={{ color: '#aaa' }} />}
            <Select size="small" value={dim} onChange={(v) => setStage(i, v)} options={DIM_OPTIONS} style={{ width: 130 }} />
            {stages.length > 2 && (
              <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setStages((s) => s.filter((_, j) => j !== i))} />
            )}
          </Space>
        ))}
        {stages.length < 4 && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => setStages((s) => [...s, DIM_OPTIONS.find((o) => !s.includes(o.value))!.value])}>
            Stage
          </Button>
        )}
        <Space size={4}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Top</Typography.Text>
          <InputNumber size="small" min={3} max={20} value={topN} onChange={(v) => v && setTopN(v)} style={{ width: 60 }} />
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Click a node to filter</Typography.Text>
      </Space>

      {graph.links.length === 0 ? (
        <Empty description="No tubes match the current filters" />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(360, Math.min(800, graph.nodes.length * 22))}>
          <Sankey
            data={graph}
            nodePadding={12}
            nodeWidth={12}
            margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
            link={{ stroke: '#2e7d32', strokeOpacity: 0.18 }}
            node={
              <FlowNodeShape
                {...({} as NodeProps)}
                nodes={graph.nodes}
                lastStage={stages.length - 1}
                onPick={(n) => data.toggle(n.dim, n.value)}
              />
            }
          >
            <Tooltip formatter={(v) => [`${v} tubes`]} />
          </Sankey>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
