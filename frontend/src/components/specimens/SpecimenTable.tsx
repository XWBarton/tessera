import { Table, Tag, Button, Space } from 'antd'
import { EyeOutlined, EditOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { Specimen, SpecimenList } from '../../types'

const CONFIDENCE_COLORS: Record<string, string> = {
  Confirmed: 'green',
  Probable: 'blue',
  Possible: 'orange',
  Unknown: 'default',
}

interface Props {
  data?: SpecimenList
  loading: boolean
  onPageChange: (page: number, pageSize: number) => void
  onSelectionChange: (ids: number[]) => void
  currentPage: number
  pageSize: number
}

export default function SpecimenTable({
  data,
  loading,
  onPageChange,
  onSelectionChange,
  currentPage,
  pageSize,
}: Props) {
  const navigate = useNavigate()

  const columns = [
    {
      title: 'Code',
      dataIndex: 'specimen_code',
      key: 'specimen_code',
      render: (c: string, r: Specimen) => (
        <a onClick={() => navigate(`/specimens/${r.id}`)}>{c}</a>
      ),
    },
    {
      title: 'Project',
      key: 'project',
      render: (_: unknown, r: Specimen) =>
        r.project ? <Tag color="green">{r.project.code}</Tag> : '—',
    },
    {
      title: 'Date',
      dataIndex: 'collection_date',
      key: 'collection_date',
    },
    {
      title: 'Collector',
      key: 'collector',
      render: (_: unknown, r: Specimen) =>
        r.collector?.full_name || r.collector_name || <em style={{ color: '#bbb' }}>Unknown</em>,
    },
    {
      title: 'Primary Species',
      key: 'species',
      render: (_: unknown, r: Specimen) => {
        const primary = r.species_associations.find((a) => a.is_primary)
        if (!primary) return '—'
        const name =
          primary.species?.scientific_name || primary.free_text_species || '—'
        return (
          <Tag color={CONFIDENCE_COLORS[primary.confidence]}>
            <em>{name}</em>
          </Tag>
        )
      },
    },
    {
      title: 'Storage',
      dataIndex: 'storage_location',
      key: 'storage_location',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: Specimen) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/specimens/${r.id}`)}
          >
            View
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/specimens/${r.id}/edit`)}
          >
            Edit
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Table
      dataSource={data?.items}
      columns={columns}
      rowKey="id"
      loading={loading}
      rowSelection={{
        type: 'checkbox',
        onChange: (_, rows) => onSelectionChange(rows.map((r) => r.id)),
      }}
      pagination={{
        current: currentPage,
        pageSize,
        total: data?.total,
        showSizeChanger: true,
        showTotal: (total) => `${total} tubes`,
        onChange: onPageChange,
      }}
    />
  )
}
