import { useState } from 'react'
import { Button, Select, Input, InputNumber, Checkbox, Card, Row, Col } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSpecies } from '../../hooks/useSpecies'
import { useLookupOptions } from '../../hooks/useLookups'
import type { SpecimenSpeciesCreate } from '../../types'

const CONFIDENCE_OPTIONS = ['Confirmed', 'Probable', 'Possible', 'Unknown'].map((v) => ({
  value: v,
  label: v,
}))

interface Props {
  value?: SpecimenSpeciesCreate[]
  onChange?: (value: SpecimenSpeciesCreate[]) => void
}

export default function SpeciesAssociationForm({ value = [], onChange }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const { data: speciesList } = useSpecies(searchQuery || undefined)
  const { data: lifeStageOpts } = useLookupOptions('life_stage')
  const { data: sexOpts } = useLookupOptions('sex')
  const lifeStageOptions = (lifeStageOpts ?? []).map((o) => ({ value: o.value, label: o.value }))
  const sexOptions = (sexOpts ?? []).map((o) => ({ value: o.value, label: o.value }))

  const update = (assocs: SpecimenSpeciesCreate[]) => onChange?.(assocs)

  const addAssoc = () => {
    update([
      ...value,
      {
        species_id: undefined,
        free_text_species: undefined,
        specimen_count: null,
        life_stage: null,
        sex: null,
        confidence: 'Unknown',
        is_primary: value.length === 0,
      },
    ])
  }

  const removeAssoc = (index: number) => {
    const next = value.filter((_, i) => i !== index)
    if (next.length > 0 && !next.some((a) => a.is_primary)) {
      next[0] = { ...next[0], is_primary: true }
    }
    update(next)
  }

  const updateAssoc = (index: number, patch: Partial<SpecimenSpeciesCreate>) => {
    update(value.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  const setPrimary = (index: number) => {
    update(value.map((a, i) => ({ ...a, is_primary: i === index })))
  }

  return (
    <div>
      {value.map((assoc, index) => {
        const usesFreeText =
          assoc.species_id === undefined || assoc.species_id === null

        return (
          <Card key={index} size="small" style={{ marginBottom: 8 }}>
            <Row gutter={[8, 8]} align="middle">
              <Col span={10}>
                {usesFreeText ? (
                  <Input
                    placeholder="Free-text species name"
                    value={assoc.free_text_species || ''}
                    onChange={(e) =>
                      updateAssoc(index, {
                        free_text_species: e.target.value,
                        species_id: undefined,
                      })
                    }
                  />
                ) : (
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Search species..."
                    showSearch
                    filterOption={false}
                    onSearch={setSearchQuery}
                    value={assoc.species_id ?? undefined}
                    onChange={(v) =>
                      updateAssoc(index, {
                        species_id: v,
                        free_text_species: undefined,
                      })
                    }
                    options={speciesList?.map((s) => ({
                      value: s.id,
                      label: `${s.scientific_name}${s.common_name ? ` (${s.common_name})` : ''}`,
                    }))}
                  />
                )}
              </Col>
              <Col span={3}>
                <Button
                  size="small"
                  type="link"
                  onClick={() =>
                    usesFreeText
                      ? updateAssoc(index, {
                          species_id: 0,
                          free_text_species: undefined,
                        })
                      : updateAssoc(index, {
                          species_id: undefined,
                          free_text_species: '',
                        })
                  }
                  style={{ padding: 0, fontSize: 11 }}
                >
                  {usesFreeText ? 'Use lookup' : 'Free text'}
                </Button>
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
              <Col span={3}>
                <Checkbox
                  checked={assoc.is_primary}
                  onChange={() => setPrimary(index)}
                >
                  Primary
                </Checkbox>
              </Col>
              <Col span={1}>
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
    </div>
  )
}
