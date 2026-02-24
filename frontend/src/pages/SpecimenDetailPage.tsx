import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  Popconfirm,
  message,
  Table,
  Progress,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Divider,
} from 'antd'
import { EditOutlined, DeleteOutlined, DownloadOutlined, ExperimentOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSpecimen, useDeleteSpecimen } from '../hooks/useSpecimens'
import { useTubeUsage, useRecordUsage, useDeleteUsageEntry } from '../hooks/useTubeUsage'
import { downloadLabel } from '../api/specimens'
import { useAuth } from '../context/AuthContext'
import type { SpecimenSpecies, TubeUsageLog } from '../types'

const CONFIDENCE_COLORS: Record<string, string> = {
  Confirmed: 'green',
  Probable: 'blue',
  Possible: 'orange',
  Unknown: 'default',
}

function assocLabel(a: SpecimenSpecies): string {
  const name = a.species?.scientific_name || a.free_text_species || 'Unknown'
  const parts = [name, a.life_stage, a.sex].filter(Boolean)
  return parts.join(' ')
}

export default function SpecimenDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const specimenId = Number(id)
  const { data: specimen, isLoading } = useSpecimen(specimenId)
  const { data: usageLog } = useTubeUsage(specimenId)
  const deleteSpecimen = useDeleteSpecimen()
  const recordUsage = useRecordUsage(specimenId)
  const deleteUsage = useDeleteUsageEntry(specimenId)
  const [usageModalOpen, setUsageModalOpen] = useState(false)
  const [usageForm] = Form.useForm()
  // breakdown counts keyed by association index
  const [breakdownCounts, setBreakdownCounts] = useState<Record<number, number>>({})

  if (isLoading) return <Spin />
  if (!specimen) return <Typography.Text>Tube not found</Typography.Text>

  const primarySpecies = specimen.species_associations.find((a) => a.is_primary)
  const countedAssociations = specimen.species_associations.filter(
    (a) => (a.specimen_count ?? 0) > 0,
  )
  const hasAssociations = countedAssociations.length > 0
  const breakdownTotal = Object.values(breakdownCounts).reduce((s, n) => s + (n || 0), 0)

  const handleDelete = async () => {
    try {
      await deleteSpecimen.mutateAsync(specimenId)
      message.success('Tube deleted')
      navigate('/specimens')
    } catch {
      message.error('Failed to delete tube')
    }
  }

  const openUsageModal = () => {
    setBreakdownCounts({})
    usageForm.setFieldsValue({
      date: dayjs(),
      unit: specimen.quantity_unit || '',
      quantity_taken: undefined,
    })
    setUsageModalOpen(true)
  }

  const handleRecordUsage = async (values: Record<string, unknown>) => {
    try {
      const breakdown = hasAssociations
        ? countedAssociations
            .map((a, i) => ({ label: assocLabel(a), count: breakdownCounts[i] || 0 }))
            .filter((item) => item.count > 0)
        : undefined

      const quantity_taken = hasAssociations
        ? breakdownTotal
        : (values.quantity_taken as number)

      if (hasAssociations && quantity_taken === 0) {
        message.warning('Enter at least one count')
        return
      }

      await recordUsage.mutateAsync({
        date: dayjs(values.date as string).format('YYYY-MM-DD'),
        quantity_taken,
        unit: values.unit as string,
        purpose: values.purpose as string | undefined,
        molecular_ref: values.molecular_ref as string | undefined,
        breakdown,
        notes: values.notes as string | undefined,
      })
      message.success('Usage recorded')
      setUsageModalOpen(false)
      usageForm.resetFields()
      setBreakdownCounts({})
    } catch {
      message.error('Failed to record usage')
    }
  }

  // Quantity remaining display
  const hasQuantity = specimen.quantity_value != null
  const remaining = specimen.quantity_remaining ?? specimen.quantity_value ?? 0
  const total = specimen.quantity_value ?? 0
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0
  const progressStatus = pct <= 10 ? 'exception' : pct <= 30 ? 'normal' : 'success'

  const totalSpeciesCount = specimen.species_associations.reduce(
    (sum, a) => sum + (a.specimen_count ?? 0),
    0,
  )

  const speciesColumns = [
    {
      title: 'Species',
      key: 'name',
      render: (_: unknown, r: SpecimenSpecies) =>
        r.species ? <em>{r.species.scientific_name}</em> : r.free_text_species,
    },
    {
      title: 'Common Name',
      key: 'common',
      render: (_: unknown, r: SpecimenSpecies) => r.species?.common_name || '—',
    },
    {
      title: 'Life Stage / Sex',
      key: 'life_stage',
      render: (_: unknown, r: SpecimenSpecies) => {
        if (!r.life_stage) return '—'
        const label = r.sex ? `${r.life_stage} ${r.sex}` : r.life_stage
        return <Tag>{label}</Tag>
      },
    },
    {
      title: 'Count',
      key: 'specimen_count',
      width: 180,
      render: (_: unknown, r: SpecimenSpecies) => {
        const count = r.specimen_count
        if (count == null) return '—'
        const pct = totalSpeciesCount > 0 ? Math.round((count / totalSpeciesCount) * 100) : 0
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <span style={{ fontSize: 13 }}><strong>{count}</strong> <span style={{ color: '#888', fontSize: 11 }}>({pct}%)</span></span>
            <Progress percent={pct} size="small" showInfo={false} />
          </Space>
        )
      },
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (c: string) => <Tag color={CONFIDENCE_COLORS[c]}>{c}</Tag>,
    },
    {
      title: 'Primary',
      dataIndex: 'is_primary',
      key: 'is_primary',
      render: (v: boolean) => (v ? <Tag color="green">Primary</Tag> : '—'),
    },
  ]

  const usageColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    {
      title: 'Taken',
      key: 'taken',
      render: (_: unknown, r: TubeUsageLog) => `${r.quantity_taken} ${r.unit}`,
    },
    {
      title: 'Breakdown',
      key: 'breakdown',
      render: (_: unknown, r: TubeUsageLog) => {
        if (!r.breakdown || r.breakdown.length === 0) return '—'
        return (
          <Space size={4} wrap>
            {r.breakdown.map((item, i) => (
              <Tag key={i}>{item.label}: {item.count}</Tag>
            ))}
          </Space>
        )
      },
    },
    { title: 'Purpose', dataIndex: 'purpose', key: 'purpose', render: (v: string) => v || '—' },
    {
      title: 'By',
      key: 'by',
      render: (_: unknown, r: TubeUsageLog) => r.taken_by?.full_name || '—',
    },
    {
      title: 'Mol. Ref',
      dataIndex: 'molecular_ref',
      key: 'molecular_ref',
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '—',
    },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true, render: (v: string) => v || '—' },
    ...(user?.is_admin ? [{
      title: '',
      key: 'actions',
      render: (_: unknown, r: TubeUsageLog) => (
        <Popconfirm
          title="Delete this usage entry? This will restore the quantity."
          onConfirm={() =>
            deleteUsage.mutateAsync(r.id)
              .then(() => message.success('Entry deleted'))
              .catch(() => message.error('Failed to delete entry'))
          }
        >
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      ),
    }] : []),
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          {specimen.specimen_code}
        </Typography.Title>
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => downloadLabel(specimenId, 'zpl')}
          >
            ZPL Label
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => downloadLabel(specimenId, 'csv')}
          >
            CSV Label
          </Button>
          <Button
            icon={<ExperimentOutlined />}
            onClick={openUsageModal}
          >
            Record Usage
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/specimens/${specimenId}/edit`)}
          >
            Edit
          </Button>
          {user?.is_admin && (
            <Popconfirm
              title="Delete this tube?"
              description="This action cannot be undone."
              onConfirm={handleDelete}
            >
              <Button icon={<DeleteOutlined />} danger>
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Tube Code">
            <strong>{specimen.specimen_code}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Project">
            {specimen.project?.name}{' '}
            <Tag color="green">{specimen.project?.code}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Sample Type">
            {specimen.sample_type ? <Tag>{specimen.sample_type.name}</Tag> : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Quantity">
            {hasQuantity ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <span>
                  <strong>{remaining}</strong> / {total} {specimen.quantity_unit}
                </span>
                <Progress
                  percent={pct}
                  size="small"
                  status={progressStatus}
                  style={{ maxWidth: 200 }}
                />
              </Space>
            ) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Collection Date">
            {specimen.collection_date || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Collector">
            {specimen.collector?.full_name || specimen.collector_name || <em style={{ color: '#999' }}>Unknown</em>}
          </Descriptions.Item>
          <Descriptions.Item label="Entered by">
            {specimen.entered_by?.full_name || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Site">
            {specimen.site ? (
              <span>
                <strong>{specimen.site.name}</strong>
                {specimen.site.habitat_type && (
                  <Tag style={{ marginLeft: 8 }}>{specimen.site.habitat_type}</Tag>
                )}
              </span>
            ) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Location">
            {specimen.collection_location_text || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Coordinates">
            {specimen.collection_lat != null
              ? `${specimen.collection_lat}, ${specimen.collection_lon}`
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Storage">
            {specimen.storage_location || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Primary Species">
            {primarySpecies ? (
              <Tag color={CONFIDENCE_COLORS[primarySpecies.confidence]}>
                <em>
                  {primarySpecies.species?.scientific_name ||
                    primarySpecies.free_text_species}
                </em>
              </Tag>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Notes" span={2}>
            {specimen.notes || '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Typography.Title level={4}>Species Associations</Typography.Title>
      <Table
        dataSource={specimen.species_associations}
        columns={speciesColumns}
        rowKey="id"
        pagination={false}
        style={{ marginBottom: 24 }}
      />

      <Typography.Title level={4}>Usage Log</Typography.Title>
      <Table
        dataSource={usageLog || []}
        columns={usageColumns}
        rowKey="id"
        pagination={false}
        locale={{ emptyText: 'No usage recorded yet' }}
      />

      <Modal
        title="Record Usage"
        open={usageModalOpen}
        onCancel={() => { setUsageModalOpen(false); setBreakdownCounts({}) }}
        footer={null}
      >
        <Form form={usageForm} layout="vertical" onFinish={handleRecordUsage}>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}
            initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          {hasAssociations ? (
            <>
              <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, marginTop: 0 }}>
                Specimens removed by group
              </Divider>
              {countedAssociations.map((a, i) => {
                const lifeStageSex = [a.life_stage, a.sex].filter(Boolean).join(' ')
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>
                        <em>{a.species?.scientific_name || a.free_text_species}</em>
                      </div>
                      <div style={{ fontSize: 12, color: '#555', marginTop: 1 }}>
                        {lifeStageSex || <span style={{ color: '#aaa' }}>No life stage / sex recorded</span>}
                      </div>
                    </div>
                    <span style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                      of {a.specimen_count}
                    </span>
                    <InputNumber
                      min={0}
                      max={a.specimen_count ?? undefined}
                      precision={0}
                      placeholder="0"
                      style={{ width: 80 }}
                      value={breakdownCounts[i] || undefined}
                      onChange={(v) =>
                        setBreakdownCounts((prev) => ({ ...prev, [i]: v ?? 0 }))
                      }
                    />
                  </div>
                )
              })}
              <div style={{ textAlign: 'right', marginBottom: 12, color: '#555', fontSize: 13 }}>
                Total: <strong>{breakdownTotal}</strong> {usageForm.getFieldValue('unit') || ''}
              </div>
            </>
          ) : (
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="quantity_taken" label="Quantity Taken" rules={[{ required: true }]}
                style={{ width: '60%', marginRight: 8 }}>
                <InputNumber style={{ width: '100%' }} min={0.001} step={1} placeholder="e.g. 3" />
              </Form.Item>
              <Form.Item name="unit" label="Unit" rules={[{ required: true }]} style={{ width: '40%' }}>
                <Input placeholder="specimens / mL / mg" />
              </Form.Item>
            </Space.Compact>
          )}

          {hasAssociations && (
            <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
              <Input placeholder="specimens / mL / mg" />
            </Form.Item>
          )}

          <Form.Item name="purpose" label="Purpose">
            <Input placeholder="e.g. DNA extraction, morphology voucher" />
          </Form.Item>
          <Form.Item name="molecular_ref" label="Tessera Molecular Ref">
            <Input placeholder="Future link to Tessera Molecular job ID" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={recordUsage.isPending}>
                Record
              </Button>
              <Button onClick={() => { setUsageModalOpen(false); setBreakdownCounts({}) }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
