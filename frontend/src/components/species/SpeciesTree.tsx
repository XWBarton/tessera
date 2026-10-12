import { useMemo, useState } from 'react'
import { Input, Button, Space, Typography, Popconfirm, Card, Descriptions, Empty, theme } from 'antd'
import { EditOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons'
import type { Species } from '../../types'

const UNASSIGNED = 'Unassigned'
const PALETTE = ['#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2', '#d4b106', '#f5222d']
const NEUTRAL = '#8c8c8c'

const ROW = 34 // vertical space per leaf
const NODE_H = 26
const COL_GAP = 56
const PAD = 16
const CHAR_W = 7 // rough text width at 13px

type Rank = 'root' | 'order' | 'family' | 'genus'

interface TaxonNode {
  key: string
  name: string
  rank?: Rank
  species?: Species
  count: number
  color: string
  children?: TaxonNode[]
}

const NEXT_RANK: Record<string, Rank | undefined> = { order: 'family', family: 'genus', genus: undefined }

function rankValue(s: Species, rank: Rank): string {
  const v = rank === 'order' ? s.order_name : rank === 'family' ? s.family : s.genus
  return v?.trim() || UNASSIGNED
}

// Group species by Order > Family > Genus; species sit at the leaves.
function buildTree(species: Species[], rank: Rank = 'order', parentKey = '', color?: string): TaxonNode[] {
  const groups = new Map<string, Species[]>()
  for (const s of species) {
    const k = rankValue(s, rank)
    const list = groups.get(k)
    if (list) list.push(s)
    else groups.set(k, [s])
  }
  const next = NEXT_RANK[rank]
  return [...groups.entries()]
    .sort(([a], [b]) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)))
    .map(([name, members], i) => {
      const key = `${parentKey}/${rank}:${name}`
      // Each order gets its own colour; everything beneath inherits it
      const c = color ?? (name === UNASSIGNED ? NEUTRAL : PALETTE[i % PALETTE.length])
      const children = next
        ? buildTree(members, next, key, c)
        : [...members]
            .sort((a, b) => a.scientific_name.localeCompare(b.scientific_name))
            .map((s) => ({ key: `species:${s.id}`, name: s.scientific_name, species: s, count: 1, color: c }))
      return { key, name, rank, count: members.length, color: c, children }
    })
}

function filterTree(nodes: TaxonNode[], q: string): TaxonNode[] {
  const out: TaxonNode[] = []
  for (const n of nodes) {
    if (n.species) {
      const s = n.species
      const hay = `${s.scientific_name} ${s.common_name ?? ''} ${s.taxon_id ?? ''}`.toLowerCase()
      if (hay.includes(q)) out.push(n)
      continue
    }
    // A group whose own name matches keeps all of its species
    if (n.name.toLowerCase().includes(q)) {
      out.push(n)
      continue
    }
    const kids = n.children ? filterTree(n.children, q) : []
    if (kids.length) out.push({ ...n, children: kids, count: kids.reduce((t, k) => t + k.count, 0) })
  }
  return out
}

function groupKeys(nodes: TaxonNode[]): string[] {
  return nodes.flatMap((n) => (n.children?.length ? [n.key, ...groupKeys(n.children)] : []))
}

interface Laid {
  node: TaxonNode
  depth: number
  x: number
  y: number
  w: number
  folded: boolean
  children: Laid[]
}

function labelOf(n: TaxonNode): string {
  if (n.species) return n.species.common_name ? `${n.species.scientific_name}  ${n.species.common_name}` : n.species.scientific_name
  return n.rank === 'root' ? n.name : `${n.name}  ${n.count}`
}

function layoutTree(root: TaxonNode, collapsed: Set<string>, forceOpen: boolean) {
  let nextRow = 0
  const widths: number[] = []

  const place = (node: TaxonNode, depth: number): Laid => {
    const w = Math.max(labelOf(node).length * CHAR_W + 34, 64)
    widths[depth] = Math.max(widths[depth] ?? 0, w)
    const folded = !forceOpen && node.rank !== 'root' && !!node.children?.length && collapsed.has(node.key)
    if (!node.children?.length || folded) {
      return { node, depth, x: 0, y: nextRow++ * ROW, w, folded, children: [] }
    }
    const kids = node.children.map((c) => place(c, depth + 1))
    return { node, depth, x: 0, y: (kids[0].y + kids[kids.length - 1].y) / 2, w, folded, children: kids }
  }
  const laid = place(root, 0)

  const colX: number[] = []
  let cursor = PAD
  widths.forEach((w, d) => {
    colX[d] = cursor
    cursor += w + COL_GAP
  })
  const assign = (l: Laid) => {
    l.x = colX[l.depth]
    l.w = widths[l.depth]
    l.children.forEach(assign)
  }
  assign(laid)
  return { laid, width: cursor - COL_GAP + PAD, height: Math.max(nextRow, 1) * ROW + PAD }
}

function flatten(l: Laid, out: Laid[] = []): Laid[] {
  out.push(l)
  l.children.forEach((c) => flatten(c, out))
  return out
}

