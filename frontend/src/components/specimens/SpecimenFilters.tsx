import { Form, Input, Select, DatePicker, Button, Row, Col } from 'antd'
import { SearchOutlined, ClearOutlined } from '@ant-design/icons'
import { useProjects } from '../../hooks/useProjects'
import { useUsers } from '../../hooks/useUsers'
import { useSpecies } from '../../hooks/useSpecies'
import { useLookupOptions } from '../../hooks/useLookups'
import type { SpecimenFilters } from '../../types'
import dayjs from 'dayjs'

interface Props {
  onFiltersChange: (filters: Partial<SpecimenFilters>) => void
}

const CONFIDENCE_OPTIONS = ['Confirmed', 'Probable', 'Possible', 'Unknown'].map((v) => ({
  value: v,
  label: v,
}))

export default function SpecimenFilters({ onFiltersChange }: Props) {
  const [form] = Form.useForm()
  const { data: projects } = useProjects()
  const { data: users } = useUsers()
  const { data: species } = useSpecies()
  const { data: lifeStageOpts } = useLookupOptions('life_stage')
  const { data: sexOpts } = useLookupOptions('sex')

  const handleFinish = (values: Record<string, unknown>) => {
    const dateRange = values.date_range as [dayjs.Dayjs, dayjs.Dayjs] | null
    onFiltersChange({
      project_id: values.project_id as number | undefined,
      collector_id: values.collector_id as number | undefined,
      species_id: values.species_id as number | undefined,
      confidence: values.confidence as string | undefined,
      life_stage: values.life_stage as string | undefined,
      sex: values.sex as string | undefined,
      date_from: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
      date_to: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      search: (values.search as string) || undefined,
    })
  }

  const handleClear = () => {
    form.resetFields()
    onFiltersChange({
      project_id: undefined,
      collector_id: undefined,
      species_id: undefined,
      confidence: undefined,
      life_stage: undefined,
      sex: undefined,
      date_from: undefined,
      date_to: undefined,
      search: undefined,
    })
  }

  return (
    <Form
      form={form}
      onFinish={handleFinish}
      style={{
        marginBottom: 16,
        background: '#fff',
        padding: 16,
        borderRadius: 8,
      }}
    >
      <Row gutter={[8, 8]} align="middle">
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="search" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Search code, location, notes..."
              prefix={<SearchOutlined />}
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Form.Item name="project_id" style={{ marginBottom: 0 }}>
            <Select
              placeholder="Project"
              allowClear
              options={projects?.map((p) => ({ value: p.id, label: p.code }))}
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Form.Item name="collector_id" style={{ marginBottom: 0 }}>
            <Select
              placeholder="Collector"
              allowClear
              options={users?.map((u) => ({ value: u.id, label: u.full_name }))}
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Form.Item name="species_id" style={{ marginBottom: 0 }}>
            <Select
              placeholder="Species"
              allowClear
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={species?.map((s) => ({
                value: s.id,
                label: s.scientific_name,
              }))}
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Form.Item name="confidence" style={{ marginBottom: 0 }}>
            <Select
              placeholder="Confidence"
              allowClear
              options={CONFIDENCE_OPTIONS}
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Form.Item name="life_stage" style={{ marginBottom: 0 }}>
            <Select
              placeholder="Life Stage"
              allowClear
              options={lifeStageOpts?.map((o) => ({ value: o.value, label: o.value }))}
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Form.Item name="sex" style={{ marginBottom: 0 }}>
            <Select
              placeholder="Sex"
              allowClear
              options={sexOpts?.map((o) => ({ value: o.value, label: o.value }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="date_range" style={{ marginBottom: 0 }}>
            <DatePicker.RangePicker style={{ width: '100%' }} placeholder={['Collection from', 'Collection to']} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SearchOutlined />}
            style={{ marginRight: 8 }}
          >
            Filter
          </Button>
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            Clear
          </Button>
        </Col>
      </Row>
    </Form>
  )
}
