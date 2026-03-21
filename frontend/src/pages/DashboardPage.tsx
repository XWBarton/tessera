import React, { useState, useMemo, type ReactNode } from 'react'
import {
  Row, Col, Card, Statistic, Typography, Spin,
  Button, Drawer, Checkbox, Table, Tag, Progress,
} from 'antd'
import {
  ExperimentOutlined, ProjectOutlined, TeamOutlined, CalendarOutlined,
  SettingOutlined, HolderOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts'
import { useSpecimenStats } from '../hooks/useSpecimens'
import { useProjects } from '../hooks/useProjects'
import { useUsers } from '../hooks/useUsers'
import SpecimensByProject from '../components/charts/SpecimensByProject'
import SpecimensByCollector from '../components/charts/SpecimensByCollector'
import SpecimensByMonth from '../components/charts/SpecimensByMonth'
import SpecimensBySpecies from '../components/charts/SpecimensBySpecies'
import SampleTypeSplit from '../components/charts/SampleTypeSplit'
import StorageUsageChart from '../components/charts/StorageUsageChart'
import type { Specimen } from '../types'

// ── Widget registry ────────────────────────────────────────────────────────

type WidgetKey =
  | 'stat_total_tubes' | 'stat_projects' | 'stat_team' | 'stat_this_month'
  | 'chart_by_project' | 'chart_by_collector' | 'chart_by_month' | 'chart_by_species'
  | 'chart_sample_type' | 'chart_leaderboard' | 'chart_storage'
  | 'list_recent' | 'list_low_qty'

interface WidgetDef { key: WidgetKey; title: string; type: 'stat' | 'half' | 'full'; group: string }

const WIDGETS: WidgetDef[] = [
  { key: 'stat_total_tubes',   title: 'Total Tubes',           type: 'stat', group: 'Stats' },
  { key: 'stat_projects',      title: 'Projects',              type: 'stat', group: 'Stats' },
  { key: 'stat_team',          title: 'Team Members',          type: 'stat', group: 'Stats' },
  { key: 'stat_this_month',    title: 'Tubes This Month',      type: 'stat', group: 'Stats' },
  { key: 'chart_by_project',   title: 'Tubes by Project',      type: 'half', group: 'Charts' },
  { key: 'chart_by_collector', title: 'Tubes by Collector',    type: 'half', group: 'Charts' },
  { key: 'chart_by_month',     title: 'Tubes by Month',        type: 'half', group: 'Charts' },
  { key: 'chart_by_species',   title: 'Tubes by Species',      type: 'half', group: 'Charts' },
  { key: 'chart_sample_type',  title: 'Sample Type Split',     type: 'half', group: 'Charts' },
  { key: 'chart_leaderboard',  title: 'Collector Leaderboard', type: 'half', group: 'Charts' },
  { key: 'chart_storage',      title: 'Storage Usage',         type: 'half', group: 'Charts' },
  { key: 'list_recent',        title: 'Recent Additions',      type: 'full', group: 'Lists' },
  { key: 'list_low_qty',       title: 'Low Quantity Alerts',   type: 'full', group: 'Lists' },
]

const STORAGE_KEY = 'tessera_dashboard_widgets'

function loadEnabled(): WidgetKey[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as WidgetKey[]
  } catch { /* ignore */ }
  return WIDGETS.map((w) => w.key)
}

// ── Inline widget components ───────────────────────────────────────────────

function CollectorLeaderboard({ specimens, data: dataProp }: { specimens?: Specimen[]; data?: { name: string; value: number }[] }) {
  const data = dataProp ?? (() => {
    const counts: Record<string, number> = {}
    ;(specimens ?? []).forEach((s) => {
      const key = s.collector?.full_name || s.collector_name || 'Unknown'
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  })()

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5 }}>
        <XAxis type="number" />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 12 }}
          tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 19) + '…' : v}
        />
        <RTooltip />
        <Bar dataKey="value" name="Tubes" fill="#722ed1" />
      </BarChart>
    </ResponsiveContainer>
  )
}

function RecentAdditions({ specimens }: { specimens: Specimen[] }) {
  const navigate = useNavigate()
  const recent = useMemo(
    () => specimens,
    [specimens],
  )
  return (
    <Table
      dataSource={recent}
      rowKey="id"
      size="small"
      pagination={false}
      onRow={(r) => ({ onClick: () => navigate(`/specimens/${r.id}`), style: { cursor: 'pointer' } })}
      columns={[
        { title: 'Code', dataIndex: 'specimen_code', key: 'code', render: (v) => <strong>{v}</strong> },
        { title: 'Project', key: 'project', render: (_, r) => r.project?.code || '—' },
        {
          title: 'Species', key: 'species',
          render: (_, r) => r.species_associations[0]?.species?.scientific_name
            || r.species_associations[0]?.free_text_species || '—',
        },
        { title: 'Collected', dataIndex: 'collection_date', key: 'date', render: (v) => v || '—' },
        { title: 'Added', dataIndex: 'created_at', key: 'added', render: (v: string) => new Date(v).toLocaleDateString() },
      ]}
    />
  )
}

