import { useState } from 'react'
import { Typography, Card, Steps, Tag, Divider, Table, Space, Input } from 'antd'
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

function matches(text: string, query: string): boolean {
  if (!query.trim()) return true
  return text.toLowerCase().includes(query.toLowerCase().trim())
}

export default function HelpPage() {
  const [query, setQuery] = useState('')

  const groups = [
    {
      sections: [
        {
          key: 'projects',
          searchText: 'set up project project code AMPH2024 create add members access control collections projects sidebar tube codes sequence numbering how do i start',
          node: (
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
                  { title: 'Go to Projects', description: 'Click Projects in the sidebar (under Collections).' },
                  { title: 'Create a project', description: 'Click Add Project, enter a short code (e.g. AMPH2024) and a name.' },
                  { title: 'Add members', description: 'Use the Members button next to a project to add users. Members are used for access control on protected projects.' },
                ]}
              />
            </Card>
          ),
        },
        {
          key: 'sites',
          searchText: 'add collection sites locations GPS suburb city region state precision coordinates habitat fieldwork map pin geographic latitude longitude location where collected',
          node: (
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
                  { title: 'Go to Sites', description: 'Click Sites in the sidebar (under Reference).' },
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
          ),
        },
        {
          key: 'tubes',
          searchText: 'record tubes specimen sample collection date collector site storage location quantity species associations life stage sex confidence new tube create add how to add a specimen vial container tissue preservation method status host organism additional projects location notes geo_loc_name active depleted loaned vouchered destroyed ethanol rnalater frozen',
          node: (
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
                  { title: 'Go to Tubes', description: 'Click Tubes in the sidebar (under Collections), then + New Tube.' },
                  { title: 'Select a project', description: 'The tube code is assigned automatically from the project sequence.' },
                  { title: 'Fill in metadata', description: 'Collection date, collector, site, sample type, storage location, and quantity.' },
                  {
                    title: 'Preservation & status',
                    description: 'Set Preservation Method (Ethanol, RNAlater, Frozen -20°C/-80°C, Dried, Formalin, Other) and Status (Active, Depleted, Loaned, Vouchered, Destroyed).',
                  },
                  {
                    title: 'Host organism',
                    description: 'Optionally record the organism this specimen was collected from or associated with (e.g. Quercus robur).',
                  },
                  {
                    title: 'Additional projects',
                    description: 'Tag the tube to one or more extra projects beyond its primary project — useful when a specimen is shared across multiple collections.',
                  },
                  {
                    title: 'Location notes',
                    description: 'Add free-text sub-locality detail below the site level (e.g. "200m north of car park"). Corresponds to the MIxS geo_loc_name field.',
                  },
                  {
                    title: 'Add species associations',
                    description: 'Search the species list or type free text. Record count, life stage, sex, and confidence per association. A tube can have multiple species.',
                  },
                  { title: 'Save', description: 'The tube is now searchable and ready to manage.' },
                ]}
              />
            </Card>
          ),
        },
        {
          key: 'usage',
          searchText: 'record sample usage extraction subsampling quantity taken purpose usage log non-destructive transfer destination tube copy metadata aliquot consume deplete how much sample left volume',
          node: (
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
          ),
        },
      ],
    },
    {
      header: (
        <>
          <Divider />
          <Title level={4}>Other features</Title>
        </>
      ),
      sections: [
        {
          key: 'labels',
          searchText: 'label printing eppendorf cap side falcon bottle ZPL zebra CSV dymo brady thermal print template bulk barcode sticker how to print a label',
          node: (
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
          ),
        },
        {
          key: 'explore',
          searchText: 'explore map timeline georeferenced specimens interactive confidence colour marker satellite basemap layers street view geography location visualization where are my samples',
          node: (
            <Card style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginTop: 0 }}>
                <CompassOutlined style={{ marginRight: 8 }} />
                Explore (map + timeline)
              </Title>
              <Paragraph style={{ marginBottom: 0 }}>
                The Explore page shows all georeferenced specimens on an interactive map. Marker colour indicates identification confidence; circle radius is scaled to location precision. Switch between Street and Satellite basemaps using the layers control.
              </Paragraph>
            </Card>
          ),
        },
        {
          key: 'dashboard',
          searchText: 'dashboard summary collection customise widgets reorder preferences drag overview statistics charts home page',
          node: (
            <Card style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginTop: 0 }}>
                <DashboardOutlined style={{ marginRight: 8 }} />
                Dashboard
              </Title>
              <Paragraph style={{ marginBottom: 0 }}>
                The dashboard shows a summary of your collection. Click <Text strong>Customise</Text> (top right) to choose which widgets to display and drag to reorder them. Preferences are saved per user.
              </Paragraph>
            </Card>
          ),
        },
        {
          key: 'species',
          searchText: 'species list add import bulk CSV upload admin taxonomy genus family order manage species reference create scientific name',
          node: (
            <Card style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginTop: 0 }}>
                <ExperimentOutlined style={{ marginRight: 8 }} />
                Species list & bulk import
              </Title>
              <Paragraph style={{ marginBottom: 0 }}>
                Go to <Text strong>Species</Text> in the sidebar (under Reference) to view and manage the species reference list. Each species entry can store genus, family, and order for taxonomic filtering. Admins can bulk-import species from a CSV file — click <Text strong>Import CSV</Text> on the Species page and upload a file with a <Text code>scientific_name</Text> column (genus, family, and order columns are optional).
              </Paragraph>
            </Card>
          ),
        },
        {
          key: 'export',
          searchText: 'export backup restore CSV download specimen data project collector species manage database how to download my data save',
          node: (
            <Card style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginTop: 0 }}>
                <ExportOutlined style={{ marginRight: 8 }} />
                Export & backup
              </Title>
              <Paragraph style={{ marginBottom: 0 }}>
                Go to <Text strong>Export</Text> in the sidebar (under Manage) to download specimen data as a CSV (filterable by project, collector, or species). Admins can also download a full database backup or restore from a previous backup.
              </Paragraph>
            </Card>
          ),
        },
        {
          key: 'protected',
          searchText: 'protected projects lock access control members admin hidden restricted visibility site restrict access grant confidential private',
          node: (
            <Card style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginTop: 0 }}>
                <LockOutlined style={{ marginRight: 8 }} />
                Protected projects
              </Title>
              <Paragraph style={{ marginBottom: 0 }}>
                Admins can mark a project as <Text strong>Protected</Text> from the Projects page (under Collections) using the lock toggle in the project's edit form. Protected projects require an explicit per-user access grant — users without access see only tube codes; all other fields are hidden. Sites tagged exclusively to protected projects are also hidden from unauthorised users. Use the Members button on the Projects page to add or remove access.
              </Paragraph>
            </Card>
          ),
        },
      ],
    },
    {
      header: (
        <>
          <Divider />
          <Title level={4}>Permissions</Title>
        </>
      ),
      sections: [
        {
          key: 'permissions',
          searchText: 'permissions user admin role view search tubes create edit sites set custom codes move delete manage users species bulk import backup restore protected access what can i do',
          node: (
            <Table
              dataSource={permissionsData}
              columns={permColumns}
              rowKey="action"
              size="small"
              pagination={false}
              style={{ marginBottom: 24 }}
            />
          ),
        },
      ],
    },
    {
      header: (
        <>
          <Divider />
          <Title level={4}>Tips</Title>
        </>
      ),
      sections: [
        {
          key: 'tips',
          searchText: 'tips tube code open click search bar species collector storage location notes site dropdown project filtered excel LibreOffice dates bulk import CSV backup update quick shortcuts status preservation host organism additional projects',
          node: (
            <ul>
              <li>Click any tube code anywhere in the app to open its detail page.</li>
              <li>Use the search bar on the Tubes page to search by code, species, collector, storage location, or notes.</li>
              <li>The site dropdown on the tube form is filtered to show only sites tagged to the selected project (plus untagged sites).</li>
              <li>Use the Status field to track a tube's lifecycle: Active → Depleted / Loaned / Vouchered / Destroyed.</li>
              <li>Tag tubes to additional projects when a specimen is relevant to more than one collection — it will appear in exports for all tagged projects.</li>
              <li>
                Don't open bulk import CSVs in Excel — it corrupts dates and special characters. Use LibreOffice Calc or a plain text editor.
              </li>
              <li>Export a CSV backup before any bulk import or server update.</li>
            </ul>
          ),
        },
      ],
    },
  ]

  const hasResults = groups.some(g => g.sections.some(s => matches(s.searchText, query)))

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <Title level={3}>Quick Start Guide</Title>
      <Paragraph type="secondary">
        Everything you need to start recording and tracking specimens in Tessera.
      </Paragraph>

      <Input.Search
        placeholder="Search help topics…"
        allowClear
        onChange={e => setQuery(e.target.value)}
        style={{ marginBottom: 24 }}
      />

      {!hasResults && (
        <Paragraph type="secondary" style={{ textAlign: 'center', paddingTop: 16 }}>
          No results for "<Text>{query}</Text>"
        </Paragraph>
      )}

      {groups.map((group, gi) => {
        const visible = group.sections.filter(s => matches(s.searchText, query))
        if (visible.length === 0) return null
        return (
          <div key={gi}>
            {group.header}
            {visible.map(s => (
              <div key={s.key}>{s.node}</div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
