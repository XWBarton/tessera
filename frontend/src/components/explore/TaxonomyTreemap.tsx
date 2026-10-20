import { useMemo, useState } from 'react'
import { Breadcrumb, Button, Card, Empty, Space, Typography } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { Specimen } from '../../types'
import { rankValue } from '../species/SpeciesTree'
import { speciesName, type DimKey } from './dimensions'
import { PALETTE } from './colors'
import type { ExploreData } from './useExploreData'

// Order > Family > Genus > Species; each level maps onto an Explore filter dimension.
const RANKS: { dim: DimKey; label: string }[] = [
  { dim: 'order', label: 'Order' },
  { dim: 'family', label: 'Family' },
  { dim: 'genus', label: 'Genus' },
  { dim: 'species', label: 'Species' },
]

interface TaxNode { name: string; size: number; children: Map<string, TaxNode> }

function buildTree(specimens: Specimen[]): TaxNode {
  const root: TaxNode = { name: 'All', size: 0, children: new Map() }
  for (const s of specimens) {
    // A tube counts once per distinct taxon path it contains.
    const paths = new Set(s.species_associations.map((a) => [
      a.species ? rankValue(a.species, 'order') : 'Unassigned',
      a.species ? rankValue(a.species, 'family') : 'Unassigned',
      a.species ? rankValue(a.species, 'genus') : 'Unassigned',
      speciesName(a),
    ].join('\u0000')))
    if (!s.species_associations.length) paths.add(['Unassigned', 'Unassigned', 'Unassigned', 'No species'].join('\u0000'))
    for (const p of paths) {
      let node = root
      root.size++
      for (const name of p.split('\u0000')) {
        let child = node.children.get(name)
        if (!child) { child = { name, size: 0, children: new Map() }; node.children.set(name, child) }
        child.size++
        node = child
      }
    }
  }
  return root
}

interface CellProps {
  x: number; y: number; width: number; height: number
  name: string; size: number; index: number; depth: number
}

function Cell({ x, y, width, height, name, size, index, depth }: CellProps) {
  if (depth !== 1) return null
  const fill = PALETTE[index % PALETTE.length]
  const showText = width > 50 && height > 28
  return (
    <g style={{ cursor: 'pointer' }}>
      <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.85} stroke="#fff" strokeWidth={2} rx={3} />
      {showText && (
        <>
          <text x={x + 8} y={y + 18} fill="#fff" fontSize={13} fontWeight={600} style={{ pointerEvents: 'none' }}>
            {name.length > width / 8 ? name.slice(0, Math.max(3, Math.floor(width / 8) - 1)) + '…' : name}
          </text>
          {height > 44 && (
            <text x={x + 8} y={y + 35} fill="#fff" fillOpacity={0.85} fontSize={11} style={{ pointerEvents: 'none' }}>
              {size} tube{size === 1 ? '' : 's'}
            </text>
          )}
        </>
      )}
    </g>
  )
}

export default function TaxonomyTreemap({ data }: { data: ExploreData }) {
  const [path, setPath] = useState<string[]>([])
  const tree = useMemo(() => buildTree(data.filtered), [data.filtered])

  // Walk down the drill path, stopping early if filters removed a level.
  let node = tree
  const valid: string[] = []
  for (const name of path) {
    const next = node.children.get(name)
    if (!next) break
    node = next
    valid.push(name)
  }
  const depth = valid.length
  const rank = RANKS[depth]
  const items = Array.from(node.children.values())
    .sort((a, b) => b.size - a.size)
    .map((c) => ({ name: c.name, size: c.size }))

  const onCellClick = (cell: { name?: string }) => {
    if (!cell?.name) return
    if (depth === RANKS.length - 1) data.toggle('species', cell.name)
    else setPath([...valid, cell.name])
  }

  const filterHere = () => {
    if (!depth) return
    data.select([[RANKS[depth - 1].dim, valid[depth - 1]]])
  }

  return (
    <Card size="small">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Breadcrumb
          items={[
            { title: <a onClick={() => setPath([])}>All taxa</a> },
            ...valid.map((name, i) => ({
              title: i === valid.length - 1
                ? <span><Typography.Text type="secondary" style={{ fontSize: 11 }}>{RANKS[i].label} </Typography.Text>{name}</span>
                : <a onClick={() => setPath(valid.slice(0, i + 1))}>{name}</a>,
            })),
          ]}
        />
        <Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {rank ? `Showing ${rank.label.toLowerCase()} · click to ${depth === RANKS.length - 1 ? 'filter' : 'drill in'}` : ''}
          </Typography.Text>
          {depth > 0 && (
            <Button size="small" icon={<FilterOutlined />} onClick={filterHere}>
              Filter to {valid[depth - 1]}
            </Button>
          )}
        </Space>
      </div>
      {items.length === 0 ? (
        <Empty description="No tubes match the current filters" />
      ) : (
        <ResponsiveContainer width="100%" height={480}>
          <Treemap
            data={items}
            dataKey="size"
            nameKey="name"
            isAnimationActive={false}
            content={<Cell {...({} as CellProps)} />}
            onClick={onCellClick}
          >
            <Tooltip formatter={(v) => [`${v} tubes`, rank?.label]} />
          </Treemap>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