function LowQuantityAlerts({ specimens }: { specimens: Specimen[] }) {
  const navigate = useNavigate()
  const lowQty = useMemo(
    () => specimens,
    [specimens],
  )

  if (lowQty.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>
        No low quantity alerts &mdash; all tubes are well stocked.
      </div>
    )
  }

  return (
    <Table
      dataSource={lowQty}
      rowKey="id"
      size="small"
      pagination={false}
      onRow={(r) => ({ onClick: () => navigate(`/specimens/${r.id}`), style: { cursor: 'pointer' } })}
      columns={[
        { title: 'Code', dataIndex: 'specimen_code', key: 'code', render: (v) => <strong>{v}</strong> },
        { title: 'Project', key: 'project', render: (_, r) => r.project?.code || '—' },
        {
          title: 'Remaining', key: 'qty',
          render: (_, r) => {
            const pct = Math.round((r.quantity_remaining! / r.quantity_value!) * 100)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                  {r.quantity_remaining} / {r.quantity_value} {r.quantity_unit}
                </span>
                <Progress
                  percent={pct}
                  size="small"
                  status="exception"
                  style={{ flex: 1, minWidth: 80, maxWidth: 120, margin: 0 }}
                  showInfo={false}
                />
                <Tag color="red">{pct}%</Tag>
              </div>
            )
          },
        },
      ]}
    />
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [enabled, setEnabled] = useState<WidgetKey[]>(loadEnabled)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<WidgetKey[]>([])
  const [dragKey, setDragKey] = useState<WidgetKey | null>(null)
  const [dragOver, setDragOver] = useState<WidgetKey | null>(null)

  const { data: stats, isLoading } = useSpecimenStats()
  const { data: projects } = useProjects()
  const { data: users } = useUsers()

  if (isLoading) return <Spin />

  const statWidgets = enabled.filter((k) => WIDGETS.find((w) => w.key === k && w.type === 'stat'))
  const halfWidgets = enabled.filter((k) => WIDGETS.find((w) => w.key === k && w.type === 'half'))
  const fullWidgets = enabled.filter((k) => WIDGETS.find((w) => w.key === k && w.type === 'full'))

  const statSmSpan = statWidgets.length >= 3 ? 8 : 12
  const statMdSpan = statWidgets.length === 4 ? 6 : statWidgets.length === 3 ? 8 : statWidgets.length === 2 ? 12 : 24

  const openDrawer = () => { setDraft([...enabled]); setDrawerOpen(true) }
  const saveAndClose = () => {
    setEnabled(draft)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    setDrawerOpen(false)
  }

  const toggleDraft = (key: WidgetKey, checked: boolean) => {
    if (checked) {
      setDraft((prev) => {
        const group = WIDGETS.find((w) => w.key === key)?.group
        const groupKeys = WIDGETS.filter((w) => w.group === group).map((w) => w.key)
        let insertIdx = prev.length
        for (let i = prev.length - 1; i >= 0; i--) {
          if (groupKeys.includes(prev[i])) { insertIdx = i + 1; break }
        }
        const next = [...prev]
        next.splice(insertIdx, 0, key)
        return next
      })
    } else {
      setDraft((prev) => prev.filter((k) => k !== key))
    }
  }

  const handleDragStart = (e: React.DragEvent, key: WidgetKey) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragKey(key)
  }
  const handleDragOver = (e: React.DragEvent, key: WidgetKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOver !== key) setDragOver(key)
  }
  const handleDrop = (e: React.DragEvent, targetKey: WidgetKey) => {
    e.preventDefault()
    if (!dragKey || dragKey === targetKey) { setDragKey(null); setDragOver(null); return }
    setDraft((prev) => {
      const fromIdx = prev.indexOf(dragKey)
      const toIdx = prev.indexOf(targetKey)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, dragKey)
      return next
    })
    setDragKey(null)
    setDragOver(null)
  }
  const handleDragEnd = () => { setDragKey(null); setDragOver(null) }

  const renderStat = (key: WidgetKey) => {
    const s = { height: '100%' }
    switch (key) {
      case 'stat_total_tubes':
        return <Card style={s}><Statistic title="Total Tubes" value={stats?.total || 0} prefix={<ExperimentOutlined />} valueStyle={{ color: '#2e7d32' }} /></Card>
      case 'stat_projects':
        return <Card style={s}><Statistic title="Projects" value={projects?.length || 0} prefix={<ProjectOutlined />} /></Card>
      case 'stat_team':
        return <Card style={s}><Statistic title="Team Members" value={users?.length || 0} prefix={<TeamOutlined />} /></Card>
      case 'stat_this_month':
        return <Card style={s}><Statistic title="Tubes This Month" value={stats?.this_month || 0} prefix={<CalendarOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
      default: return null
    }
  }

  const renderHalf = (key: WidgetKey) => {
    const title = WIDGETS.find((w) => w.key === key)?.title || ''
    let content: ReactNode
    switch (key) {
      case 'chart_by_project':   content = <SpecimensByProject data={stats?.by_project} />; break
      case 'chart_by_collector': content = <SpecimensByCollector data={stats?.by_collector} />; break
      case 'chart_by_month':     content = <SpecimensByMonth data={stats?.by_month} />; break
      case 'chart_by_species':   content = <SpecimensBySpecies data={stats?.by_species} />; break
      case 'chart_sample_type':  content = <SampleTypeSplit data={stats?.by_sample_type} />; break
      case 'chart_leaderboard':  content = <CollectorLeaderboard data={stats?.by_collector} />; break
      case 'chart_storage':      content = <StorageUsageChart data={stats?.by_storage} />; break
      default: return null
    }
    return <Card title={title}>{content}</Card>
  }

  const renderFull = (key: WidgetKey) => {
    const title = WIDGETS.find((w) => w.key === key)?.title || ''
    let content: ReactNode
    switch (key) {
      case 'list_recent':  content = <RecentAdditions specimens={stats?.recent ?? []} />; break
      case 'list_low_qty': content = <LowQuantityAlerts specimens={stats?.low_qty ?? []} />; break
      default: return null
    }
    return <Card title={title}>{content}</Card>
  }

  const groups = ['Stats', 'Charts', 'Lists']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Dashboard</Typography.Title>
        <Button icon={<SettingOutlined />} onClick={openDrawer}>Customise</Button>
      </div>

      {enabled.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
            <SettingOutlined style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
            No widgets selected. Click <strong>Customise</strong> to add widgets to your dashboard.
          </div>
        </Card>
      ) : (
        <>
          {statWidgets.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              {statWidgets.map((key) => (
                <Col key={key} xs={24} sm={statWidgets.length === 1 ? 24 : statSmSpan} md={statMdSpan} style={{ display: 'flex' }}>
                  <div style={{ flex: 1 }}>{renderStat(key)}</div>
                </Col>
              ))}
            </Row>
          )}
          {(halfWidgets.length > 0 || fullWidgets.length > 0) && (
            <Row gutter={[16, 16]}>
              {halfWidgets.map((key) => (
                <Col key={key} xs={24} lg={12}>
                  {renderHalf(key)}
                </Col>
              ))}
              {fullWidgets.map((key) => (
                <Col key={key} xs={24}>
                  {renderFull(key)}
                </Col>
              ))}
            </Row>
          )}
        </>
      )}

      <Drawer
        title="Customise Dashboard"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={300}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={saveAndClose}>Save</Button>
          </div>
        }
      >
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          Drag enabled widgets to reorder them.
        </Typography.Text>
        {groups.map((group, gi) => {
          const groupKeys = WIDGETS.filter((w) => w.group === group).map((w) => w.key)
          const enabledInGroup = draft.filter((k) => groupKeys.includes(k))
          const disabledInGroup = groupKeys.filter((k) => !draft.includes(k))
          const ordered = [...enabledInGroup, ...disabledInGroup]
          return (
            <div key={group} style={{ marginBottom: 20 }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>{group}</Typography.Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {ordered.map((key) => {
                  const isEnabled = draft.includes(key)
                  const isDragging = dragKey === key
                  const isOver = dragOver === key
                  const title = WIDGETS.find((w) => w.key === key)?.title || ''
                  return (
                    <div
                      key={key}
                      draggable={isEnabled}
                      onDragStart={isEnabled ? (e) => handleDragStart(e, key) : undefined}
                      onDragOver={isEnabled ? (e) => handleDragOver(e, key) : undefined}
                      onDrop={isEnabled ? (e) => handleDrop(e, key) : undefined}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: isDragging ? '#f5f5f5' : isOver ? '#e6f4ff' : 'transparent',
                        border: `1px solid ${isOver ? '#1677ff' : 'transparent'}`,
                        opacity: isDragging ? 0.4 : 1,
                        cursor: isEnabled ? 'grab' : 'default',
                        userSelect: 'none',
                      }}
                    >
                      <HolderOutlined style={{ color: isEnabled ? '#bbb' : 'transparent', fontSize: 14, flexShrink: 0 }} />
                      <Checkbox
                        checked={isEnabled}
                        onChange={(e) => toggleDraft(key, e.target.checked)}
                      >
                        {title}
                      </Checkbox>
                    </div>
                  )
                })}
              </div>
              {gi < groups.length - 1 && <div style={{ borderBottom: '1px solid #f0f0f0', marginTop: 14 }} />}
            </div>
          )
        })}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button size="small" onClick={() => setDraft(WIDGETS.map((w) => w.key))}>Select All</Button>
          <Button size="small" onClick={() => setDraft([])}>Clear All</Button>
        </div>
      </Drawer>
    </div>
  )
}
