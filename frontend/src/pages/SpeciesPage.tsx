import { useState } from 'react'
import { Typography, Table, Button, Modal, Form, Input, Space, message, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSpecies, useCreateSpecies, useDeleteSpecies } from '../hooks/useSpecies'
import { useAuth } from '../context/AuthContext'
import type { Species } from '../types'

export default function SpeciesPage() {
  const { user } = useAuth()
  const { data: species, isLoading } = useSpecies()
  const createSpecies = useCreateSpecies()
  const deleteSpecies = useDeleteSpecies()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const handleCreate = async (values: { scientific_name: string; common_name?: string; notes?: string }) => {
    try {
      await createSpecies.mutateAsync(values)
      message.success('Species added')
      setModalOpen(false)
      form.resetFields()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to add species')
    }
  }

  const columns = [
    {
      title: 'Scientific Name',
      dataIndex: 'scientific_name',
      key: 'scientific_name',
      render: (v: string) => <em>{v}</em>,
    },
    {
      title: 'Common Name',
      dataIndex: 'common_name',
      key: 'common_name',
      render: (v: string) => v || '—',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    ...(user?.is_admin ? [{
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Species) => (
        <Popconfirm
          title="Delete this species?"
          onConfirm={() =>
            deleteSpecies
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
        <Typography.Title level={3} style={{ margin: 0 }}>Species Lookup</Typography.Title>
        {user?.is_admin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add Species
          </Button>
        )}
      </div>
      <Table dataSource={species} columns={columns} rowKey="id" loading={isLoading} />

      <Modal title="Add Species" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="scientific_name" label="Scientific Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Amblyomma triguttatum" />
          </Form.Item>
          <Form.Item name="common_name" label="Common Name">
            <Input placeholder="e.g. Ornate Kangaroo Tick" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createSpecies.isPending}>Add</Button>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
