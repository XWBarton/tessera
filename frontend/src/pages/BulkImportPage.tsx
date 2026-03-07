import { useState } from 'react'
import {
  Typography,
  Card,
  Button,
  Table,
  Alert,
  Space,
  Upload,
  message,
  Divider,
  Tabs,
  Tag,
} from 'antd'
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { bulkImportSpecimens } from '../api/specimens'
import { bulkImportSites } from '../api/sites'
import type { SiteBulkImportRow, SiteBulkImportResult } from '../api/sites'
import type { BulkImportRow, BulkImportResult } from '../types'

const TEMPLATE_COLUMNS = [
  'specimen_code',
  'project_code',
  'collection_date',
  'collection_date_end',
  'collector_name',
  'site_name',
  'sample_type_name',
  'quantity_value',
  'quantity_unit',
  'storage_location',
  'notes',
  'species',
]

const TEMPLATE_EXAMPLE = [
  'XPG-001',
  'XPG',
  '2024-03-01',
  '2024-03-05',
  'J. Smith',
  'Wetland A',
  'Specimen',
  '6',
  'specimens',
  'Freezer B2',
  '',
  'Rana temporaria|4|adult|F|Confirmed;Bufo bufo|2|instar 3||Probable',
]

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/)
  const parse = (line: string): string[] => {
    const cols: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur)
    return cols
  }
  const headers = parse(lines[0])
  const rows = lines.slice(1).filter((l) => l.trim()).map(parse)
  return { headers, rows }
}

function rowsToImport(headers: string[], rows: string[][]): BulkImportRow[] {
  return rows.map((cols) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h.trim()] = (cols[i] ?? '').trim() })
    return {
      specimen_code: obj.specimen_code || '',
      project_code: obj.project_code || '',
      collection_date: obj.collection_date || undefined,
      collection_date_end: obj.collection_date_end || undefined,
      collector_name: obj.collector_name || undefined,
      site_name: obj.site_name || undefined,
      sample_type_name: obj.sample_type_name || undefined,
      quantity_value: obj.quantity_value ? parseFloat(obj.quantity_value) : undefined,
      quantity_unit: obj.quantity_unit || undefined,
      storage_location: obj.storage_location || undefined,
      notes: obj.notes || undefined,
      species: obj.species || undefined,
    }
  }).filter((r) => r.specimen_code && r.project_code)
}

const previewColumns = [
  { title: 'Code', dataIndex: 'specimen_code', key: 'specimen_code' },
  { title: 'Project', dataIndex: 'project_code', key: 'project_code' },
  { title: 'Date', dataIndex: 'collection_date', key: 'collection_date', render: (v: string) => v || '—' },
  { title: 'Collector', dataIndex: 'collector_name', key: 'collector_name', render: (v: string) => v || '—' },
  { title: 'Sample Type', dataIndex: 'sample_type_name', key: 'sample_type_name', render: (v: string) => v || '—' },
  { title: 'Qty', key: 'qty', render: (_: unknown, r: BulkImportRow) => r.quantity_value != null ? `${r.quantity_value} ${r.quantity_unit || ''}` : '—' },
  { title: 'Storage', dataIndex: 'storage_location', key: 'storage_location', render: (v: string) => v || '—' },
  {
    title: 'Species',
    dataIndex: 'species',
    key: 'species',
    render: (v: string) => {
      if (!v) return '—'
      const entries = v.split(';').map((e) => e.trim()).filter(Boolean).map((e) => {
        const [name, count, stage, sex, conf] = e.split('|').map((p) => p.trim())
        const parts = [name]
        if (count) parts.push(`×${count}`)
        if (stage) parts.push(stage)
        if (sex) parts.push(sex)
        if (conf && conf !== 'Unknown') parts.push(`(${conf})`)
        return parts.join(' ')
      })
      return entries.join('; ')
    },
  },
]

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '160px 1fr',
  gap: '6px 12px',
  alignItems: 'start',
  fontSize: 13,
  lineHeight: 1.6,
}

// ── Sites bulk import ──────────────────────────────────────────────────────────

const SITE_TEMPLATE_COLUMNS = ['name', 'description', 'habitat_type', 'lat', 'lon', 'precision', 'notes']
const SITE_TEMPLATE_EXAMPLE = ['Wetland A', 'Main wetland site', 'Wetland', '-31.5377', '115.6702', 'GPS', '']
const SITE_PRECISION_VALUES = ['GPS', 'Suburb', 'City', 'Region', 'State']

