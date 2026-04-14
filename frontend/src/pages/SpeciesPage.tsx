import { useRef, useState } from 'react'
import { Typography, Table, Button, Modal, Form, Input, Space, message, Popconfirm, Upload, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { useSpecies, useCreateSpecies, useDeleteSpecies } from '../hooks/useSpecies'
import { useAuth } from '../context/AuthContext'
import { importSpeciesCSV } from '../api/species'
import { useQueryClient } from '@tanstack/react-query'
import type { Species } from '../types'

export default function SpeciesPage() {
  const { user } = useAuth()
  const { data: species, isLoading } = useSpecies()
  const createSpecies = useCreateSpecies()
  const deleteSpecies = useDeleteSpecies()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form] = Form.useForm()

  const handleCreate = async (values: { scientific_name: string; common_name?: string; notes?: string; genus?: string; family?: string; order_name?: string; taxon_id?: string }) => {
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

  const handleImport = async () => {
    if (!selectedFile) {
      message.error('Please select a CSV file')
      return
    }
    setImportLoading(true)
    setImportResult(null)
    try {
      const result = await importSpeciesCSV(selectedFile)
      setImportResult(result)
      queryClient.invalidateQueries({ queryKey: ['species'] })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Import failed')
    } finally {
      setImportLoading(false)
    }
  }

  const handleImportClose = () => {
    setImportModalOpen(false)
    setSelectedFile(null)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
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
      title: 'Genus',
      dataIndex: 'genus',
      key: 'genus',
      render: (v: string) => v || '—',
    },
    {
      title: 'Family',
      dataIndex: 'family',
      key: 'family',
      render: (v: string) => v || '—',
    },
    {
      title: 'Order',
      dataIndex: 'order_name',
      key: 'order_name',
      render: (v: string) => v || '—',
    },
    {
      title: 'Taxon ID',
      dataIndex: 'taxon_id',
      key: 'taxon_id',
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
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
              Import CSV
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Add Species
            </Button>
          </Space>
        )}
      </div>
      <Table dataSource={species} columns={columns} rowKey="id" loading={isLoading} />

      {/* Add single species modal */}
      <Modal title="Add Species" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="scientific_name" label="Scientific Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Amblyomma triguttatum" />
          </Form.Item>
          <Form.Item name="common_name" label="Common Name">
            <Input placeholder="e.g. Ornate Kangaroo Tick" />
          </Form.Item>
          <Form.Item name="genus" label="Genus">
            <Input placeholder="e.g. Amblyomma" />
          </Form.Item>
          <Form.Item name="family" label="Family">
            <Input placeholder="e.g. Ixodidae" />
          </Form.Item>
          <Form.Item name="order_name" label="Order">
            <Input placeholder="e.g. Ixodida" />
          </Form.Item>
          <Form.Item name="taxon_id" label="Taxon ID">
            <Input placeholder="e.g. NCBI:123456" />
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

      {/* Bulk import modal */}
      <Modal
        title="Import Species from CSV"
        open={importModalOpen}
        onCancel={handleImportClose}
        footer={
          importResult ? (
            <Button onClick={handleImportClose}>Close</Button>
          ) : (
            <Space>
              <Button onClick={handleImportClose}>Cancel</Button>
              <Button type="primary" loading={importLoading} onClick={handleImport} disabled={!selectedFile}>
                Import
              </Button>
            </Space>
          )
        }
      >
        {!importResult ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              Upload a CSV with a <code>scientific_name</code> column. Optional columns:{' '}
              <code>common_name</code>, <code>genus</code>, <code>family</code>,{' '}
              <code>order_name</code>, <code>taxon_id</code>, <code>notes</code>.
              Rows with duplicate scientific names are skipped.
            </Typography.Text>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            {selectedFile && (
              <Typography.Text type="secondary">{selectedFile.name}</Typography.Text>
            )}
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type={importResult.errors.length > 0 ? 'warning' : 'success'}
              message={`Import complete: ${importResult.created} added, ${importResult.skipped} skipped`}
              showIcon
            />
            {importResult.errors.length > 0 && (
              <div>
                <Typography.Text type="danger">Errors:</Typography.Text>
                <ul style={{ marginTop: 4 }}>
                  {importResult.errors.map((err, i) => (
                    <li key={i}><Typography.Text type="danger" style={{ fontSize: 12 }}>{err}</Typography.Text></li>
                  ))}
                </ul>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  )
}
