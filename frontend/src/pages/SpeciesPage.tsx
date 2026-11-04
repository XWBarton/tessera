import { useMemo, useRef, useState } from 'react'
import { Typography, Table, Button, Modal, Form, Space, message, Popconfirm, Alert, Segmented, Switch } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, ApartmentOutlined, TableOutlined } from '@ant-design/icons'
import { useSpecies, useUpdateSpecies, useDeleteSpecies } from '../hooks/useSpecies'
import { useAuth } from '../context/AuthContext'
import { importSpeciesCSV } from '../api/species'
import { useQueryClient } from '@tanstack/react-query'
import type { Species } from '../types'
import SpeciesTree from '../components/species/SpeciesTree'
import { AddTaxonModal, RankTag, SpeciesFields, isSpeciesRank, normaliseTaxon, type TaxonValues } from '../components/species/TaxonForm'

export default function SpeciesPage() {
  const { user } = useAuth()
  const { data: species, isLoading } = useSpecies()
  const deleteSpecies = useDeleteSpecies()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editingSpecies, setEditingSpecies] = useState<Species | null>(null)
  const updateSpecies = useUpdateSpecies(editingSpecies?.id ?? 0)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<'tree' | 'table'>(() => {
    try { return localStorage.getItem('speciesView') === 'tree' ? 'tree' : 'table' } catch { return 'table' }
  })
  const changeView = (v: 'tree' | 'table') => {
    setView(v)
    try { localStorage.setItem('speciesView', v) } catch { /* per-viewer convenience only */ }
  }

  // "Ixodes sp." records how far a tube was identified, not a species, so it stays out of the
  // reference list unless asked for. The switch keeps those entries reachable for editing.
  const [showAboveSpecies, setShowAboveSpecies] = useState(false)
  const tableRows = useMemo(
    () => (showAboveSpecies ? species : species?.filter(isSpeciesRank)),
    [species, showAboveSpecies],
  )

  const handleEdit = async (values: TaxonValues) => {
    try {
      await updateSpecies.mutateAsync(normaliseTaxon(values))
      message.success('Species updated')
      setEditingSpecies(null)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to update species')
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
      render: (v: string, record: Species) => <><em>{v}</em><RankTag rank={record.rank} /></>,
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
      render: (v: string) => v
        ? <a href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${encodeURIComponent(v)}`} target="_blank" rel="noreferrer">{v}</a>
        : '—',
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
      width: 100,
      render: (_: unknown, record: Species) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => setEditingSpecies(record)} />
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
        </Space>
      ),
    }] : []),
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Species Lookup</Typography.Title>
        <Space>
          <Space size={6}>
            <Switch size="small" id="show-above-species" checked={showAboveSpecies} onChange={setShowAboveSpecies} />
            <label htmlFor="show-above-species">Show genus/family-level entries</label>
          </Space>
          <Segmented
            value={view}
            onChange={(v) => changeView(v as 'tree' | 'table')}
            options={[
              { value: 'tree', icon: <ApartmentOutlined />, label: 'Tree' },
              { value: 'table', icon: <TableOutlined />, label: 'Table' },
            ]}
          />
        {user?.is_admin && (
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
            Import CSV
          </Button>
        )}
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          Add Taxon
        </Button>
        </Space>
      </div>
      {view === 'tree' ? (
        <SpeciesTree
          species={species ?? []}
          showAboveSpecies={showAboveSpecies}
          canEdit={!!user?.is_admin}
          onEdit={setEditingSpecies}
          onDelete={(s) =>
            deleteSpecies
              .mutateAsync(s.id)
              .then(() => message.success('Deleted'))
              .catch(() => message.error('Failed to delete'))
          }
        />
      ) : (
        <Table dataSource={tableRows} columns={columns} rowKey="id" loading={isLoading} />
      )}

      <AddTaxonModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(s) => {
          if (s.rank !== 'species' && !showAboveSpecies) {
            message.info(`${s.scientific_name} is hidden here until you turn on "Show genus/family-level entries"`)
          }
        }}
      />

      {/* Edit species modal */}
      <Modal
        title={`Edit — ${editingSpecies?.scientific_name ?? ''}`}
        open={!!editingSpecies}
        onCancel={() => setEditingSpecies(null)}
        footer={null}
        destroyOnClose
      >
        {editingSpecies && (
          <Form key={editingSpecies.id} layout="vertical" onFinish={handleEdit} initialValues={editingSpecies}>
            <SpeciesFields />
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={updateSpecies.isPending}>Save</Button>
                <Button onClick={() => setEditingSpecies(null)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
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
              <code>order_name</code>, <code>taxon_id</code>, <code>notes</code>,{' '}
              <code>rank</code> (species, genus, family or order; defaults to species).
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