function rowsToSiteImport(headers: string[], rows: string[][]): SiteBulkImportRow[] {
  return rows.map((cols) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h.trim()] = (cols[i] ?? '').trim() })
    return {
      name: obj.name || '',
      description: obj.description || undefined,
      habitat_type: obj.habitat_type || undefined,
      lat: obj.lat ? parseFloat(obj.lat) : undefined,
      lon: obj.lon ? parseFloat(obj.lon) : undefined,
      precision: obj.precision || undefined,
      notes: obj.notes || undefined,
    }
  }).filter((r) => r.name)
}

const sitePreviewColumns = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Description', dataIndex: 'description', key: 'description', render: (v: string) => v || '—' },
  { title: 'Habitat', dataIndex: 'habitat_type', key: 'habitat_type', render: (v: string) => v ? <Tag>{v}</Tag> : '—' },
  { title: 'Lat', dataIndex: 'lat', key: 'lat', render: (v: number) => v ?? '—' },
  { title: 'Lon', dataIndex: 'lon', key: 'lon', render: (v: number) => v ?? '—' },
  { title: 'Precision', dataIndex: 'precision', key: 'precision', render: (v: string) => v || '—' },
  { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true, render: (v: string) => v || '—' },
]

function SitesBulkImport() {
  const [parsed, setParsed] = useState<SiteBulkImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<SiteBulkImportResult | null>(null)

  const downloadTemplate = () => {
    const header = SITE_TEMPLATE_COLUMNS.join(',')
    const example = SITE_TEMPLATE_EXAMPLE.map((v) => v.includes(',') ? `"${v}"` : v).join(',')
    const blob = new Blob([header + '\n' + example + '\n'], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'site_import_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const { headers, rows } = parseCsv(e.target?.result as string)
        const importRows = rowsToSiteImport(headers, rows)
        if (importRows.length === 0) { message.warning('No valid rows found. Make sure the CSV has a name column.'); return }
        setParsed(importRows)
        setResult(null)
      } catch { message.error('Failed to parse CSV') }
    }
    reader.readAsText(file)
    return false
  }

  const handleImport = async () => {
    if (!parsed.length) return
    setImporting(true)
    try {
      const res = await bulkImportSites(parsed)
      setResult(res)
      if (res.created > 0) message.success(`${res.created} site${res.created !== 1 ? 's' : ''} imported`)
      if (res.errors.length === 0) setParsed([])
    } catch { message.error('Import failed') }
    finally { setImporting(false) }
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Typography.Paragraph style={{ marginBottom: 16 }}>
          Upload a CSV to create multiple sites at once. Rows whose <strong>name</strong> already exists
          are skipped (not updated). Coordinates should be decimal degrees (WGS 84).
        </Typography.Paragraph>

        <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Field reference
        </Divider>
        <div style={fieldStyle}>
          <span style={{ color: '#555', fontWeight: 500 }}>name</span>
          <span><strong>Required.</strong> Must be unique — duplicates are skipped.</span>

          <span style={{ color: '#555', fontWeight: 500 }}>lat / lon</span>
          <span>Decimal degrees, e.g. <code>-31.5377</code> / <code>115.6702</code></span>

          <span style={{ color: '#555', fontWeight: 500 }}>precision</span>
          <span>
            {SITE_PRECISION_VALUES.map((v) => <code key={v} style={{ marginRight: 4 }}>{v}</code>)}
          </span>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>Download Template</Button>
          <Typography.Text type="secondary" style={{ marginLeft: 10, fontSize: 12 }}>Includes a filled example row</Typography.Text>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Upload.Dragger accept=".csv" maxCount={1} beforeUpload={handleFile} showUploadList={false}>
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">Click or drag a CSV file here to preview</p>
        </Upload.Dragger>
      </Card>

      {parsed.length > 0 && (
        <Card
          title={`Preview — ${parsed.length} row${parsed.length !== 1 ? 's' : ''}`}
          style={{ marginBottom: 16 }}
          extra={
            <Button type="primary" loading={importing} onClick={handleImport}>
              Import {parsed.length} Site{parsed.length !== 1 ? 's' : ''}
            </Button>
          }
        >
          <Table dataSource={parsed} columns={sitePreviewColumns} rowKey="name" size="small" pagination={{ pageSize: 20 }} scroll={{ x: true }} />
        </Card>
      )}

      {result && (
        <Card title="Import Results">
          <Alert
            type={result.errors.length === 0 ? 'success' : result.created > 0 ? 'warning' : 'error'}
            message={`${result.created} site${result.created !== 1 ? 's' : ''} created, ${result.skipped} skipped${result.errors.length > 0 ? `, ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}` : ''}`}
            style={{ marginBottom: result.errors.length > 0 ? 12 : 0 }}
          />
          {result.errors.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#cf1322' }}>
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BulkImportPage() {
  const [parsed, setParsed] = useState<BulkImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)

  const downloadTemplate = () => {
    const header = TEMPLATE_COLUMNS.join(',')
    const example = TEMPLATE_EXAMPLE.map((v) => v.includes(',') ? `"${v}"` : v).join(',')
    const csv = header + '\n' + example + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tube_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const { headers, rows } = parseCsv(text)
        const importRows = rowsToImport(headers, rows)
        if (importRows.length === 0) {
          message.warning('No valid rows found. Make sure the CSV has specimen_code and project_code columns.')
          return
        }
        setParsed(importRows)
        setResult(null)
      } catch {
        message.error('Failed to parse CSV')
      }
    }
    reader.readAsText(file)
    return false
  }

  const handleImport = async () => {
    if (parsed.length === 0) return
    setImporting(true)
    try {
      const res = await bulkImportSpecimens(parsed)
      setResult(res)
      if (res.created > 0) {
        message.success(`${res.created} tube${res.created !== 1 ? 's' : ''} imported`)
      }
      if (res.errors.length === 0) {
        setParsed([])
      }
    } catch {
      message.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  const tubeContent = (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Do not open or edit this CSV in Excel"
          description="Excel silently reformats dates, mangles leading zeros, and may corrupt other fields. Use a plain text editor (Notepad, TextEdit, VS Code), LibreOffice Calc, or R instead."
        />
        <Typography.Paragraph style={{ marginBottom: 16 }}>
          Upload a CSV file to import multiple tubes. Each row must have a{' '}
          <strong>specimen_code</strong> and <strong>project_code</strong> — codes are used exactly
          as provided, no auto-generation.
        </Typography.Paragraph>

        <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Field reference
        </Divider>

        <div style={fieldStyle}>
          <span style={{ color: '#555', fontWeight: 500 }}>collection_date</span>
          <span><code>YYYY-MM-DD</code>. Add <code>collection_date_end</code> for a date range.</span>

          <span style={{ color: '#555', fontWeight: 500 }}>sample_type_name</span>
          <span>Matched by name against the database (case-sensitive).</span>

          <span style={{ color: '#555', fontWeight: 500 }}>site_name</span>
          <span>Matched by name against the database (case-sensitive).</span>

          <span style={{ color: '#555', fontWeight: 500 }}>species</span>
          <span>
            Semicolon-separated entries, one per species association. Each entry:{' '}
            <code>name|count|life_stage|sex|confidence</code>
            <br />
            All fields after <em>name</em> are optional — leave blank to skip.
            Confidence: <code>Confirmed</code>, <code>Probable</code>, <code>Possible</code>,{' '}
            <code>Unknown</code> (default).
            <br />
            <span style={{ color: '#888', fontSize: 12 }}>
              e.g. <code>Rana temporaria|4|adult|F|Confirmed;Bufo bufo|2|instar 3||Probable</code>
            </span>
          </span>
        </div>

        <div style={{ marginTop: 16 }}>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
            Download Template
          </Button>
          <Typography.Text type="secondary" style={{ marginLeft: 10, fontSize: 12 }}>
            Includes a filled example row
          </Typography.Text>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Upload.Dragger
            accept=".csv"
            maxCount={1}
            beforeUpload={handleFile}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
            <p className="ant-upload-text">Click or drag a CSV file here to preview</p>
          </Upload.Dragger>
        </Space>
      </Card>

      {parsed.length > 0 && (
        <Card
          title={`Preview — ${parsed.length} row${parsed.length !== 1 ? 's' : ''}`}
          style={{ marginBottom: 16 }}
          extra={
            <Button type="primary" loading={importing} onClick={handleImport}>
              Import {parsed.length} Tube{parsed.length !== 1 ? 's' : ''}
            </Button>
          }
        >
          <Table
            dataSource={parsed}
            columns={previewColumns}
            rowKey="specimen_code"
            size="small"
            pagination={{ pageSize: 20 }}
            scroll={{ x: true }}
          />
        </Card>
      )}

      {result && (
        <Card title="Import Results">
          <Alert
            type={result.errors.length === 0 ? 'success' : result.created > 0 ? 'warning' : 'error'}
            message={`${result.created} tube${result.created !== 1 ? 's' : ''} created${result.errors.length > 0 ? `, ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}` : ''}`}
            style={{ marginBottom: result.errors.length > 0 ? 12 : 0 }}
          />
          {result.errors.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#cf1322' }}>
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </Card>
      )}
    </div>
  )

  return (
    <div>
      <Typography.Title level={3}>Bulk Import</Typography.Title>
      <Tabs items={[
        { key: 'tubes', label: 'Tubes', children: tubeContent },
        { key: 'sites', label: 'Sites', children: <SitesBulkImport /> },
      ]} />
    </div>
  )
}