export default function SpeciesTree({ species, canEdit, onEdit, onDelete }: {
  species: Species[]
  canEdit: boolean
  onEdit: (s: Species) => void
  onDelete: (s: Species) => void
}) {
  const { token } = theme.useToken()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const q = search.trim().toLowerCase()

  const groups = useMemo(() => buildTree(species), [species])
  const visible = useMemo(() => (q ? filterTree(groups, q) : groups), [groups, q])
  const root: TaxonNode = useMemo(
    () => ({
      key: 'root',
      name: 'All species',
      rank: 'root',
      count: visible.reduce((t, g) => t + g.count, 0),
      color: token.colorTextBase,
      children: visible,
    }),
    [visible, token.colorTextBase],
  )
  // Expand everything while searching so matches are visible
  const { laid, width, height } = useMemo(() => layoutTree(root, collapsed, !!q), [root, collapsed, q])
  const nodes = useMemo(() => flatten(laid), [laid])
  const selected = selectedId != null ? species.find((s) => s.id === selectedId) : undefined

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const links: React.ReactNode[] = []
  for (const l of nodes) {
    for (const c of l.children) {
      const x1 = l.x + l.w
      const y1 = l.y + NODE_H / 2 + PAD / 2
      const x2 = c.x
      const y2 = c.y + NODE_H / 2 + PAD / 2
      const mid = (x1 + x2) / 2
      links.push(
        <path
          key={`${l.node.key}>${c.node.key}`}
          d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
          fill="none"
          stroke={c.node.color}
          strokeOpacity={l.node.rank === 'root' ? 0.35 : 0.5}
          strokeWidth={1.5}
        />,
      )
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Search species"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button size="small" onClick={() => setCollapsed(new Set())}>Expand all</Button>
        <Button size="small" onClick={() => setCollapsed(new Set(groupKeys(groups)))}>Collapse all</Button>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Order → Family → Genus → Species. Click a branch to fold it, or a species for its details.
        </Typography.Text>
      </Space>

      {selected && (
        <Card
          size="small"
          style={{ marginBottom: 12 }}
          title={<em>{selected.scientific_name}</em>}
          extra={
            <Space>
              {canEdit && (
                <>
                  <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(selected)}>Edit</Button>
                  <Popconfirm
                    title="Delete this species?"
                    onConfirm={() => { onDelete(selected); setSelectedId(null) }}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
                  </Popconfirm>
                </>
              )}
              <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setSelectedId(null)} />
            </Space>
          }
        >
          <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="Common name">{selected.common_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Order">{selected.order_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Family">{selected.family || '—'}</Descriptions.Item>
            <Descriptions.Item label="Genus">{selected.genus || '—'}</Descriptions.Item>
            <Descriptions.Item label="Taxon ID">
              {selected.taxon_id ? (
                <a
                  href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${encodeURIComponent(selected.taxon_id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selected.taxon_id}
                </a>
              ) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Notes">{selected.notes || '—'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {species.length === 0 || visible.length === 0 ? (
        <Empty description={q ? 'No species match your search' : 'No species yet'} />
      ) : (
        <div
          style={{
            overflow: 'auto',
            maxHeight: '70vh',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            background: token.colorBgContainer,
          }}
        >
          <svg width={width} height={height + PAD / 2} style={{ display: 'block', minWidth: '100%' }}>
            {links}
            {nodes.map((l) => {
              const { node } = l
              const isRoot = node.rank === 'root'
              const isSpecies = !!node.species
              const isGroup = !isSpecies && !isRoot
              const y = l.y + PAD / 2
              const active = isSpecies && node.species!.id === selectedId
              const fill = isRoot
                ? token.colorTextBase
                : isSpecies
                  ? token.colorBgContainer
                  : `${node.color}22`
              const textFill = isRoot ? token.colorBgContainer : token.colorText
              const clickable = isGroup || isSpecies
              const onActivate = () => {
                if (isGroup) toggle(node.key)
                else if (isSpecies) setSelectedId(active ? null : node.species!.id)
              }
              return (
                <g
                  key={node.key}
                  transform={`translate(${l.x},${y})`}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={isGroup ? `${l.folded ? 'Expand' : 'Collapse'} ${node.name}` : undefined}
                  onClick={clickable ? onActivate : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate() } } : undefined}
                >
                  <rect
                    width={l.w}
                    height={NODE_H}
                    rx={NODE_H / 2}
                    fill={fill}
                    stroke={isRoot ? 'none' : node.color}
                    strokeWidth={active ? 2.5 : 1.25}
                    strokeOpacity={isSpecies && !active ? 0.6 : 1}
                  />
                  {isGroup && (
                    <circle cx={13} cy={NODE_H / 2} r={4} fill={l.folded ? node.color : 'none'} stroke={node.color} strokeWidth={1.5} />
                  )}
                  {isSpecies && <circle cx={13} cy={NODE_H / 2} r={3} fill={node.color} />}
                  <text
                    x={isRoot ? 14 : 24}
                    y={NODE_H / 2}
                    dominantBaseline="central"
                    fontSize={13}
                    fill={textFill}
                    fontWeight={isSpecies ? 400 : 600}
                    fontStyle={isSpecies || node.rank === 'genus' ? 'italic' : 'normal'}
                  >
                    {node.name}
                    {isSpecies && node.species!.common_name && (
                      <tspan dx={8} fontStyle="normal" fill={token.colorTextSecondary} fontSize={12}>
                        {node.species!.common_name}
                      </tspan>
                    )}
                    {!isSpecies && (
                      <tspan dx={8} fontStyle="normal" fontWeight={400} fill={isRoot ? textFill : token.colorTextSecondary} fontSize={12}>
                        {node.count}
                      </tspan>
                    )}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}
