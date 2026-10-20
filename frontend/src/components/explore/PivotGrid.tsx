import { useMemo, useState } from 'react'
import { Button, Card, Empty, Select, Space, Table, Typography } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import { DIM, DIM_OPTIONS, countBy, type DimKey } from './dimensions'
import { heat } from './colors'
import type { ExploreData } from './useExploreData'

const MAX_COLS = 15
const MAX_ROWS = 50

interface Row { key: string; name: string; total: number; [col: string]: number | string }

export default function PivotGrid({ data }: { data: ExploreData }) {
  const [rowDim, setRowDim] = useState<DimKey>('species')
  const [colDim, setColDim] = useState<DimKey>('year')

  const { rows, cols, max, colTotals, grand } = useMemo(() => {
    const cols = countBy(data.filtered, colDim).slice(0, MAX_COLS).map((c) => c.name)
    const rowNames = countBy(data.filtered, rowDim).slice(0, MAX_ROWS).map((c) => c.name)
    const cell = new Map<string, number>()
    const rowTotal = new Map<string, number>()
    const colTotals: Record<string, number> = {}
    for (const s of data.filtered) {
      const rv = DIM[rowDim].values(s)
      const cv = DIM[colDim].values(s)
      rv.forEach((r) => rowTotal.set(r, (rowTotal.get(r) || 0) + 1))
      cv.forEach((c) => { colTotals[c] = (colTotals[c] || 0) + 1 })
      for (const r of rv) for (const c of cv) {
        const k = `${r}\u0000${c}`
        cell.set(k, (cell.get(k) || 0) + 1)
      }
    }
    let max = 1
    const rows: Row[] = rowNames.map((name) => {
      const row: Row = { key: name, name, total: rowTotal.get(name) || 0 }
      cols.forEach((c) => {
        const v = cell.get(`${name}\u0000${c}`) || 0
        row[c] = v
        if (v > max) max = v
      })
      return row
    })
    return { rows, cols, max, colTotals, grand: data.filtered.length }
  }, [data.filtered, rowDim, colDim])

  const columns = [
    {
      title: DIM[rowDim].label,
      dataIndex: 'name',
      fixed: 'left' as const,
      width: 200,
      ellipsis: true,
      render: (v: string) => <a onClick={() => data.toggle(rowDim, v)}>{v}</a>,
    },
    ...cols.map((c) => ({
      title: <a onClick={() => data.toggle(colDim, c)}>{c}</a>,
      dataIndex: c,
      align: 'center' as const,
      width: 80,
      onCell: (r: Row) => {
        const v = r[c] as number
        return {
          style: { background: v ? heat(0.12 + 0.88 * (v / max)) : undefined, cursor: v ? 'pointer' : 'default', padding: 6 },
          onClick: () => v && data.select([[rowDim, r.name], [colDim, c]]),
        }
      },
      render: (v: number) => (v ? <span style={{ color: v / max > 0.55 ? '#fff' : undefined, fontWeight: 500 }}>{v}</span> : ''),
    })),
    {
      title: 'Total',
      dataIndex: 'total',
      align: 'center' as const,
      width: 80,
      fixed: 'right' as const,
      render: (v: number) => <strong>{v}</strong>,
    },
  ]

  return (
    <Card size="small">
      <Space wrap style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary">Rows</Typography.Text>
        <Select size="small" value={rowDim} onChange={setRowDim} options={DIM_OPTIONS} style={{ width: 140 }} />
        <Button size="small" type="text" icon={<SwapOutlined />} onClick={() => { setRowDim(colDim); setColDim(rowDim) }} />
        <Typography.Text type="secondary">Columns</Typography.Text>
        <Select size="small" value={colDim} onChange={setColDim} options={DIM_OPTIONS} style={{ width: 140 }} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Click a cell to filter to it · a tube counts in each group it belongs to</Typography.Text>
      </Space>
      {rows.length === 0 ? (
        <Empty description="No tubes match the current filters" />
      ) : (
        <Table<Row>
          size="small"
          bordered
          pagination={false}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 'max-content', y: 520 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
                {cols.map((c, i) => (
                  <Table.Summary.Cell key={c} index={i + 1} align="center"><strong>{colTotals[c] || 0}</strong></Table.Summary.Cell>
                ))}
                <Table.Summary.Cell index={cols.length + 1} align="center"><strong>{grand}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      )}
    </Card>
  )
}
