import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Table, Typography, Tag, Spin } from 'antd'
import { useProject } from '../hooks/useProjects'
import { useSpecimens } from '../hooks/useSpecimens'
import type { Specimen } from '../types'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projectId = Number(id)
  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: specimensData, isLoading: specimensLoading } = useSpecimens({
    project_id: projectId,
    limit: 200,
  })

  if (projectLoading) return <Spin />

  const columns = [
    {
      title: 'Code',
      dataIndex: 'specimen_code',
      key: 'specimen_code',
      render: (c: string, r: Specimen) => (
        <a onClick={() => navigate(`/specimens/${r.id}`)}>{c}</a>
      ),
    },
    { title: 'Date', dataIndex: 'collection_date', key: 'collection_date' },
    {
      title: 'Collector',
      key: 'collector',
      render: (_: unknown, r: Specimen) => r.collector?.full_name || '—',
    },
    {
      title: 'Storage',
      dataIndex: 'storage_location',
      key: 'storage_location',
    },
  ]

  return (
    <div>
      <Typography.Title level={3}>{project?.name}</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions>
          <Descriptions.Item label="Code">
            <Tag color="green">{project?.code}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Description">
            {project?.description || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {project?.created_at
              ? new Date(project.created_at).toLocaleDateString()
              : ''}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Typography.Title level={4}>
        Tubes ({specimensData?.total || 0})
      </Typography.Title>
      <Table
        dataSource={specimensData?.items}
        columns={columns}
        rowKey="id"
        loading={specimensLoading}
        pagination={{ total: specimensData?.total, pageSize: 50 }}
      />
    </div>
  )
}
