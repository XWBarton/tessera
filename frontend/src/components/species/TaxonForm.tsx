import { useEffect, useRef } from 'react'
import { Button, Form, Input, Modal, Segmented, Space, Tag, message } from 'antd'
import { useCreateSpecies } from '../../hooks/useSpecies'
import type { Species, TaxonRank } from '../../types'

export const RANK_OPTIONS: { value: TaxonRank; label: string }[] = [
  { value: 'species', label: 'Species' },
  { value: 'genus', label: 'Genus' },
  { value: 'family', label: 'Family' },
  { value: 'order', label: 'Order' },
]

type RankField = 'genus' | 'family' | 'order_name'
const RANK_FIELD: Record<Exclude<TaxonRank, 'species'>, RankField> = {
  genus: 'genus',
  family: 'family',
  order: 'order_name',
}

type TaxonKey = 'scientific_name' | 'common_name' | 'notes' | 'genus' | 'family' | 'order_name' | 'taxon_id' | 'rank'
export type TaxonValues = { [K in TaxonKey]?: Species[K] | null }

/** False for an entry like "Ixodes sp.", which stops at genus, family or order. */
export const isSpeciesRank = (s: Species) => (s.rank ?? 'species') === 'species'

/** Small tag marking an identification that stops above species level. */
export function RankTag({ rank }: { rank?: TaxonRank }) {
  if (!rank || rank === 'species') return null
  return (
    <Tag bordered={false} style={{ marginInlineStart: 6, fontSize: 11, lineHeight: '16px', fontStyle: 'normal' }}>
      {rank}
    </Tag>
  )
}

/** Best guess at rank/taxonomy from a bare name, e.g. "Ixodes sp." → genus Ixodes. Mirrors the backend. */
export function guessTaxon(name: string): TaxonValues {
  const n = name.trim()
  const words = n.split(/\s+/)
  const isSp = words.length === 2 && /^spp?\.?$/i.test(words[1])
  if (isSp && /(idae|aceae)$/i.test(words[0])) return { scientific_name: n, rank: 'family', family: words[0] }
  if (isSp) return { scientific_name: n, rank: 'genus', genus: words[0] }
  if (words.length >= 2 && /^[A-Z]/.test(words[0]) && /^[a-z]/.test(words[1])) {
    return { scientific_name: n, rank: 'species', genus: words[0] }
  }
  return { scientific_name: n, rank: 'species' }
}

/** A coarser identification carries no ranks below its own, so clear them explicitly. */
export function normaliseTaxon<T extends TaxonValues>(values: T): T {
  const out = { ...values }
  if (out.rank === 'family' || out.rank === 'order') out.genus = null
  if (out.rank === 'order') out.family = null
  return out
}

/** Form fields for a taxon. Must sit inside an antd <Form>. */
export function SpeciesFields() {
  const form = Form.useFormInstance()
  const rank: TaxonRank = Form.useWatch('rank', form) ?? 'species'
  const field = rank === 'species' ? undefined : RANK_FIELD[rank]
  const fieldValue: string | undefined = Form.useWatch(field ?? 'genus', form)
  const lastAuto = useRef<string | undefined>(undefined)

  // For a genus/family/order entry, keep the name in step with that rank ("Ixodes sp.")
  // until the user types a name of their own.
  useEffect(() => {
    if (!field) return
    const suggested = fieldValue?.trim() ? `${fieldValue.trim()} sp.` : undefined
    const current: string | undefined = form.getFieldValue('scientific_name')
    if (!current?.trim() || current === lastAuto.current) {
      form.setFieldValue('scientific_name', suggested)
    }
    lastAuto.current = suggested
  }, [field, fieldValue, form])

  const showGenus = rank === 'species' || rank === 'genus'
  const showFamily = rank !== 'order'

  return (
    <>
      <Form.Item
        name="rank"
        label="Identified to"
        initialValue="species"
        extra={rank !== 'species' ? 'Use this when the specimen can only be identified this far, e.g. "Ixodes sp.". Record doubt with the confidence on the specimen.' : undefined}
      >
        <Segmented options={RANK_OPTIONS} />
      </Form.Item>
      <Form.Item name="scientific_name" label="Name" rules={[{ required: true }]}>
        <Input placeholder={rank === 'species' ? 'e.g. Amblyomma triguttatum' : 'e.g. Ixodes sp.'} />
      </Form.Item>
      <Form.Item name="common_name" label="Common Name">
        <Input placeholder="e.g. Ornate Kangaroo Tick" />
      </Form.Item>
      {showGenus && (
        <Form.Item name="genus" label="Genus" rules={[{ required: rank === 'genus' }]}>
          <Input placeholder="e.g. Amblyomma" />
        </Form.Item>
      )}
      {showFamily && (
        <Form.Item name="family" label="Family" rules={[{ required: rank === 'family' }]}>
          <Input placeholder="e.g. Ixodidae" />
        </Form.Item>
      )}
      <Form.Item name="order_name" label="Order" rules={[{ required: rank === 'order' }]}>
        <Input placeholder="e.g. Ixodida" />
      </Form.Item>
      <Form.Item name="taxon_id" label="Taxon ID">
        <Input placeholder="e.g. NCBI:123456" />
      </Form.Item>
      <Form.Item name="notes" label="Notes">
        <Input.TextArea rows={2} />
      </Form.Item>
    </>
  )
}

/** "Add taxon" modal, available to every signed-in user. */
export function AddTaxonModal({ open, initial, onClose, onCreated }: {
  open: boolean
  initial?: TaxonValues
  onClose: () => void
  onCreated?: (s: Species) => void
}) {
  const create = useCreateSpecies()
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({ rank: 'species', ...initial })
    }
  }, [open, initial, form])

  const submit = async (values: TaxonValues & { scientific_name: string }) => {
    try {
      const s = await create.mutateAsync(normaliseTaxon(values))
      message.success(`Added ${s.scientific_name}`)
      onCreated?.(s)
      onClose()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to add taxon')
    }
  }

  return (
    <Modal title="Add to taxa" open={open} onCancel={onClose} footer={null} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={submit} preserve={false}>
        <SpeciesFields />
        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={create.isPending}>Add</Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
