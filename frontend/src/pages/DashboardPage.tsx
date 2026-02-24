import { Row, Col, Card, Statistic, Typography, Spin } from 'antd'
import { ExperimentOutlined, ProjectOutlined, TeamOutlined } from '@ant-design/icons'
import { useSpecimens } from '../hooks/useSpecimens'
import { useProjects } from '../hooks/useProjects'
import { useUsers } from '../hooks/useUsers'
import SpecimensByProject from '../components/charts/SpecimensByProject'
import SpecimensByCollector from '../components/charts/SpecimensByCollector'
import SpecimensByMonth from '../components/charts/SpecimensByMonth'
import SpecimensBySpecies from '../components/charts/SpecimensBySpecies'

export default function DashboardPage() {
  const { data: specimensData, isLoading } = useSpecimens({ limit: 1000 })
  const { data: projects } = useProjects()
  const { data: users } = useUsers()

  if (isLoading) return <Spin />

  const specimens = specimensData?.items || []

  return (
    <div>
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Tubes"
              value={specimensData?.total || 0}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#2e7d32' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Projects"
              value={projects?.length || 0}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Team Members"
              value={users?.length || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Tubes by Project">
            <SpecimensByProject specimens={specimens} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Tubes by Collector">
            <SpecimensByCollector specimens={specimens} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Tubes by Month">
            <SpecimensByMonth specimens={specimens} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Tubes by Species">
            <SpecimensBySpecies specimens={specimens} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
