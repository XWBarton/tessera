import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Table, Typography, Tag, Spin, Button, Modal, Form, Input, Space, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useProject, useUpdateProject } from '../hooks/useProjects'
import { useSpecimens } from '../hooks/useSpecimens'
import { useAuth } from '../context/AuthContext'
import type { Specimen } from '../types'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const projectId = Number(id)
  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: specimensData, isLoading: specimensLoading } = useSpecimens({
    project_id: projectId,
    limit: 200,
  })
  const updateProject = useUpdateProject(projectId)
  const [editOpen, setEditOpen] = useState(false)

  const handleEdit = async (values: { name: string; description?: string }) => {
    try {
      await updateProject.mutateAsync(values)
      message.success('Project updated')
      setEditOpen(false)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to update project')
    }
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{project?.name}</Typography.Title>
        {user?.is_admin && (
          <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
      </div>
      <Card style={{ marginTop: 16, marginBottom: 16 }}>
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

      <Modal
        title="Edit Project"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          layout="vertical"
          onFinish={handleEdit}
          initialValues={{ name: project?.name, description: project?.description }}
        >
          <Form.Item label="Project Code">
            <Tag color="green">{project?.code}</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Code can't be changed — it's part of every specimen ID.
            </Typography.Text>
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={updateProject.isPending}>
                Save
              </Button>
              <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
