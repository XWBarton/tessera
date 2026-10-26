import { useMemo, useState } from 'react'
import { Button, Select, Radio, Space, Tag, Typography, Alert, message } from 'antd'
import { useSites, useSiteCounts, useMergeSites, useSiteDuplicates } from '../../hooks/useSites'
import { subtreeIds } from '../../utils/siteTree'
import type { Site } from '../../types'

const REASON_TEXT: Record<string, string> = { name: 'similar name', nearby: 'close by' }

/** Pick two or more sites that are really the same place, choose which one to keep, and fold the rest into it. */
export default function MergeSitesPanel() {
  const { data: allSites } = useSites()
  const { data: counts } = useSiteCounts()
  const sites = useMemo(() => allSites ?? [], [allSites])
  const mergeSites = useMergeSites()
  const [ids, setIds] = useState<number[]>([])
  const [keepId, setKeepId] = useState<number | undefined>(undefined)

  const byId = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites])
  const selected = ids.map((id) => byId.get(id)).filter((s): s is Site => !!s)
  const count = (id: number) => counts?.[id] ?? 0

  // A site can't be kept if it sits under another selected site: that one would be deleted around it
  const blockedKeep = useMemo(() => {
    const out = new Map<number, Site>()
    for (const s of selected) {
      for (const other of selected) {
        if (other.id !== s.id && subtreeIds(sites, other.id).has(s.id)) out.set(s.id, other)
      }
    }
    return out
  }, [selected, sites])

  // Default to keeping the site with the most specimens
  const effectiveKeep = keepId != null && ids.includes(keepId) && !blockedKeep.has(keepId)
    ? keepId
    : [...selected].filter((s) => !blockedKeep.has(s.id)).sort((a, b) => count(b.id) - count(a.id) || a.id - b.id)[0]?.id

  // Suggest likely duplicates of the first site picked
  const anchor = selected[0]
  const { data: matches } = useSiteDuplicates(
    {
      name: anchor?.name,
      parent_id: anchor?.parent_id ?? null,
      lat: anchor?.lat ?? null,
      lon: anchor?.lon ?? null,
      radius_m: anchor?.radius_m ?? null,
      boundary: anchor?.boundary ?? undefined,
      exclude_id: anchor?.id,
    },
    !!anchor,
  )
  const suggestions = (matches ?? []).filter((m) => !ids.includes(m.site.id))

  const handleOk = async () => {
    if (effectiveKeep == null) return
    const sourceIds = ids.filter((id) => id !== effectiveKeep)
    try {
      const kept = await mergeSites.mutateAsync({ sourceIds, targetId: effectiveKeep })
      message.success(`Merged ${sourceIds.length} site${sourceIds.length !== 1 ? 's' : ''} into "${kept.path}"`)
      setIds([])
      setKeepId(undefined)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Merge failed')
    }
  }

  const removing = selected.filter((s) => s.id !== effectiveKeep)

  return (
    <div style={{ maxWidth: 720 }}>
      <Typography.Paragraph type="secondary">
        Pick the sites that are really the same place, then choose the one to keep. Specimens, sub-sites and project
        tags from the others move onto it, blank fields on it are filled in from them, and the others are deleted.
      </Typography.Paragraph>
      <Select
        mode="multiple"
        showSearch
        style={{ width: '100%' }}
        placeholder="Search for sites to merge…"
        value={ids}
        onChange={setIds}
        optionFilterProp="label"
        options={[...sites]
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((s) => ({ value: s.id, label: s.path }))}
      />

      {suggestions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ marginRight: 6 }}>Possible duplicates of {anchor?.name}:</Typography.Text>
          {suggestions.map((m) => (
            <Tag
              key={m.site.id}
              color="blue"
              style={{ cursor: 'pointer', marginBottom: 4 }}
              onClick={() => setIds((cur) => [...cur, m.site.id])}
            >
              + {m.site.path}
              <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                ({m.reasons.map((r) => REASON_TEXT[r]).join(', ')}{m.distance_m != null ? `, ${Math.round(m.distance_m)} m` : ''})
              </Typography.Text>
            </Tag>
          ))}
        </div>
      )}

      {selected.length >= 2 && (
        <>
          <Typography.Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>Keep which one?</Typography.Text>
          <Radio.Group value={effectiveKeep} onChange={(e) => setKeepId(e.target.value)} style={{ width: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {selected.map((s) => {
                const blocker = blockedKeep.get(s.id)
                return (
                  <Radio key={s.id} value={s.id} disabled={!!blocker}>
                    <span>{s.path}</span>
                    <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {count(s.id)} specimen{count(s.id) !== 1 ? 's' : ''}
                      {s.lat != null && s.lon != null && ` · ${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}`}
                      {s.precision && ` · ${s.precision}`}
                      {blocker && ` · sits under ${blocker.name}, which is being merged`}
                    </Typography.Text>
                  </Radio>
                )
              })}
            </Space>
          </Radio.Group>
          {removing.length > 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              message={`${removing.map((s) => s.name).join(', ')} will be deleted after ${removing.length !== 1 ? 'their' : 'its'} records move across.`}
            />
          )}
          <Button
            type="primary"
            danger
            style={{ marginTop: 16 }}
            disabled={effectiveKeep == null}
            loading={mergeSites.isPending}
            onClick={handleOk}
          >
            {`Merge ${removing.length} site${removing.length !== 1 ? 's' : ''} into kept site`}
          </Button>
        </>
      )}
    </div>
  )
}
