import { Alert, Segmented, Space, Spin, Tabs, Typography } from 'antd'
import {
  EnvironmentOutlined, CalendarOutlined, ApartmentOutlined, BranchesOutlined, TableOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { useExploreData, FETCH_LIMIT } from '../components/explore/useExploreData'
import type { Measure } from '../components/explore/dimensions'
import SummaryStrip from '../components/explore/SummaryStrip'
import ExploreFilterBar from '../components/explore/ExploreFilterBar'
import MapView from '../components/explore/MapView'
import TimelineView from '../components/explore/TimelineView'
import TaxonomyTreemap from '../components/explore/TaxonomyTreemap'
import FlowView from '../components/explore/FlowView'
import PivotGrid from '../components/explore/PivotGrid'

export default function ExplorePage() {
  const data = useExploreData()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'map'

  const setTab = (key: string) => setParams((prev) => {
    const next = new URLSearchParams(prev)
    next.set('tab', key)
    return next
  }, { replace: true })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Explore</Typography.Title>
        <Space>
          <Typography.Text type="secondary">Count</Typography.Text>
          <Segmented
            value={data.measure}
            onChange={(v) => data.setMeasure(v as Measure)}
            options={[{ value: 'specimens', label: 'Specimens' }, { value: 'tubes', label: 'Tubes' }]}
          />
        </Space>
      </div>

      {data.total > FETCH_LIMIT && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message={`Showing the first ${FETCH_LIMIT} of ${data.total} tubes.`}
        />
      )}

      <ExploreFilterBar data={data} />

      <Spin spinning={data.isLoading}>
        <SummaryStrip specimens={data.filtered} all={data.all} />
        <Tabs
          activeKey={tab}
          onChange={setTab}
          destroyInactiveTabPane
          items={[
            { key: 'map', label: <span><EnvironmentOutlined /> Map</span>, children: <MapView data={data} /> },
            { key: 'time', label: <span><CalendarOutlined /> Calendar &amp; timeline</span>, children: <TimelineView data={data} /> },
            { key: 'taxonomy', label: <span><ApartmentOutlined /> Taxonomy</span>, children: <TaxonomyTreemap data={data} /> },
            { key: 'flow', label: <span><BranchesOutlined /> Flow</span>, children: <FlowView data={data} /> },
            { key: 'pivot', label: <span><TableOutlined /> Breakdown</span>, children: <PivotGrid data={data} /> },
          ]}
        />
      </Spin>
    </div>
  )
}
