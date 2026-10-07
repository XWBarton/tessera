import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Typography, Select, Input, Button, Space, Spin, Popover, Tag, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useStorageUnits, useStorageTrays, useStorageTray, useStorageTrayPositions } from '../hooks/useStorage'
import { getSpecimen } from '../api/specimens'
import apiClient from '../api/client'
import type { StorageOccupant } from '../types'

export default function TrayBrowserPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const trayId = Number(id) || 0
  const highlightPosition = Number(searchParams.get('pos')) || undefined

  const { data: units } = useStorageUnits()
  const { data: tray } = useStorageTray(trayId)
  const [selectedUnitId, setSelectedUnitId] = useState<number | undefined>(undefined)
  const { data: trays } = useStorageTrays(selectedUnitId)
  const { data: positions, isLoading } = useStorageTrayPositions(trayId)

  useEffect(() => {
    if (tray) setSelectedUnitId(tray.unit_id)
  }, [tray])

  const [locateCode, setLocateCode] = useState('')
  const [locating, setLocating] = useState(false)

  const handleLocate = async () => {
    if (!locateCode.trim()) return
    setLocating(true)
    try {
      const { data } = await apiClient.get<{ id: number }>('/specimens/find-by-code', {
        params: { code: locateCode.trim() },
      })
      const specimen = await getSpecimen(data.id)
      if (!specimen.storage_tray_id) {
        message.warning(`${locateCode} has no storage position assigned`)
        return
      }
      navigate(`/storage/trays/${specimen.storage_tray_id}?pos=${specimen.storage_position}`)
    } catch {
      message.error(`Tube '${locateCode}' not found`)
    } finally {
      setLocating(false)
    }
  }

  const positionMap = useMemo(() => {
    const m = new Map<number, StorageOccupant[]>()
    ;(positions ?? []).forEach((p) => m.set(p.position, p.occupants))
    return m
  }, [positions])

  return (
    <div>
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>Tray Browser</Typography.Title>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="Fridge/Freezer"
          style={{ width: 180 }}
          value={selectedUnitId}
          options={(units ?? []).map((u) => ({ value: u.id, label: u.name }))}
          onChange={(v) => setSelectedUnitId(v)}
        />
        <Select
          placeholder="Tray"
          style={{ width: 180 }}
          value={trayId || undefined}
          disabled={!selectedUnitId}
          options={(trays ?? []).map((t) => ({ value: t.id, label: t.name }))}
          onChange={(v) => navigate(`/storage/trays/${v}`)}
        />
        <Input
          placeholder="Find tube by code…"
          style={{ width: 200 }}
          value={locateCode}
          onChange={(e) => setLocateCode(e.target.value)}
          onPressEnter={handleLocate}
        />
        <Button icon={<SearchOutlined />} loading={locating} onClick={handleLocate}>
          Locate
        </Button>
      </Space>

      {!trayId ? (
        <Typography.Text type="secondary">Select a fridge/freezer and tray to browse.</Typography.Text>
      ) : isLoading ? (
        <Spin />
      ) : (
        <>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            {tray?.unit?.name} / {tray?.name} — {tray?.capacity} positions
          </Typography.Text>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: 8,
              maxWidth: 700,
            }}
          >
            {Array.from({ length: tray?.capacity ?? 0 }, (_, i) => i + 1).map((pos) => {
              const occupants = positionMap.get(pos) ?? []
              const isEmpty = occupants.length === 0
              const isHighlighted = pos === highlightPosition
              const cell = (
                <div
                  key={pos}
                  style={{
                    border: isHighlighted ? '2px solid #1677ff' : '1px solid #d9d9d9',
                    borderRadius: 4,
                    padding: '6px 4px',
                    textAlign: 'center',
                    cursor: occupants.length === 1 ? 'pointer' : 'default',
                    background: isEmpty ? '#fafafa' : '#e6f4ff',
                    minHeight: 54,
                  }}
                  onClick={() => {
                    if (occupants.length === 1) navigate(`/specimens/${occupants[0].id}`)
                  }}
                >
                  <div style={{ fontSize: 11, color: '#888' }}>{pos}</div>
                  {occupants.length === 0 ? null : occupants.length === 1 ? (
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {occupants[0].specimen_code}
                    </div>
                  ) : (
                    <Tag color="blue">{occupants.length} tubes</Tag>
                  )}
                </div>
              )
              if (occupants.length === 0) return cell
              return (
                <Popover
                  key={pos}
                  title={`Position ${pos}`}
                  content={
                    <Space direction="vertical">
                      {occupants.map((o) => (
                        <a key={o.id} onClick={() => navigate(`/specimens/${o.id}`)}>
                          {o.specimen_code} {o.project_code && `(${o.project_code})`} {o.species && `— ${o.species}`}
                        </a>
                      ))}
                    </Space>
                  }
                >
                  {cell}
                </Popover>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
