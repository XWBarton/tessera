import { useMemo, useState } from 'react'
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
  Select,
  Input,
} from 'antd'
import { UploadOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { bulkImportSpecimens } from '../api/specimens'
import { bulkImportSites } from '../api/sites'
import type { SiteBulkImportRow, SiteBulkImportResult } from '../api/sites'
import type { BulkImportRow, BulkImportResult, Site } from '../types'
import { useSites } from '../hooks/useSites'

const NO_SITE = '__none__'

/** Select of sites by full path, searchable. */
function SitePathSelect({ sites, value, onChange, placeholder, allowNone }: {
  sites: Site[]
  value?: string
  onChange: (v: string | undefined) => void
  placeholder: string
  allowNone?: boolean
}) {
  const options = [
    ...(allowNone ? [{ value: NO_SITE, label: 'Import without a site' }] : []),
    ...[...sites].sort((a, b) => a.path.localeCompare(b.path)).map((s) => ({ value: s.path, label: s.path })),
  ]
  return (
    <Select
      showSearch
      allowClear
      style={{ minWidth: 320 }}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      options={options}
      optionFilterProp="label"
    />
  )
}

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


// ── Column mapping ─────────────────────────────────────────────────────────────

interface FieldDef { key: string; label: string; required?: boolean; aliases?: string[] }

const TUBE_FIELDS: FieldDef[] = [
  { key: 'specimen_code', label: 'Specimen code', required: true, aliases: ['code', 'tubecode', 'tubeid', 'id'] },
  { key: 'project_code', label: 'Project code', required: true, aliases: ['project'] },
  { key: 'collection_date', label: 'Collection date', aliases: ['date', 'collected'] },
  { key: 'collection_date_end', label: 'Collection date end', aliases: ['enddate', 'dateend'] },
  { key: 'collector_name', label: 'Collector', aliases: ['collector', 'collectedby'] },
  { key: 'site_name', label: 'Site', aliases: ['site', 'location', 'locality'] },
  { key: 'sample_type_name', label: 'Sample type', aliases: ['sampletype', 'type'] },
  { key: 'quantity_value', label: 'Quantity', aliases: ['quantity', 'qty', 'count'] },
  { key: 'quantity_unit', label: 'Quantity unit', aliases: ['unit', 'units'] },
  { key: 'notes', label: 'Notes', aliases: ['note', 'comments', 'comment'] },
  { key: 'species', label: 'Species', aliases: ['taxa', 'taxon'] },
]

const SITE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', required: true, aliases: ['site', 'sitename'] },
  { key: 'parent', label: 'Parent', aliases: ['parentsite', 'parentpath', 'region'] },
  { key: 'level', label: 'Level', aliases: ['type', 'rank'] },
  { key: 'description', label: 'Description', aliases: ['desc'] },
  { key: 'habitat_type', label: 'Habitat', aliases: ['habitat'] },
  { key: 'lat', label: 'Latitude', aliases: ['latitude'] },
  { key: 'lon', label: 'Longitude', aliases: ['long', 'lng', 'longitude'] },
  { key: 'notes', label: 'Notes', aliases: ['note', 'comments'] },
]

const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Best-guess mapping of each field to a CSV column index (exact name, label or alias, ignoring case/punctuation). */
function guessMapping(fields: FieldDef[], headers: string[]): Record<string, number | undefined> {
  const normHeaders = headers.map(norm)
  const used = new Set<number>()
  const out: Record<string, number | undefined> = {}
  for (const f of fields) {
    const candidates = [f.key, f.label, ...(f.aliases ?? [])].map(norm)
    const idx = normHeaders.findIndex((h, i) => !used.has(i) && candidates.includes(h))
    if (idx >= 0) { out[f.key] = idx; used.add(idx) }
  }
  return out
}

