import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Space, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useSpecimens } from '../hooks/useSpecimens'
import SpecimenTable from '../components/specimens/SpecimenTable'
import SpecimenFilters from '../components/specimens/SpecimenFilters'
import type { SpecimenFilters as Filters } from '../types'
import { bulkDownloadLabels } from '../api/specimens'

export default function SpecimensPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<Filters>({
    skip: 0,
    limit: 50,
    sort_by: 'created_at',
    sort_dir: 'desc',
  })
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const { data, isLoading } = useSpecimens(filters)

  const handleFiltersChange = (newFilters: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, skip: 0 }))
  }

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters((prev) => ({ ...prev, skip: (page - 1) * pageSize, limit: pageSize }))
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          Tubes
        </Typography.Title>
        <Space>
          {selectedIds.length > 0 && (
            <>
              <Button
                onClick={() =>
                  bulkDownloadLabels(selectedIds, 'zpl').then(() =>
                    message.success('ZPL labels downloaded')
                  )
                }
              >
                ZPL Labels ({selectedIds.length})
              </Button>
              <Button
                onClick={() =>
                  bulkDownloadLabels(selectedIds, 'csv').then(() =>
                    message.success('CSV labels downloaded')
                  )
                }
              >
                CSV Labels ({selectedIds.length})
              </Button>
            </>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/specimens/new')}
          >
            New Tube
          </Button>
        </Space>
      </div>
      <SpecimenFilters onFiltersChange={handleFiltersChange} />
      <SpecimenTable
        data={data}
        loading={isLoading}
        onPageChange={handlePageChange}
        onSelectionChange={setSelectedIds}
        currentPage={Math.floor((filters.skip || 0) / (filters.limit || 50)) + 1}
        pageSize={filters.limit || 50}
      />
    </div>
  )
}
