import { useState } from 'react'
import { Button, Card, Select, Typography, Space, message, Divider } from 'antd'
import { DownloadOutlined, DatabaseOutlined } from '@ant-design/icons'
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
          <Card title="Database Backup" style={{ borderColor: '#faad14' }}>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Downloads the full SQLite database file. Use this to back up all data before updates.
            </Typography.Text>
            <Button
              icon={<DatabaseOutlined />}
              loading={loading}
              onClick={() => handle(() => downloadBackup())}
            >
              Download Backup (.db)
            </Button>
          </Card>
        </>
      )}
    </div>
  )
}
