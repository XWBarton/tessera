import { useEffect, useState } from 'react'
import { Button, Select, InputNumber, Card, Row, Col } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSpecies } from '../../hooks/useSpecies'
import { useLookupOptions } from '../../hooks/useLookups'
import { AddTaxonModal, RankTag, guessTaxon, type TaxonValues } from '../species/TaxonForm'
import type { Species, SpecimenSpeciesCreate } from '../../types'

const CONFIDENCE_OPTIONS = ['Confirmed', 'Probable', 'Possible', 'Unknown'].map((v) => ({
  value: v,
  label: v,
}))

const ADD_PREFIX = '__add__:'

interface Props {
  value?: SpecimenSpeciesCreate[]
  onChange?: (value: SpecimenSpeciesCreate[]) => void
}

export default function SpeciesAssociationForm({ value = [], onChange }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const { data: speciesList, isFetching } = useSpecies(searchQuery || undefined)
  const { data: lifeStageOpts } = useLookupOptions('life_stage')
  const { data: sexOpts } = useLookupOptions('sex')
  const lifeStageOptions = (lifeStageOpts ?? []).map((o) => ({ value: o.value, label: o.value }))
  const sexOptions = (sexOpts ?? []).map((o) => ({ value: o.value, label: o.value }))
  // Every taxon seen so far, so a row keeps its label when a later search doesn't return it
  const [known, setKnown] = useState<Map<number, Species>>(new Map())
  const [adding, setAdding] = useState<{ index: number; initial: TaxonValues } | null>(null)

  useEffect(() => {
    if (!speciesList?.length) return
    setKnown((prev) => {
      const next = new Map(prev)
      speciesList.forEach((s) => next.set(s.id, s))
      return next
    })
  }, [speciesList])

  const update = (assocs: SpecimenSpeciesCreate[]) => onChange?.(assocs)

  const addAssoc = () => {
    update([
      ...value,
      {
        species_id: undefined,
        specimen_count: null,
        life_stage: null,
        sex: null,
        confidence: 'Unknown',
      },
    ])
  }

  const removeAssoc = (index: number) => {
    update(value.filter((_, i) => i !== index))
  }

  const updateAssoc = (index: number, patch: Partial<SpecimenSpeciesCreate>) => {
    update(value.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  const optionLabel = (s: Species) => (
    <span>
      <em>{s.scientific_name}</em>
      {s.common_name ? ` (${s.common_name})` : ''}
      <RankTag rank={s.rank} />
    </span>
  )

  const query = searchQuery.trim()
  const exactMatch = speciesList?.some((s) => s.scientific_name.toLowerCase() === query.toLowerCase())
  const baseOptions = (speciesList ?? []).map((s) => ({ value: s.id, label: optionLabel(s), title: s.scientific_name }))

  return (
    <div>
      {value.map((assoc, index) => {
        const selected = assoc.species_id ? known.get(assoc.species_id) : undefined
        const options = [
          ...(selected && !baseOptions.some((o) => o.value === selected.id)
            ? [{ value: selected.id, label: optionLabel(selected), title: selected.scientific_name }]
            : []),
          ...baseOptions,
          ...(query && !exactMatch && !isFetching
            ? [{ value: `${ADD_PREFIX}${query}`, label: <span><PlusOutlined /> Add &ldquo;{query}&rdquo; to taxa</span>, title: query }]
            : []),
        ]

        return (
          <Card key={index} size="small" style={{ marginBottom: 8 }}>
            <Row gutter={[8, 8]} align="middle">
              <Col span={13}>
                <Select<number | string>
                  style={{ width: '100%' }}
                  placeholder="Search taxa, e.g. Ixodes sp."
                  showSearch
                  filterOption={false}
                  onSearch={setSearchQuery}
                  onDropdownVisibleChange={(o) => { if (!o) setSearchQuery('') }}
                  value={assoc.species_id || undefined}
                  status={assoc.species_id ? undefined : 'warning'}
                  onChange={(v) => {
                    if (typeof v === 'string' && v.startsWith(ADD_PREFIX)) {
                      setAdding({ index, initial: guessTaxon(v.slice(ADD_PREFIX.length)) })
                      return
                    }
                    updateAssoc(index, { species_id: v as number })
                  }}
                  notFoundContent={isFetching ? 'Searching…' : 'Type a name to search or add a taxon'}
                  options={options}
                />
              </Col>
              <Col span={3}>
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="Count"
                  value={assoc.specimen_count ?? undefined}
                  onChange={(v) => updateAssoc(index, { specimen_count: v ?? null })}
                />
              </Col>
              <Col span={4}>
                <Select
                  style={{ width: '100%' }}
                  value={assoc.confidence}
                  options={CONFIDENCE_OPTIONS}
                  onChange={(v) => updateAssoc(index, { confidence: v })}
                />
              </Col>
              <Col span={4}>
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  onClick={() => removeAssoc(index)}
                />
              </Col>
            </Row>
            <Row gutter={[8, 0]} style={{ marginTop: 6 }}>
              <Col span={12}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Life stage"
                  allowClear
                  value={assoc.life_stage ?? undefined}
                  options={lifeStageOptions}
                  onChange={(v) => updateAssoc(index, { life_stage: v ?? null })}
                />
              </Col>
              <Col span={12}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Sex"
                  allowClear
                  value={assoc.sex ?? undefined}
                  options={sexOptions}
                  onChange={(v) => updateAssoc(index, { sex: v ?? null })}
                />
              </Col>
            </Row>
          </Card>
        )
      })}
      <Button icon={<PlusOutlined />} size="small" onClick={addAssoc}>
        Add Species
      </Button>
      <AddTaxonModal
        open={!!adding}
        initial={adding?.initial}
        onClose={() => setAdding(null)}
        onCreated={(s) => {
          setKnown((prev) => new Map(prev).set(s.id, s))
          if (adding) updateAssoc(adding.index, { species_id: s.id })
        }}
      />
    </div>
  )
}
