import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Typography,
  message,
  Tag,
  Popconfirm,
} from 'antd'
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons'
import { useProjects, useCreateProject, useDeleteProject } from '../hooks/useProjects'
import { useAuth } from '../context/AuthContext'
import type { Project } from '../types'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const handleCreate = async (values: {
    code: string
    name: string
    description?: string
  }) => {
    try {
      await createProject.mutateAsync(values)
      message.success('Project created')
      setModalOpen(false)
      form.resetFields()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to create project')
    }
  }

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (c: string) => <Tag color="green">{c}</Tag>,
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Project) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => navigate(`/projects/${record.id}`)}
          >
            View
          </Button>
          {user?.is_admin && (
            <Popconfirm
              title="Delete this project?"
              description="This will permanently delete the project and all its specimens."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                deleteProject
                  .mutateAsync(record.id)
                  .then(() => message.success('Project deleted'))
                  .catch(() => message.error('Failed to delete project'))
              }
            >
              <Button icon={<DeleteOutlined />} size="small" danger>
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          Projects
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          New Project
        </Button>
      </div>
      <Table
        dataSource={projects}
        columns={columns}
        rowKey="id"
        loading={isLoading}
      />
      <Modal
        title="Create Project"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="code"
            label="Project Code"
            rules={[
              { required: true },
              {
                pattern: /^[A-Z0-9]{1,20}$/,
                message: 'Uppercase letters and numbers only, max 20 chars',
              },
            ]}
          >
            <Input placeholder="e.g. AMPH2024" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createProject.isPending}
              >
                Create
              </Button>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
