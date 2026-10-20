import { useMemo, useState } from 'react'
import { Button, DatePicker, Select, Space, Tag, Typography } from 'antd'
import { ClearOutlined, FilterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { DIM, DIM_OPTIONS, countBy, type DimKey, type Measure } from './dimensions'
import type { ExploreData } from './useExploreData'

const DEFAULT_DIMS: DimKey[] = ['project', 'species', 'collector']

export default function ExploreFilterBar({ data }: { data: ExploreData }) {
  const { filters, filterExcept, setDim, toggle, setDateRange, clear } = data
  const active = Object.keys(filters.dims) as DimKey[]
  const [extra, setExtra] = useState<DimKey[]>([])
  const shown = Array.from(new Set([...DEFAULT_DIMS, ...active, ...extra]))

  const hasFilters = active.length > 0 || !!filters.dateRange

  return (
    <div style={{ marginBottom: 16 }}>
      <Space wrap align="center">
        {shown.map((dim) => (
          <DimSelect key={dim} dim={dim} value={filters.dims[dim] || []} onChange={(v) => setDim(dim, v)} facet={() => filterExcept(dim)} measure={data.measure} />
        ))}
        <DatePicker.RangePicker
          allowEmpty={[false, false]}
          value={filters.dateRange ? [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])] : null}
          onChange={(r) => setDateRange(r?.[0] && r?.[1] ? [r[0].format('YYYY-MM-DD'), r[1].format('YYYY-MM-DD')] : undefined)}
        />
        <Select
          placeholder={<><FilterOutlined /> Add filter</>}
          value={null}
          style={{ width: 150 }}
          options={DIM_OPTIONS.filter((o) => !shown.includes(o.value))}
          onChange={(v: DimKey) => setExtra((e) => [...e, v])}
        />
        {hasFilters && <Button icon={<ClearOutlined />} onClick={() => { clear(); setExtra([]) }}>Clear all</Button>}
      </Space>

      {hasFilters && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Active:</Typography.Text>
          {active.flatMap((dim) => (filters.dims[dim] || []).map((v) => (
            <Tag key={`${dim}:${v}`} closable color="green" onClose={(e) => { e.preventDefault(); toggle(dim, v) }}>
              <span style={{ opacity: 0.7 }}>{DIM[dim].label}:</span> {v}
            </Tag>
          )))}
          {filters.dateRange && (
            <Tag closable color="blue" onClose={(e) => { e.preventDefault(); setDateRange(undefined) }}>
              <span style={{ opacity: 0.7 }}>Date:</span> {filters.dateRange[0]} → {filters.dateRange[1]}
            </Tag>
          )}
        </div>
      )}
    </div>
  )
}

function DimSelect({ dim, value, onChange, facet, measure }: {
  dim: DimKey
  measure: Measure
  value: string[]
  onChange: (v: string[]) => void
  facet: () => ReturnType<ExploreData['filterExcept']>
}) {
  const [open, setOpen] = useState(false)
  // Facet counts only computed while the dropdown is open.
  const options = useMemo(() => {
    if (!open) return value.map((v) => ({ value: v, label: v }))
    return countBy(facet(), dim, measure).map((c) => ({ value: c.name, label: `${c.name} (${c.value})`, title: c.name }))
  }, [open, facet, dim, value, measure])

  return (
    <Select
      mode="multiple"
      allowClear
      maxTagCount="responsive"
      placeholder={DIM[dim].label}
      style={{ minWidth: 170, maxWidth: 280 }}
      value={value}
      onChange={onChange}
      onDropdownVisibleChange={setOpen}
      options={options}
      optionFilterProp="title"
      showSearch
    />
  )
}
