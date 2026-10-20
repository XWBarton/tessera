import { useMemo } from 'react'
import { Card, Col, Row, Statistic } from 'antd'
import dayjs from 'dayjs'
import type { Specimen } from '../../types'
import { DIM, NONE, individuals } from './dimensions'

function distinct(specimens: Specimen[], values: (s: Specimen) => string[]) {
  const set = new Set<string>()
  specimens.forEach((s) => values(s).forEach((v) => v !== NONE && set.add(v)))
  return set.size
}

export default function SummaryStrip({ specimens, all }: { specimens: Specimen[]; all: Specimen[] }) {
  const stats = useMemo(() => {
    const dates = specimens.map((s) => s.collection_date).filter(Boolean).sort() as string[]
    const geo = specimens.filter((s) => s.collection_lat != null && s.collection_lon != null).length
    return {
      individuals: specimens.reduce((n, s) => n + individuals(s), 0),
      species: distinct(specimens, DIM.species.values),
      sites: distinct(specimens, DIM.site.values),
      collectors: distinct(specimens, DIM.collector.values),
      span: dates.length
        ? `${dayjs(dates[0]).format('MMM YYYY')} – ${dayjs(dates[dates.length - 1]).format('MMM YYYY')}`
        : '—',
      geoPct: specimens.length ? Math.round((geo / specimens.length) * 100) : 0,
    }
  }, [specimens])
  const filtered = specimens.length !== all.length
  const allIndividuals = useMemo(() => all.reduce((n, s) => n + individuals(s), 0), [all])

  const items = [
    { title: 'Specimens', value: stats.individuals, suffix: filtered ? `/ ${allIndividuals}` : undefined },
    { title: 'Tubes', value: specimens.length, suffix: filtered ? `/ ${all.length}` : undefined },
    { title: 'Species', value: stats.species },
    { title: 'Sites', value: stats.sites },
    { title: 'Collectors', value: stats.collectors },
    { title: 'Collected', value: stats.span },
    { title: 'Georeferenced', value: stats.geoPct, suffix: '%' },
  ]

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {items.map((it) => (
        <Col key={it.title} xs={12} sm={8} md={6} xl={3}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic
              title={it.title}
              value={it.value}
              suffix={it.suffix}
              valueStyle={{ fontSize: typeof it.value === 'string' ? 15 : 22, lineHeight: '30px' }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  )
}
