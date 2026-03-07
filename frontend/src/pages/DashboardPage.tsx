import { useState, useMemo, type ReactNode } from 'react'
import {
  Row, Col, Card, Statistic, Typography, Spin,
  Button, Drawer, Checkbox, Table, Tag, Progress,
} from 'antd'
import {
  ExperimentOutlined, ProjectOutlined, TeamOutlined, CalendarOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts'
import { useSpecimens } from '../hooks/useSpecimens'
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

function CollectorLeaderboard({ specimens }: { specimens: Specimen[] }) {
  const counts: Record<string, number> = {}
  specimens.forEach((s) => {
    const key = s.collector?.full_name || s.collector_name || 'Unknown'
    counts[key] = (counts[key] || 0) + 1
  })
  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

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
    () => [...specimens].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10),
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
    () => specimens
      .filter((s) => s.quantity_value && s.quantity_remaining != null && s.quantity_remaining / s.quantity_value < 0.25)
      .sort((a, b) => (a.quantity_remaining! / a.quantity_value!) - (b.quantity_remaining! / b.quantity_value!))
      .slice(0, 20),
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

  const { data: specimensData, isLoading } = useSpecimens({ limit: 1000 })
  const { data: projects } = useProjects()
  const { data: users } = useUsers()

  if (isLoading) return <Spin />

  const specimens = specimensData?.items || []
  const thisMonth = new Date().toISOString().substring(0, 7)
  const thisMonthCount = specimens.filter((s) => s.collection_date?.startsWith(thisMonth)).length

  const statWidgets = WIDGETS.filter((w) => w.type === 'stat' && enabled.includes(w.key)).map((w) => w.key)
  const halfWidgets = WIDGETS.filter((w) => w.type === 'half' && enabled.includes(w.key)).map((w) => w.key)
  const fullWidgets = WIDGETS.filter((w) => w.type === 'full' && enabled.includes(w.key)).map((w) => w.key)

  const statSmSpan = statWidgets.length >= 3 ? 8 : 12
  const statMdSpan = statWidgets.length === 4 ? 6 : statWidgets.length === 3 ? 8 : statWidgets.length === 2 ? 12 : 24

  const openDrawer = () => { setDraft([...enabled]); setDrawerOpen(true) }
  const saveAndClose = () => {
    setEnabled(draft)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    setDrawerOpen(false)
  }
  const toggleDraft = (key: WidgetKey, checked: boolean) =>
    setDraft((prev) => checked ? [...prev, key] : prev.filter((k) => k !== key))

  const renderStat = (key: WidgetKey) => {
    switch (key) {
      case 'stat_total_tubes':
        return <Card><Statistic title="Total Tubes" value={specimensData?.total || 0} prefix={<ExperimentOutlined />} valueStyle={{ color: '#2e7d32' }} /></Card>
      case 'stat_projects':
        return <Card><Statistic title="Projects" value={projects?.length || 0} prefix={<ProjectOutlined />} /></Card>
      case 'stat_team':
        return <Card><Statistic title="Team Members" value={users?.length || 0} prefix={<TeamOutlined />} /></Card>
      case 'stat_this_month':
        return <Card><Statistic title="Tubes This Month" value={thisMonthCount} prefix={<CalendarOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
      default: return null
    }
  }

  const renderHalf = (key: WidgetKey) => {
    const title = WIDGETS.find((w) => w.key === key)?.title || ''
    let content: ReactNode
    switch (key) {
      case 'chart_by_project':   content = <SpecimensByProject specimens={specimens} />; break
      case 'chart_by_collector': content = <SpecimensByCollector specimens={specimens} />; break
      case 'chart_by_month':     content = <SpecimensByMonth specimens={specimens} />; break
      case 'chart_by_species':   content = <SpecimensBySpecies specimens={specimens} />; break
      case 'chart_sample_type':  content = <SampleTypeSplit specimens={specimens} />; break
      case 'chart_leaderboard':  content = <CollectorLeaderboard specimens={specimens} />; break
      case 'chart_storage':      content = <StorageUsageChart specimens={specimens} />; break
      default: return null
    }
    return <Card title={title}>{content}</Card>
  }

  const renderFull = (key: WidgetKey) => {
    const title = WIDGETS.find((w) => w.key === key)?.title || ''
    let content: ReactNode
    switch (key) {
      case 'list_recent':  content = <RecentAdditions specimens={specimens} />; break
      case 'list_low_qty': content = <LowQuantityAlerts specimens={specimens} />; break
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
                <Col key={key} xs={24} sm={statWidgets.length === 1 ? 24 : statSmSpan} md={statMdSpan}>
                  {renderStat(key)}
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
        {groups.map((group, gi) => (
          <div key={group} style={{ marginBottom: 20 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 10 }}>{group}</Typography.Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {WIDGETS.filter((w) => w.group === group).map((w) => (
                <Checkbox
                  key={w.key}
                  checked={draft.includes(w.key)}
                  onChange={(e) => toggleDraft(w.key, e.target.checked)}
                >
                  {w.title}
                </Checkbox>
              ))}
            </div>
            {gi < groups.length - 1 && <div style={{ borderBottom: '1px solid #f0f0f0', marginTop: 16 }} />}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button size="small" onClick={() => setDraft(WIDGETS.map((w) => w.key))}>Select All</Button>
          <Button size="small" onClick={() => setDraft([])}>Clear All</Button>
        </div>
      </Drawer>
    </div>
  )
}
