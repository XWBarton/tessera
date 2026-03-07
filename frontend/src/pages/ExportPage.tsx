import { useState } from 'react'
import { Button, Card, Select, Typography, Space, message, Divider, Modal, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { DownloadOutlined, DatabaseOutlined, UploadOutlined } from '@ant-design/icons'
import { useProjects } from '../hooks/useProjects'
import { useUsers } from '../hooks/useUsers'
import { useSpecies } from '../hooks/useSpecies'
import { useAuth } from '../context/AuthContext'
import {
  exportSpecimens,
  exportByProject,
  exportByCollector,
  exportBySpecies,
  downloadBackup,
  restoreBackup,
} from '../api/export'

export default function ExportPage() {
  const { user } = useAuth()
  const { data: projects } = useProjects()
  const { data: users } = useUsers()
  const { data: species } = useSpecies()
  const [selectedProject, setSelectedProject] = useState<number>()
  const [selectedCollector, setSelectedCollector] = useState<number>()
  const [selectedSpecies, setSelectedSpecies] = useState<number>()
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

      <Card title="Export by Project" style={{ marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 300 }}
            placeholder="Select project"
            allowClear
            options={projects?.map((p) => ({
              value: p.id,
              label: `${p.code} — ${p.name}`,
            }))}
            onChange={setSelectedProject}
          />
          <Button
            icon={<DownloadOutlined />}
            disabled={!selectedProject}
            loading={loading}
            onClick={() =>
              selectedProject && handle(() => exportByProject(selectedProject))
            }
          >
            Export
          </Button>
        </Space>
      </Card>

      <Card title="Export by Collector" style={{ marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 300 }}
            placeholder="Select collector"
            allowClear
            options={users?.map((u) => ({ value: u.id, label: u.full_name }))}
            onChange={setSelectedCollector}
          />
          <Button
            icon={<DownloadOutlined />}
            disabled={!selectedCollector}
            loading={loading}
            onClick={() =>
              selectedCollector &&
              handle(() => exportByCollector(selectedCollector))
            }
          >
            Export
          </Button>
        </Space>
      </Card>

      <Card title="Export by Species">
        <Space>
          <Select
            style={{ width: 300 }}
            placeholder="Select species"
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
            onChange={setSelectedSpecies}
          />
          <Button
            icon={<DownloadOutlined />}
            disabled={!selectedSpecies}
            loading={loading}
            onClick={() =>
              selectedSpecies && handle(() => exportBySpecies(selectedSpecies))
            }
          >
            Export
          </Button>
        </Space>
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
