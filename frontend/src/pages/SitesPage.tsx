import { useState } from 'react'
import { Typography, Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSites, useCreateSite, useDeleteSite } from '../hooks/useSites'
import { useAuth } from '../context/AuthContext'
import type { Site } from '../types'

export default function SitesPage() {
  const { user } = useAuth()
  const { data: sites, isLoading } = useSites()
  const createSite = useCreateSite()
  const deleteSite = useDeleteSite()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const handleCreate = async (values: {
    name: string
    description?: string
    habitat_type?: string
    lat?: number
    lon?: number
    notes?: string
  }) => {
    try {
      await createSite.mutateAsync(values)
      message.success('Site added')
      setModalOpen(false)
      form.resetFields()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to add site')
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Habitat',
      dataIndex: 'habitat_type',
      key: 'habitat_type',
      render: (v: string) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'Coordinates',
      key: 'coords',
      render: (_: unknown, r: Site) => r.lat != null ? `${r.lat}, ${r.lon}` : '—',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    ...(user?.is_admin ? [{
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Site) => (
        <Popconfirm
          title="Delete this site?"
          onConfirm={() =>
            deleteSite
              .mutateAsync(record.id)
              .then(() => message.success('Deleted'))
              .catch(() => message.error('Failed to delete'))
          }
        >
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      ),
    }] : []),
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Sites</Typography.Title>
        {user?.is_admin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add Site
          </Button>
        )}
      </div>
      <Table dataSource={sites} columns={columns} rowKey="id" loading={isLoading} />

      <Modal title="Add Site" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={520}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Site Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Wetlands Reserve North" />
          </Form.Item>
          <Form.Item name="habitat_type" label="Habitat Type">
            <Input placeholder="e.g. Wetland, Forest, Grassland" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input placeholder="e.g. Northern section near dam wall" />
          </Form.Item>
          <Form.Item label="Coordinates (optional)">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="lat" noStyle>
                <InputNumber style={{ width: '50%' }} placeholder="Latitude" step={0.0001} />
              </Form.Item>
              <Form.Item name="lon" noStyle>
                <InputNumber style={{ width: '50%' }} placeholder="Longitude" step={0.0001} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createSite.isPending}>Add</Button>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
