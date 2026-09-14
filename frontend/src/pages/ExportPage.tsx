import { useState } from 'react'
import {
  Button,
  Card,
  Select,
  Input,
  DatePicker,
  Typography,
  Space,
  Row,
  Col,
  Form,
  message,
  Divider,
  Modal,
  Upload,
} from 'antd'
import type { UploadFile } from 'antd'
import { DownloadOutlined, DatabaseOutlined, UploadOutlined, ClearOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useProjects } from '../hooks/useProjects'
import { useUsers } from '../hooks/useUsers'
import { useSpecies } from '../hooks/useSpecies'
import { useSites } from '../hooks/useSites'
import { useLookupOptions } from '../hooks/useLookups'
import { useAuth } from '../context/AuthContext'
import { exportSpecimens, downloadBackup, restoreBackup } from '../api/export'

const CONFIDENCE_OPTIONS = ['Confirmed', 'Probable', 'Possible', 'Unknown'].map((v) => ({
  value: v,
  label: v,
}))

export default function ExportPage() {
  const { user } = useAuth()
  const [form] = Form.useForm()
  const { data: projects } = useProjects()
  const { data: users } = useUsers()
  const { data: species } = useSpecies()
  const { data: sites } = useSites()
  const { data: lifeStageOpts } = useLookupOptions('life_stage')
  const { data: sexOpts } = useLookupOptions('sex')
  const [loading, setLoading] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreFileList, setRestoreFileList] = useState<UploadFile[]>([])
  const [restoreLoading, setRestoreLoading] = useState(false)

  const handleRestore = () => {
    if (!restoreFile) return
    Modal.confirm({
      title: 'Restore Database?',
      content: (
        <span>
          This will permanently replace <strong>all current data</strong> with the contents of{' '}
          <strong>{restoreFile.name}</strong>. This cannot be undone.
        </span>
      ),
      okText: 'Yes, Restore',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setRestoreLoading(true)
        try {
          await restoreBackup(restoreFile)
          message.success('Database restored successfully. Please refresh the page.')
          setRestoreFile(null)
          setRestoreFileList([])
        } catch {
          message.error('Restore failed. Make sure the file is a valid Tessera backup.')
        } finally {
          setRestoreLoading(false)
        }
      },
    })
  }

  const handle = async (fn: () => Promise<void>) => {
    setLoading(true)
    try {
      await fn()
      message.success('Export downloaded')
    } catch {
      message.error('Export failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFilteredExport = (values: Record<string, unknown>) => {
    const dateRange = values.date_range as [dayjs.Dayjs, dayjs.Dayjs] | null
    const params = {
      search: (values.search as string) || undefined,
      project_id: values.project_id as number | undefined,
      collector_id: values.collector_id as number | undefined,
      species_id: values.species_id as number | undefined,
      site_id: values.site_id as number | undefined,
      confidence: values.confidence as string | undefined,
      life_stage: values.life_stage as string | undefined,
      sex: values.sex as string | undefined,
      date_from: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
      date_to: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
    }
    handle(() => exportSpecimens(params))
  }

  return (
    <div>
      <Typography.Title level={3}>Export Data</Typography.Title>

      <Card title="Full Export — All Tubes" style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Downloads a wide CSV with all tubes and their species associations.
        </Typography.Text>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={loading}
          onClick={() => handle(() => exportSpecimens())}
        >
          Export All Tubes (CSV)
        </Button>
      </Card>

      <Card title="Filtered Export" style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Combine any of the filters below and export only the matching tubes.
        </Typography.Text>
        <Form form={form} onFinish={handleFilteredExport}>
          <Row gutter={[8, 8]}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="search" style={{ marginBottom: 0 }}>
                <Input placeholder="Search code, location, notes..." allowClear />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="project_id" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="Project"
                  allowClear
                  options={projects?.map((p) => ({ value: p.id, label: p.code }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="collector_id" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="Collector"
                  allowClear
                  options={users?.map((u) => ({ value: u.id, label: u.full_name }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="species_id" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="Species"
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={species?.map((s) => ({
                    value: s.id,
                    label: s.scientific_name,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={6}>
              <Form.Item name="site_id" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="Location"
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={sites?.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="confidence" style={{ marginBottom: 0 }}>
                <Select placeholder="Confidence" allowClear options={CONFIDENCE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="life_stage" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="Life Stage"
                  allowClear
                  options={lifeStageOpts?.map((o) => ({ value: o.value, label: o.value }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="sex" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="Sex"
                  allowClear
                  options={sexOpts?.map((o) => ({ value: o.value, label: o.value }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="date_range" style={{ marginBottom: 0 }}>
                <DatePicker.RangePicker
                  style={{ width: '100%' }}
                  placeholder={['Collection from', 'Collection to']}
                />
              </Form.Item>
            </Col>
          </Row>
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" htmlType="submit" icon={<DownloadOutlined />} loading={loading}>
              Export Filtered (CSV)
            </Button>
            <Button icon={<ClearOutlined />} onClick={() => form.resetFields()}>
              Clear
            </Button>
          </Space>
        </Form>
      </Card>

      {user?.is_admin && (
        <>
          <Divider />
          <Card title="Database Backup" style={{ borderColor: '#faad14', marginBottom: 16 }}>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Downloads the full SQLite database file. Use this to back up all data before updates.
            </Typography.Text>
            <Button
              icon={<DatabaseOutlined />}
              loading={loading}
              onClick={() => handle(() => downloadBackup())}
            >
              Download Backup (.zip)
            </Button>
          </Card>
          <Card title="Restore from Backup" style={{ borderColor: '#ff4d4f' }}>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              Upload a <code>.zip</code> backup (includes photos) or a legacy <code>.db</code> backup to restore all data.
            </Typography.Text>
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              Warning: this permanently replaces all current data.
            </Typography.Text>
            <Space>
              <Upload
                accept=".zip,.db"
                maxCount={1}
                fileList={restoreFileList}
                beforeUpload={(file) => {
                  setRestoreFile(file)
                  setRestoreFileList([{ uid: '-1', name: file.name, status: 'done' }])
                  return false
                }}
                onRemove={() => {
                  setRestoreFile(null)
                  setRestoreFileList([])
                }}
              >
                <Button icon={<UploadOutlined />}>Select Backup File</Button>
              </Upload>
              <Button
                danger
                disabled={!restoreFile}
                loading={restoreLoading}
                onClick={handleRestore}
              >
                Restore
              </Button>
            </Space>
          </Card>
        </>
      )}
    </div>
  )
}
