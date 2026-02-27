import { useState, useEffect } from 'react'
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
  Image,
  Upload,
} from 'antd'
import { EditOutlined, DeleteOutlined, DownloadOutlined, ExperimentOutlined, CameraOutlined, PlusOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Dropdown } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useSpecimen, useDeleteSpecimen, useUpdateSpecimen } from '../hooks/useSpecimens'
import { useTubeUsage, useRecordUsage, useDeleteUsageEntry } from '../hooks/useTubeUsage'
import { downloadLabel, ZPL_TEMPLATE_OPTIONS, getPhotos, uploadPhoto, deletePhoto, getPhotoBlob } from '../api/specimens'
import type { ZplTemplate } from '../api/specimens'
import { useAuth } from '../context/AuthContext'
import type { SpecimenSpecies, TubeUsageLog, SpecimenPhoto } from '../types'

/** Loads a single photo file as a blob URL (authenticated). */
function PhotoThumbnail({
  specimenId,
  photo,
  onDelete,
  canDelete,
}: {
  specimenId: number
  photo: SpecimenPhoto
  onDelete: () => void
  canDelete: boolean
}) {
  const [blobUrl, setBlobUrl] = useState<string>()
  useEffect(() => {
    let url: string
    getPhotoBlob(specimenId, photo.id).then((u) => { url = u; setBlobUrl(u) })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [specimenId, photo.id])

  if (!blobUrl) return (
    <div style={{ width: 120, height: 120, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="small" />
    </div>
  )

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Image
        src={blobUrl}
        width={120}
        height={120}
        style={{ objectFit: 'cover', borderRadius: 4 }}
        preview={{ src: blobUrl }}
        title={photo.caption || photo.original_filename}
      />
      {canDelete && (
        <Popconfirm title="Delete this photo?" onConfirm={onDelete} okButtonProps={{ danger: true }}>
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            style={{ position: 'absolute', top: 4, right: 4, opacity: 0.85 }}
          />
        </Popconfirm>
      )}
      {photo.caption && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 2, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {photo.caption}
        </div>
      )}
    </div>
  )
}

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
  const queryClient = useQueryClient()
  const updateSpecimen = useUpdateSpecimen(specimenId)
  const [usageModalOpen, setUsageModalOpen] = useState(false)
  const [usageForm] = Form.useForm()
  // breakdown counts keyed by association index
  const [breakdownCounts, setBreakdownCounts] = useState<Record<number, number>>({})
  const [codeModalOpen, setCodeModalOpen] = useState(false)
  const [newCode, setNewCode] = useState('')

  // Photos
  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['photos', specimenId],
    queryFn: () => getPhotos(specimenId),
  })
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)

  const handlePhotoUpload = async () => {
    if (!pendingFile) return
    setPhotoUploading(true)
    try {
      await uploadPhoto(specimenId, pendingFile, photoCaption || undefined)
      message.success('Photo uploaded')
      setPendingFile(null)
      setPhotoCaption('')
      setPhotoModalOpen(false)
      refetchPhotos()
      queryClient.invalidateQueries({ queryKey: ['photos', specimenId] })
    } catch {
      message.error('Upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handlePhotoDelete = async (photo: SpecimenPhoto) => {
    try {
      await deletePhoto(specimenId, photo.id)
      message.success('Photo deleted')
      refetchPhotos()
      queryClient.invalidateQueries({ queryKey: ['photos', specimenId] })
    } catch {
      message.error('Failed to delete photo')
    }
  }

  if (isLoading) return <Spin />
  if (!specimen) return <Typography.Text>Tube not found</Typography.Text>

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

  const handleCodeChange = async () => {
    const trimmed = newCode.trim()
    if (!trimmed) return
    try {
      await updateSpecimen.mutateAsync({ specimen_code: trimmed })
      message.success('Code updated')
      setCodeModalOpen(false)
    } catch {
      message.error('Failed to update code — it may already exist')
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
          {user?.is_admin && (
            <Button
              icon={<EditOutlined />}
              type="text"
              size="small"
              style={{ marginLeft: 6, verticalAlign: 'middle', color: '#aaa' }}
              title="Change tube code"
              onClick={() => { setNewCode(specimen.specimen_code); setCodeModalOpen(true) }}
            />
          )}
        </Typography.Title>
        <Space>
          <Dropdown
            menu={{
              items: ZPL_TEMPLATE_OPTIONS.map((t) => ({
                key: t.value,
                label: (
                  <span>
                    <strong>{t.label}</strong>
                    <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>{t.description}</span>
                  </span>
                ),
                onClick: () => downloadLabel(specimenId, 'zpl', t.value as ZplTemplate),
              })) satisfies MenuProps['items'],
            }}
          >
            <Button icon={<DownloadOutlined />}>ZPL Label ▾</Button>
          </Dropdown>
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
            {specimen.collection_date
              ? specimen.collection_date_end && specimen.collection_date_end !== specimen.collection_date
                ? `${specimen.collection_date} – ${specimen.collection_date_end}`
                : specimen.collection_date
              : '—'}
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
          <Descriptions.Item label="Species">
            {specimen.species_associations.length === 0 ? '—' : (
              <Space size={4} wrap>
                {specimen.species_associations.map((a) => (
                  <Tag key={a.id} color={CONFIDENCE_COLORS[a.confidence]}>
                    <em>{a.species?.scientific_name || a.free_text_species}</em>
                  </Tag>
                ))}
              </Space>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Photos</Typography.Title>
        <Button icon={<CameraOutlined />} onClick={() => setPhotoModalOpen(true)}>
          Add Photo
        </Button>
      </div>
      <Card>
        {photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa' }}>
            <CameraOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
            No photos yet — click Add Photo to upload one.
          </div>
        ) : (
          <Image.PreviewGroup>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {photos.map((photo) => (
                <PhotoThumbnail
                  key={photo.id}
                  specimenId={specimenId}
                  photo={photo}
                  canDelete={photo.uploaded_by_id === user?.id || !!user?.is_admin}
                  onDelete={() => handlePhotoDelete(photo)}
                />
              ))}
            </div>
          </Image.PreviewGroup>
        )}
      </Card>

      {/* Upload photo modal */}
      <Modal
        title="Add Photo"
        open={photoModalOpen}
        onCancel={() => { setPhotoModalOpen(false); setPendingFile(null); setPhotoCaption('') }}
        footer={[
          <Button key="cancel" onClick={() => { setPhotoModalOpen(false); setPendingFile(null); setPhotoCaption('') }}>
            Cancel
          </Button>,
          <Button key="upload" type="primary" loading={photoUploading} disabled={!pendingFile} onClick={handlePhotoUpload}>
            Upload
          </Button>,
        ]}
      >
        <Upload.Dragger
          accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.tiff,.tif"
          maxCount={1}
          beforeUpload={(file) => { setPendingFile(file); return false }}
          onRemove={() => setPendingFile(null)}
          fileList={pendingFile ? [{ uid: '-1', name: pendingFile.name, status: 'done' }] : []}
          style={{ marginBottom: 16 }}
        >
          <p className="ant-upload-drag-icon"><PlusOutlined /></p>
          <p className="ant-upload-text">Click or drag a photo here</p>
          <p className="ant-upload-hint">JPEG, PNG, HEIC, TIFF, WebP · max 50 MB</p>
        </Upload.Dragger>
        <Input
          placeholder="Caption (optional)"
          value={photoCaption}
          onChange={(e) => setPhotoCaption(e.target.value)}
        />
      </Modal>

      <Modal
        title="Change Tube Code"
        open={codeModalOpen}
        onCancel={() => setCodeModalOpen(false)}
        onOk={handleCodeChange}
        okText="Save"
        confirmLoading={updateSpecimen.isPending}
      >
        <Input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          onPressEnter={handleCodeChange}
          placeholder="New tube code"
          style={{ marginTop: 8 }}
        />
      </Modal>

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