/** Rename CSV headers to the field keys they are mapped to, so the row builders can read them by key. */
function remapHeaders(headers: string[], mapping: Record<string, number | undefined>): string[] {
  const out = headers.map(() => '')
  Object.entries(mapping).forEach(([key, idx]) => { if (idx != null) out[idx] = key })
  return out
}

function ColumnMapper({ fields, headers, mapping, onChange }: {
  fields: FieldDef[]
  headers: string[]
  mapping: Record<string, number | undefined>
  onChange: (m: Record<string, number | undefined>) => void
}) {
  const options = headers.map((h, i) => ({ value: i, label: h || `(column ${i + 1})` }))
  const missing = fields.filter((f) => f.required && mapping[f.key] == null)
  return (
    <Card size="small" title="Match your columns" style={{ marginBottom: 16 }}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        Choose which column in your file holds each field. Columns with matching names are picked automatically;
        leave a field blank to skip it.
      </Typography.Paragraph>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px 16px' }}>
        {fields.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>
              {f.label}{f.required && <span style={{ color: '#cf1322' }}> *</span>}
            </div>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              placeholder="— not in file —"
              status={f.required && mapping[f.key] == null ? 'error' : undefined}
              value={mapping[f.key]}
              options={options}
              onChange={(v) => onChange({ ...mapping, [f.key]: v ?? undefined })}
            />
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message={`Required: ${missing.map((f) => f.label).join(', ')}`}
        />
      )}
    </Card>
  )
}

/** Holds an uploaded CSV and the column mapping chosen for it. */
function useCsvMapping(fields: FieldDef[]) {
  const [csv, setCsv] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [mapping, setMapping] = useState<Record<string, number | undefined>>({})
  const load = (text: string) => {
    const parsedCsv = parseCsv(text)
    setCsv(parsedCsv)
    setMapping(guessMapping(fields, parsedCsv.headers))
  }
  const clear = () => { setCsv(null); setMapping({}) }
  const headers = csv ? remapHeaders(csv.headers, mapping) : []
  return { csv, mapping, setMapping, load, clear, headers }
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
  { title: 'Site', dataIndex: 'site_name', key: 'site_name', render: (v: string) => v || '—' },
  { title: 'Sample Type', dataIndex: 'sample_type_name', key: 'sample_type_name', render: (v: string) => v || '—' },
  { title: 'Qty', key: 'qty', render: (_: unknown, r: BulkImportRow) => r.quantity_value != null ? `${r.quantity_value} ${r.quantity_unit || ''}` : '—' },
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

const SITE_TEMPLATE_COLUMNS = ['name', 'parent', 'level', 'description', 'habitat_type', 'lat', 'lon', 'notes']
const SITE_TEMPLATE_EXAMPLE = ['Wetland A', 'Australia > Western Australia', 'Locality', 'Main wetland site', 'Wetland', '-31.5377', '115.6702', '']

function rowsToSiteImport(headers: string[], rows: string[][]): SiteBulkImportRow[] {
  return rows.map((cols) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h.trim()] = (cols[i] ?? '').trim() })
    return {
      name: obj.name || '',
      parent: obj.parent || undefined,
      level: obj.level || undefined,
      description: obj.description || undefined,
      habitat_type: obj.habitat_type || undefined,
      lat: obj.lat ? parseFloat(obj.lat) : undefined,
      lon: obj.lon ? parseFloat(obj.lon) : undefined,
      notes: obj.notes || undefined,
    }
  }).filter((r) => r.name)
}

const sitePreviewColumns = [
  { title: 'Level', dataIndex: 'level', key: 'level', render: (v: string) => v || '—' },
  { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true, render: (v: string) => v || '—' },
  { title: 'Habitat', dataIndex: 'habitat_type', key: 'habitat_type', render: (v: string) => v ? <Tag>{v}</Tag> : '—' },
  { title: 'Lat', dataIndex: 'lat', key: 'lat', render: (v: number) => v ?? '—' },
  { title: 'Lon', dataIndex: 'lon', key: 'lon', render: (v: number) => v ?? '—' },
  { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true, render: (v: string) => v || '—' },
]

