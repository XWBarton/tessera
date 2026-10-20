import { useMemo } from 'react'
import { Empty, Typography } from 'antd'
import dayjs from 'dayjs'
import type { Specimen } from '../../types'
import { unitLabel, weightOf, type Measure } from './dimensions'
import { heat } from './colors'

const CELL = 13
const GAP = 2
const LEFT = 30
const TOP = 16
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MAX_YEARS = 10

interface Props {
  specimens: Specimen[]
  measure: Measure
  /** Currently selected range; days outside it are faded. */
  selected?: [string, string]
  onSelectRange: (range: [string, string]) => void
}

// GitHub-style activity calendar: one block per year, a column per week, a row per weekday.
export default function CalendarHeatmap({ specimens, measure, selected, onSelectRange }: Props) {
  const { counts, years, max } = useMemo(() => {
    const counts = new Map<string, number>()
    specimens.forEach((s) => {
      const d = s.collection_date?.slice(0, 10)
      if (d) counts.set(d, (counts.get(d) || 0) + weightOf(s, measure))
    })
    const years = Array.from(new Set(Array.from(counts.keys()).map((d) => Number(d.slice(0, 4)))))
      .sort((a, b) => b - a)
      .slice(0, MAX_YEARS)
    return { counts, years, max: Math.max(1, ...counts.values()) }
  }, [specimens, measure])

  if (!years.length) return <Empty description="No tubes with collection dates" />

  const width = LEFT + 53 * (CELL + GAP) + 10
  const height = TOP + 7 * (CELL + GAP) + 4

  return (
    <div style={{ overflowX: 'auto' }}>
      {years.map((year) => {
        const start = dayjs(`${year}-01-01`)
        const offset = start.day() // weekday of Jan 1 (0 = Sunday)
        const days = start.add(1, 'year').diff(start, 'day')
        const yearTotal = Array.from(counts).filter(([d]) => d.startsWith(String(year))).reduce((a, [, n]) => a + n, 0)
        return (
          <div key={year} style={{ marginBottom: 14 }}>
            <Typography.Link strong onClick={() => onSelectRange([`${year}-01-01`, `${year}-12-31`])}>
              {year}
            </Typography.Link>
            <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{yearTotal} {unitLabel(measure, yearTotal)}</Typography.Text>
            <svg width={width} height={height} style={{ display: 'block' }}>
              {MONTHS.map((m, i) => {
                const first = dayjs(`${year}-${String(i + 1).padStart(2, '0')}-01`)
                const col = Math.floor((first.diff(start, 'day') + offset) / 7)
                return (
                  <text
                    key={m}
                    x={LEFT + col * (CELL + GAP)}
                    y={11}
                    fontSize={10}
                    fill="#888"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectRange([first.format('YYYY-MM-DD'), first.endOf('month').format('YYYY-MM-DD')])}
                  >
                    {m}
                  </text>
                )
              })}
              {['Mon', 'Wed', 'Fri'].map((d, i) => (
                <text key={d} x={0} y={TOP + (i * 2 + 1) * (CELL + GAP) + CELL - 3} fontSize={9} fill="#aaa">{d}</text>
              ))}
              {Array.from({ length: days }, (_, i) => {
                const date = start.add(i, 'day')
                const key = date.format('YYYY-MM-DD')
                const n = counts.get(key) || 0
                const idx = i + offset
                return (
                  <rect
                    key={key}
                    x={LEFT + Math.floor(idx / 7) * (CELL + GAP)}
                    y={TOP + (idx % 7) * (CELL + GAP)}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    opacity={selected && (key < selected[0] || key > selected[1]) ? 0.3 : 1}
                    fill={n ? heat(0.2 + 0.8 * Math.sqrt(n / max)) : '#ebedf0'}
                    style={{ cursor: n ? 'pointer' : 'default' }}
                    onClick={() => n && onSelectRange([key, key])}
                  >
                    <title>{`${date.format('ddd D MMM YYYY')}: ${n} ${unitLabel(measure, n)}`}</title>
                  </rect>
                )
              })}
            </svg>
          </div>
        )
      })}
    </div>
  )
}
