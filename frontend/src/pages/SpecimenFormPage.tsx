import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Form,
  Input,
  Select,
  AutoComplete,
  DatePicker,
  InputNumber,
  Button,
  Space,
  Typography,
  Card,
  message,
  Spin,
  Row,
  Col,
  Radio,
  Alert,
} from 'antd'
import dayjs from 'dayjs'
import { useProjects } from '../hooks/useProjects'
import { useUsers } from '../hooks/useUsers'
import { useSites } from '../hooks/useSites'
import { useSampleTypes } from '../hooks/useSampleTypes'
import { useSpecimen, useCreateSpecimen, useUpdateSpecimen } from '../hooks/useSpecimens'
import { useAuth } from '../context/AuthContext'
import SpeciesAssociationForm from '../components/specimens/SpeciesAssociationForm'
import type { SpecimenCreate, SpecimenUpdate, SpecimenSpeciesCreate, Site } from '../types'
import { useLookupOptions } from '../hooks/useLookups'

type CollectorMode = 'user' | 'name' | 'unknown'

export default function SpecimenFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const isEdit = !!id
  const specimenId = Number(id)
  const [form] = Form.useForm()
  const [collectorMode, setCollectorMode] = useState<CollectorMode>('user')

  const { data: projects } = useProjects()
  const { data: users } = useUsers()
  const { data: sites } = useSites()
  const { data: sampleTypes } = useSampleTypes()
  const { data: specimen, isLoading: loadingSpecimen } = useSpecimen(specimenId)
  const createSpecimen = useCreateSpecimen()
  const updateSpecimen = useUpdateSpecimen(specimenId)
  const { data: unitOpts } = useLookupOptions('unit')
  const unitOptions = (unitOpts ?? []).map((o) => ({ value: o.value }))

  // Watch species associations to derive total count
  const watchedAssociations: SpecimenSpeciesCreate[] = Form.useWatch('species_associations', form) || []
  const derivedTotal = watchedAssociations.reduce((sum, a) => sum + (a.specimen_count || 0), 0)
  const watchedSampleTypeId: number | undefined = Form.useWatch('sample_type_id', form)
  const watchedProjectId: number | undefined = Form.useWatch('project_id', form)
  const filteredSites = sites?.filter((s) =>
    !s.projects?.length || s.projects.some((p) => p.id === watchedProjectId)
  ) ?? []
  const selectedSampleType = sampleTypes?.find((st) => st.id === watchedSampleTypeId)
  const usesDerivedQuantity = selectedSampleType?.is_specimen === true

  useEffect(() => {
    if (isEdit && specimen) {
      const mode: CollectorMode = specimen.collector_id
        ? 'user'
        : specimen.collector_name
        ? 'name'
        : 'unknown'
      setCollectorMode(mode)
      form.setFieldsValue({
        project_id: specimen.project_id,  // pre-select current project for admin edit
        collector_id: specimen.collector_id,
        collector_name: specimen.collector_name,
        collection_date_range_start: specimen.collection_date ? dayjs(specimen.collection_date) : undefined,
        collection_date_range_end: specimen.collection_date_end ? dayjs(specimen.collection_date_end) : undefined,
        site_ids: specimen.sites?.map(s => s.id) ?? [],
        sample_type_id: specimen.sample_type_id,
        quantity_value: specimen.quantity_value,
        quantity_unit: specimen.quantity_unit,
        collection_lat: specimen.collection_lat,
        collection_lon: specimen.collection_lon,
        collection_location_text: specimen.collection_location_text,
        storage_location: specimen.storage_location,
        preservation_method: specimen.preservation_method,
        status: specimen.status || 'active',
        notes: specimen.notes,
        species_associations: specimen.species_associations.map((a) => ({
          species_id: a.species_id,
          free_text_species: a.free_text_species,
          specimen_count: a.specimen_count ?? null,
          life_stage: a.life_stage ?? null,
          sex: a.sex ?? null,
          confidence: a.confidence,
        })),
      })
    } else if (!isEdit) {
      setCollectorMode('user')
      const codeParam = searchParams.get('code')
      form.setFieldsValue({
        collector_id: user?.id,
        species_associations: [],
        ...(codeParam ? { specimen_code: codeParam } : {}),
      })
    }
  }, [isEdit, specimen, form, user, searchParams])

  if (isEdit && loadingSpecimen) return <Spin />

  const handleSiteChange = (siteId: number | undefined) => {
    if (!siteId || !sites) return
    const site: Site | undefined = sites.find((s) => s.id === siteId)
    if (!site) return
    // Auto-fill coords/description from the first selected site if not already set
    if (!form.getFieldValue('collection_lat') && site.lat) {
      form.setFieldsValue({
        collection_lat: site.lat,
        collection_lon: site.lon,
        collection_location_text: form.getFieldValue('collection_location_text') || site.description || site.name,
      })
    }
  }

  const onFinish = async (values: Record<string, unknown>) => {
    const collectionDate = values.collection_date_range_start
      ? dayjs(values.collection_date_range_start as string).format('YYYY-MM-DD')
      : undefined
    const collectionDateEnd = values.collection_date_range_end
      ? dayjs(values.collection_date_range_end as string).format('YYYY-MM-DD')
      : undefined
    const speciesAssociations = (
      (values.species_associations as SpecimenSpeciesCreate[]) || []
    ).filter((a) => a.species_id || a.free_text_species)

    const collectorId = collectorMode === 'user' ? (values.collector_id as number | undefined) : undefined
    const collectorName = collectorMode === 'name' ? (values.collector_name as string | undefined) : undefined

    // If species counts drive the total, use their sum as quantity_value
    const quantity_value = usesDerivedQuantity
      ? derivedTotal
      : (values.quantity_value as number | undefined)
    const quantity_unit = values.quantity_unit as string | undefined

    try {
      if (isEdit) {
        const updatePayload: SpecimenUpdate = {
          project_id: user?.is_admin ? (values.project_id as number | undefined) : undefined,
          collection_date: collectionDate,
          collection_date_end: collectionDateEnd,
          collector_id: collectorId,
          collector_name: collectorName,
          site_ids: (values.site_ids as number[] | undefined) ?? [],
          sample_type_id: values.sample_type_id as number | undefined,
          quantity_value,
          quantity_unit,
          collection_lat: values.collection_lat as number | undefined,
          collection_lon: values.collection_lon as number | undefined,
          collection_location_text: values.collection_location_text as string | undefined,
          storage_location: values.storage_location as string | undefined,
          preservation_method: values.preservation_method as string | undefined,
          status: values.status as string | undefined,
          notes: values.notes as string | undefined,
          species_associations: speciesAssociations,
        }
        await updateSpecimen.mutateAsync(updatePayload)
        message.success('Tube updated')
        navigate(`/specimens/${specimenId}`)
      } else {
        const createPayload: SpecimenCreate = {
          specimen_code: (values.specimen_code as string | undefined) || undefined,
          project_id: values.project_id as number,
          collection_date: collectionDate,
          collection_date_end: collectionDateEnd,
          collector_id: collectorId,
          collector_name: collectorName,
          site_ids: (values.site_ids as number[] | undefined) ?? [],
          sample_type_id: values.sample_type_id as number | undefined,
          quantity_value,
          quantity_unit,
          collection_lat: values.collection_lat as number | undefined,
          collection_lon: values.collection_lon as number | undefined,
          collection_location_text: values.collection_location_text as string | undefined,
          storage_location: values.storage_location as string | undefined,
          preservation_method: values.preservation_method as string | undefined,
          status: values.status as string | undefined,
          notes: values.notes as string | undefined,
          species_associations: speciesAssociations,
        }
        const created = await createSpecimen.mutateAsync(createPayload)
        message.success(`Tube ${created.specimen_code} created`)
        navigate(`/specimens/${created.id}`)
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || 'Failed to save tube')
    }
  }

  return (
    <div>
      <Typography.Title level={3}>
        {isEdit ? 'Edit Tube' : 'New Tube'}
      </Typography.Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {!isEdit && (
            <Form.Item name="project_id" label="Project" rules={[{ required: true }]}>
              <Select
                placeholder="Select project"
                options={projects?.map((p) => ({
                  value: p.id,
                  label: `${p.code} — ${p.name}`,
                }))}
              />
            </Form.Item>
          )}
          {!isEdit && user?.is_admin && (
            <Form.Item
              name="specimen_code"
              label="Custom Code"
              help="Leave blank to auto-generate (e.g. PROJ-042)"
            >
              <Input placeholder="e.g. XPG-333" style={{ maxWidth: 200 }} />
            </Form.Item>
          )}
          {isEdit && !user?.is_admin && (
            <Form.Item label="Project">
              <Input disabled value={`${specimen?.project?.code} — ${specimen?.project?.name}`} />
            </Form.Item>
          )}
          {isEdit && user?.is_admin && (
            <Form.Item name="project_id" label="Project">
              <Select
                options={projects?.map((p) => ({
                  value: p.id,
                  label: `${p.code} — ${p.name}`,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item label="Collector">
            <Radio.Group
              value={collectorMode}
              onChange={(e) => setCollectorMode(e.target.value)}
              style={{ marginBottom: 8 }}
            >
              <Radio.Button value="user">Registered user</Radio.Button>
              <Radio.Button value="name">External / free text</Radio.Button>
              <Radio.Button value="unknown">Unknown</Radio.Button>
            </Radio.Group>
            {collectorMode === 'user' && (
              <Form.Item name="collector_id" noStyle>
                <Select
                  placeholder="Select collector"
                  allowClear
                  options={users?.map((u) => ({ value: u.id, label: u.full_name }))}
                />
              </Form.Item>
            )}
            {collectorMode === 'name' && (
              <Form.Item name="collector_name" noStyle rules={[{ required: true, message: 'Enter collector name' }]}>
                <Input placeholder="Collector's name" />
              </Form.Item>
            )}
            {collectorMode === 'unknown' && (
              <Input disabled value="Unknown" />
            )}
          </Form.Item>

          {isEdit && specimen?.entered_by && (
            <Form.Item label="Entered by">
              <Input disabled value={specimen.entered_by.full_name} />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="collection_date_range_start" label="Collection Date (start)">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="collection_date_range_end" label="Collection Date (end)">
                <DatePicker style={{ width: '100%' }} placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="sample_type_id" label="Sample Type">
                <Select
                  placeholder="Select type"
                  allowClear
                  options={sampleTypes?.map((st) => ({ value: st.id, label: st.name }))}
                />
              </Form.Item>
            </Col>
            {usesDerivedQuantity ? (
              <>
                <Col span={8}>
                  <Form.Item label="Quantity (from species breakdown)">
                    <InputNumber
                      style={{ width: '100%' }}
                      value={derivedTotal}
                      disabled
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="quantity_unit" label="Unit">
                    <AutoComplete
                      options={unitOptions}
                      placeholder="Select or type"
                      filterOption={(input, option) =>
                        (option?.value as string).toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </Form.Item>
                </Col>
              </>
            ) : (
              <>
                <Col span={8}>
                  <Form.Item name="quantity_value" label="Quantity">
                    <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="e.g. 5" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="quantity_unit" label="Unit">
                    <AutoComplete
                      options={unitOptions}
                      placeholder="Select or type"
                      filterOption={(input, option) =>
                        (option?.value as string).toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          <Form.Item
            name="site_ids"
            label="Collection Sites"
            extra={watchedProjectId && sites && filteredSites.length < sites.length
              ? `Showing ${filteredSites.length} site${filteredSites.length !== 1 ? 's' : ''} for this project (untagged sites always shown)`
              : undefined}
          >
            <Select
              mode="multiple"
              placeholder="Select one or more sites (optional)"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              onChange={(ids: number[]) => {
                if (ids.length > 0) handleSiteChange(ids[0])
              }}
              options={filteredSites.map((s) => ({
                value: s.id,
                label: s.habitat_type ? `${s.name} (${s.habitat_type})` : s.name,
              }))}
            />
          </Form.Item>

          <Form.Item name="collection_location_text" label="Location Description">
            <Input placeholder="e.g. Wetland near creek, 200m from road" />
          </Form.Item>
          <Form.Item name="collection_lat" hidden><Input /></Form.Item>
          <Form.Item name="collection_lon" hidden><Input /></Form.Item>

          <Form.Item name="storage_location" label="Storage Location">
            <Input placeholder="e.g. Freezer-A1, Shelf-3" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="preservation_method" label="Preservation Method">
                <Select
                  placeholder="Select method"
                  allowClear
                  options={[
                    { value: 'Ethanol', label: 'Ethanol' },
                    { value: 'RNAlater', label: 'RNAlater' },
                    { value: 'Frozen (-20°C)', label: 'Frozen (-20°C)' },
                    { value: 'Frozen (-80°C)', label: 'Frozen (-80°C)' },
                    { value: 'Dried', label: 'Dried' },
                    { value: 'Formalin', label: 'Formalin' },
                    { value: 'Other', label: 'Other' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'depleted', label: 'Depleted' },
                    { value: 'loaned', label: 'Loaned' },
                    { value: 'vouchered', label: 'Vouchered' },
                    { value: 'destroyed', label: 'Destroyed' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="species_associations" label="Species Associations">
            <SpeciesAssociationForm />
          </Form.Item>

          {usesDerivedQuantity && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Total quantity will be set to ${derivedTotal} (sum of species breakdown counts)`}
            />
          )}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createSpecimen.isPending || updateSpecimen.isPending}
              >
                {isEdit ? 'Update Tube' : 'Create Tube'}
              </Button>
              <Button onClick={() => navigate(-1)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
