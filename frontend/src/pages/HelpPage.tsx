import { Typography, Card, Steps, Tag, Divider, Table, Space } from 'antd'
import {
  ExperimentOutlined,
  PushpinOutlined,
  ProjectOutlined,
  PrinterOutlined,
  ExportOutlined,
  DashboardOutlined,
  CompassOutlined,
  LockOutlined,
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

const permissionsData = [
  { action: 'View and search tubes', user: '✓', admin: '✓' },
  { action: 'Create and edit tubes', user: '✓', admin: '✓' },
  { action: 'Add and edit sites', user: '✓', admin: '✓' },
  { action: 'Set custom tube codes', user: '', admin: '✓' },
  { action: 'Move tubes between projects', user: '', admin: '✓' },
  { action: 'Delete tubes / sites / projects', user: '', admin: '✓' },
  { action: 'Create and edit projects', user: '', admin: '✓' },
  { action: 'Manage users and species lists', user: '', admin: '✓' },
  { action: 'Bulk import', user: '', admin: '✓' },
  { action: 'Backup / restore database', user: '', admin: '✓' },
  { action: 'Manage protected project access', user: '', admin: '✓' },
]

const permColumns = [
  { title: 'Action', dataIndex: 'action', key: 'action' },
  { title: 'User', dataIndex: 'user', key: 'user', width: 80, align: 'center' as const },
  { title: 'Admin', dataIndex: 'admin', key: 'admin', width: 80, align: 'center' as const },
]

export default function HelpPage() {
  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <Title level={3}>Quick Start Guide</Title>
      <Paragraph type="secondary">
        Everything you need to start recording and tracking specimens in Tessera.
      </Paragraph>

      {/* ── 1. Core workflow ─────────────────────────────────────────── */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          <ProjectOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          1 — Set up a project
        </Title>
        <Paragraph>
          Every tube belongs to a project. Projects give tubes their codes — a project with code{' '}
          <Text code>AMPH2024</Text> will produce tubes <Text code>AMPH2024-001</Text>,{' '}
          <Text code>AMPH2024-002</Text>, etc.
        </Paragraph>
        <Steps
          direction="vertical"
          size="small"
          items={[
            { title: 'Go to Projects', description: 'Click Projects in the sidebar.' },
            { title: 'Create a project', description: 'Click Add Project, enter a short code (e.g. AMPH2024) and a name.' },
          ]}
        />
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          <PushpinOutlined style={{ marginRight: 8, color: '#52c41a' }} />
          2 — Add collection sites
        </Title>
        <Paragraph>
          Sites represent the physical locations where specimens were collected. You can add them before fieldwork or on the fly when recording tubes.
        </Paragraph>
        <Steps
          direction="vertical"
          size="small"
          items={[
            { title: 'Go to Sites', description: 'Click Sites in the sidebar.' },
            { title: 'Add a site', description: 'Enter a name, optional coordinates, habitat type, and tag it to one or more projects.' },
            {
              title: 'Precision levels',
              description: (
                <Space wrap size={4}>
                  <Tag color="green">GPS</Tag> exact point —
                  <Tag color="blue">Suburb</Tag> 1.5 km radius —
                  <Tag color="orange">City</Tag> 8 km —
                  <Tag color="volcano">Region</Tag> 50 km —
                  <Tag color="red">State</Tag> 150 km
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          <ExperimentOutlined style={{ marginRight: 8, color: '#722ed1' }} />
          3 — Record tubes
        </Title>
        <Paragraph>
          Tubes are the core record in Tessera — one row per physical tube or container.
        </Paragraph>
        <Steps
          direction="vertical"
          size="small"
          items={[
            { title: 'Go to Tubes', description: 'Click Tubes in the sidebar, then + New Tube.' },
            { title: 'Select a project', description: 'The tube code is assigned automatically from the project sequence.' },
            { title: 'Fill in metadata', description: 'Collection date, collector, site, sample type, storage location, and quantity.' },
            {
              title: 'Add species associations',
              description: 'Search the species list or type free text. Record count, life stage, sex, and confidence per association. A tube can have multiple species.',
            },
            { title: 'Save', description: 'The tube is now searchable and ready to manage.' },
          ]}
        />
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          <ExperimentOutlined style={{ marginRight: 8, color: '#eb2f96' }} />
          4 — Record sample usage
        </Title>
        <Paragraph>
          When sample is taken from a tube (for extraction, subsampling, etc.), record a usage event to keep the quantity up to date.
        </Paragraph>
        <Steps
          direction="vertical"
          size="small"
          items={[
            { title: 'Open a tube', description: 'Click the tube code from the Tubes list.' },
            { title: 'Usage Log tab', description: 'Click Record Usage. Enter the quantity taken, purpose, and date.' },
            {
              title: 'Non-destructive transfer',
              description: 'Tick "Non-destructive transfer" and enter a destination tube code to automatically copy metadata and species to the new tube.',
            },
          ]}
        />
      </Card>

      {/* ── 2. Other features ────────────────────────────────────────── */}
      <Divider />
      <Title level={4}>Other features</Title>

      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          <PrinterOutlined style={{ marginRight: 8 }} />
          Label printing
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>
          Open any tube and click <Text strong>Print Label</Text>. Choose a template to match your tube type:
        </Paragraph>
        <ul style={{ marginTop: 8 }}>
          <li><Text strong>Eppendorf Cap</Text> — small circular cap label (0.5 × 0.5")</li>
          <li><Text strong>Eppendorf Side</Text> — side strip label (1.75 × 0.5")</li>
          <li><Text strong>Eppendorf Combo</Text> — cap + side in one print</li>
          <li><Text strong>Falcon</Text> — 20 mL / 50 mL tube label (2 × 0.875")</li>
          <li><Text strong>Bottle</Text> — larger container label (3 × 2")</li>
        </ul>
        <Paragraph style={{ marginBottom: 0 }}>
          Download as <Text strong>ZPL</Text> for Zebra thermal printers, or <Text strong>CSV</Text> for Dymo / Brady software. Bulk labels can be downloaded from the Tubes list after selecting multiple rows.
        </Paragraph>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          <CompassOutlined style={{ marginRight: 8 }} />
          Explore (map + timeline)
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>
          The Explore page shows all georeferenced specimens on an interactive map. Marker colour indicates identification confidence; circle radius is scaled to location precision. Switch between Street and Satellite basemaps using the layers control.
        </Paragraph>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          <DashboardOutlined style={{ marginRight: 8 }} />
          Dashboard
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>
          The dashboard shows a summary of your collection. Click <Text strong>Customise</Text> (top right) to choose which widgets to display and drag to reorder them. Preferences are saved per user.
        </Paragraph>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          <ExportOutlined style={{ marginRight: 8 }} />
          Export & backup
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>
          Go to <Text strong>Export</Text> in the sidebar to download specimen data as a CSV (filterable by project, collector, or species). Admins can also download a full database backup or restore from a previous backup.
        </Paragraph>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          <LockOutlined style={{ marginRight: 8 }} />
          Protected projects
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>
          Admins can mark a project as <Text strong>Protected</Text> in Settings → Projects. Protected projects require an explicit per-user access grant — users without access see only tube codes; all other fields are hidden. Sites tagged exclusively to protected projects are also hidden from unauthorised users.
        </Paragraph>
      </Card>

      {/* ── 3. Permissions ───────────────────────────────────────────── */}
      <Divider />
      <Title level={4}>Permissions</Title>
      <Table
        dataSource={permissionsData}
        columns={permColumns}
        rowKey="action"
        size="small"
        pagination={false}
        style={{ marginBottom: 24 }}
      />

      {/* ── 4. Tips ──────────────────────────────────────────────────── */}
      <Divider />
      <Title level={4}>Tips</Title>
      <ul>
        <li>Click any tube code anywhere in the app to open its detail page.</li>
        <li>Use the search bar on the Tubes page to search by code, species, collector, storage location, or notes.</li>
        <li>The site dropdown on the tube form is filtered to show only sites tagged to the selected project (plus untagged sites).</li>
        <li>
          Don't open bulk import CSVs in Excel — it corrupts dates and special characters. Use LibreOffice Calc or a plain text editor.
        </li>
        <li>Export a CSV backup before any bulk import or server update.</li>
      </ul>
    </div>
  )
}