type SiteImportRow = SiteBulkImportRow & { key: string; isNew?: boolean }

const rowPath = (r: { name: string; parent?: string }) => (r.parent ? `${r.parent} > ${r.name}` : r.name)

/** Dropdown footer for typing the name of a brand-new parent site. */
function NewParentInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  const add = () => { if (name.trim()) { onAdd(name.trim()); setName('') } }
  return (
    <Space.Compact style={{ width: '100%', padding: 8 }}>
      <Input
        size="small"
        placeholder="New parent name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') add() }}
      />
      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={add}>Create</Button>
    </Space.Compact>
  )
}

function SitesBulkImport() {
  const cm = useCsvMapping(SITE_FIELDS)
  const parsed = useMemo(() => (cm.csv ? rowsToSiteImport(cm.headers, cm.csv.rows) : []), [cm.csv, cm.mapping]) // eslint-disable-line react-hooks/exhaustive-deps
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<SiteBulkImportResult | null>(null)
  const [defaultParent, setDefaultParent] = useState<string | undefined>()
  const { data: allSites = [] } = useSites({ limit: 5000 })
  const [overrides, setOverrides] = useState<Record<string, string | null>>({})
  const [extras, setExtras] = useState<SiteImportRow[]>([])
  const rows: SiteImportRow[] = useMemo(() => {
    const base: SiteImportRow[] = [...parsed.map((r, i) => ({ ...r, key: `p${i}` })), ...extras]
    return base.map((r) => ({
      ...r,
      parent: r.key in overrides ? (overrides[r.key] ?? undefined) : (r.parent || defaultParent),
    }))
  }, [parsed, extras, overrides, defaultParent])

  // Re-point rows beneath oldPath at newPath (or to the top level when newPath is null)
  const rewriteChildren = (oldPath: string, newPath: string | null, skipKey: string, into: Record<string, string | null>) => {
    rows.forEach((r) => {
      if (r.key === skipKey || !r.parent) return
      if (r.parent === oldPath) into[r.key] = newPath
      else if (r.parent.startsWith(oldPath + ' > ')) {
        const rest = r.parent.slice(oldPath.length + 3)
        into[r.key] = newPath ? `${newPath} > ${rest}` : rest
      }
    })
  }

  const setParent = (row: SiteImportRow, parent: string | null) => {
    const next = { ...overrides, [row.key]: parent }
    rewriteChildren(rowPath(row), parent ? `${parent} > ${row.name}` : row.name, row.key, next)
    setOverrides(next)
  }

  const addNewParent = (forRow: SiteImportRow, name: string) => {
    const key = `x${Date.now()}`
    setExtras((prev) => [...prev, { key, name, level: 'Parent', isNew: true }])
    setOverrides((prev) => {
      const next = { ...prev, [key]: null }
      next[forRow.key] = name
      rewriteChildren(rowPath(forRow), `${name} > ${forRow.name}`, forRow.key, next)
      return next
    })
  }

  const removeNewParent = (row: SiteImportRow) => {
    const next = { ...overrides }
    delete next[row.key]
    rewriteChildren(rowPath(row), null, row.key, next)
    setOverrides(next)
    setExtras((prev) => prev.filter((e) => e.key !== row.key))
  }

  const parentOptions = (row: SiteImportRow) => {
    const own = rowPath(row)
    const inFile = rows
      .map(rowPath)
      .filter((pth) => pth !== own && !pth.startsWith(own + ' > '))
    return [
      { label: 'In this file', options: [...new Set(inFile)].map((pth) => ({ value: pth, label: pth })) },
      { label: 'Existing sites', options: [...allSites].sort((x, y) => x.path.localeCompare(y.path)).map((x) => ({ value: x.path, label: x.path })) },
    ]
  }

  const columns = [
    {
      title: 'Name',
      key: 'name',
      render: (_: unknown, r: SiteImportRow) => (
        <Space size={4}>
          {r.name}
          {r.isNew && <Tag color="green" style={{ marginInlineEnd: 0 }}>new</Tag>}
        </Space>
      ),
    },
    {
      title: 'Parent',
      key: 'parent',
      width: 340,
      render: (_: unknown, r: SiteImportRow) => (
        <Select
          size="small"
          showSearch
          allowClear
          style={{ width: '100%' }}
          placeholder="Top level"
          value={r.parent}
          options={parentOptions(r)}
          optionFilterProp="label"
          onChange={(v) => setParent(r, v ?? null)}
          popupRender={(menu) => (
            <>
              {menu}
              <Divider style={{ margin: 0 }} />
              <NewParentInput onAdd={(name) => addNewParent(r, name)} />
            </>
          )}
        />
      ),
    },
    ...sitePreviewColumns,
    {
      title: '',
      key: 'remove',
      width: 40,
      render: (_: unknown, r: SiteImportRow) => r.isNew
        ? <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeNewParent(r)} />
        : null,
    },
  ]

  // Parents are created before their children, so sort shallowest first
  const importRows = useMemo(
    () => rows
      .map((r, i) => ({ r, i, depth: rowPath(r).split(' > ').length }))
      .sort((x, y) => x.depth - y.depth || x.i - y.i)
      .map(({ r }) => ({ name: r.name, parent: r.parent, level: r.level, description: r.description, habitat_type: r.habitat_type, lat: r.lat, lon: r.lon, precision: r.precision, notes: r.notes })),
    [rows],
  )
  const noParentCount = parsed.filter((r) => !r.parent).length

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
        cm.load(e.target?.result as string)
        setDefaultParent(undefined)
        setOverrides({})
        setExtras([])
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
      const res = await bulkImportSites(importRows)
      setResult(res)
      if (res.created > 0) message.success(`${res.created} site${res.created !== 1 ? 's' : ''} imported`)
      if (res.errors.length === 0) cm.clear()
    } catch { message.error('Import failed') }
    finally { setImporting(false) }
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Typography.Paragraph style={{ marginBottom: 16 }}>
          Upload a CSV to create multiple sites at once. Rows whose <strong>name</strong> already exists
          under the same parent are skipped (not updated). Parents must exist already or appear earlier in the file. Coordinates should be decimal degrees (WGS 84).
        </Typography.Paragraph>

        <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Field reference
        </Divider>
        <div style={fieldStyle}>
          <span style={{ color: '#555', fontWeight: 500 }}>name</span>
          <span><strong>Required.</strong> Must be unique among sites with the same parent — duplicates are skipped.</span>

          <span style={{ color: '#555', fontWeight: 500 }}>parent</span>
          <span>Optional. Name or full path of the parent, e.g. <code>Australia &gt; Western Australia</code>. Blank = top level. Use the path if the name is not unique.</span>

          <span style={{ color: '#555', fontWeight: 500 }}>level</span>
          <span>Optional free text, e.g. <code>Country</code>, <code>State</code>, <code>Locality</code>.</span>

          <span style={{ color: '#555', fontWeight: 500 }}>lat / lon</span>
          <span>Decimal degrees, e.g. <code>-31.5377</code> / <code>115.6702</code></span>

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

      {cm.csv && <ColumnMapper fields={SITE_FIELDS} headers={cm.csv.headers} mapping={cm.mapping} onChange={cm.setMapping} />}

      {parsed.length > 0 && noParentCount > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <span>{noParentCount} row{noParentCount !== 1 ? 's have' : ' has'} no parent. Put them under:</span>
            <SitePathSelect sites={allSites} value={defaultParent} onChange={setDefaultParent} placeholder="Top level (no parent)" />
          </Space>
        </Card>
      )}

      {parsed.length > 0 && (
        <Card
          title={`Preview — ${rows.length} row${rows.length !== 1 ? 's' : ''}`}
          style={{ marginBottom: 16 }}
          extra={
            <Button type="primary" loading={importing} onClick={handleImport}>
              Import {rows.length} Site{rows.length !== 1 ? 's' : ''}
            </Button>
          }
        >
          <Table dataSource={rows} columns={columns} rowKey="key" size="small" pagination={{ pageSize: 20 }} scroll={{ x: true }} />
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
  const cm = useCsvMapping(TUBE_FIELDS)
  const parsed = useMemo(() => (cm.csv ? rowsToImport(cm.headers, cm.csv.rows) : []), [cm.csv, cm.mapping]) // eslint-disable-line react-hooks/exhaustive-deps
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [siteChoice, setSiteChoice] = useState<Record<string, string | undefined>>({})
  const { data: allSites = [] } = useSites({ limit: 5000 })

  // Check each distinct site_name in the file against the database
  const siteIssues = useMemo(() => {
    const names = [...new Set(parsed.map((r) => r.site_name).filter((n): n is string => !!n))]
    return names.flatMap((name) => {
      const parts = name.split('>').map((p) => p.trim()).filter(Boolean)
      const matches = parts.length > 1
        ? allSites.filter((s) => s.path.split('>').map((p) => p.trim()).join(' > ') === parts.join(' > '))
        : allSites.filter((s) => s.name === name)
      return matches.length === 1 ? [] : [{ name, matches }]
    })
  }, [parsed, allSites])
  const unresolved = siteIssues.filter((i) => !siteChoice[i.name])
  const resolvedRows = useMemo(() => parsed.map((r) => {
    const c = r.site_name ? siteChoice[r.site_name] : undefined
    return c ? { ...r, site_name: c === NO_SITE ? undefined : c } : r
  }), [parsed, siteChoice])

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
        cm.load(e.target?.result as string)
        setSiteChoice({})
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
      const res = await bulkImportSpecimens(resolvedRows)
      setResult(res)
      if (res.created > 0) {
        message.success(`${res.created} tube${res.created !== 1 ? 's' : ''} imported`)
      }
      if (res.errors.length === 0) {
        cm.clear()
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
          <span>
            Site name, or full path such as <code>Victoria &gt; Lakes Entrance &gt; Jemmys Point</code> (case-sensitive).
            Use the path when the name exists in more than one place. Unknown or ambiguous sites fail the row.
          </span>

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

      {cm.csv && <ColumnMapper fields={TUBE_FIELDS} headers={cm.csv.headers} mapping={cm.mapping} onChange={cm.setMapping} />}

      {siteIssues.length > 0 && (
        <Card
          size="small"
          title="Sites to resolve"
          style={{ marginBottom: 16 }}
        >
          <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
            These site names are not found, or match more than one site. Pick the right site for each.
          </Typography.Paragraph>
          <Space direction="vertical" style={{ width: '100%' }}>
            {siteIssues.map(({ name, matches }) => (
              <Space key={name} wrap>
                <Tag color={matches.length ? 'orange' : 'red'}>{matches.length ? 'Ambiguous' : 'Not found'}</Tag>
                <code>{name}</code>
                <span>({parsed.filter((r) => r.site_name === name).length} rows) →</span>
                <SitePathSelect
                  sites={matches.length ? matches : allSites}
                  value={siteChoice[name]}
                  onChange={(v) => setSiteChoice((prev) => ({ ...prev, [name]: v }))}
                  placeholder="Choose site"
                  allowNone
                />
              </Space>
            ))}
          </Space>
        </Card>
      )}

      {parsed.length > 0 && (
        <Card
          title={`Preview — ${parsed.length} row${parsed.length !== 1 ? 's' : ''}`}
          style={{ marginBottom: 16 }}
          extra={
            <Button type="primary" loading={importing} disabled={unresolved.length > 0} onClick={handleImport}>
              Import {parsed.length} Tube{parsed.length !== 1 ? 's' : ''}
            </Button>
          }
        >
          <Table
            dataSource={resolvedRows}
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
