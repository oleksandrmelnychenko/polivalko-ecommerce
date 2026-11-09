import { useCallback, useState } from 'react'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getServices, type ServiceDirection } from '../api/contentApi'
import { ContentToolbar } from '../components/ContentToolbar'
import { servicesColumns } from '../components/contentColumns'
import { ListError } from '../components/ListError'
import { ServiceDirectionDrawer } from '../components/ServiceDirectionDrawer'
import './content.css'

const getRowId = (row: ServiceDirection) => row.code

export function ServicesPage() {
  const services = useApiQuery('content-services', () => getServices())
  const [editing, setEditing] = useState<{ direction: ServiceDirection | null; opened: boolean }>({ direction: null, opened: false })
  const failed = services.status === 'error' || services.status === 'forbidden'
  const rows = failed ? [] : (services.data ?? [])
  const onRowClick = useCallback((direction: ServiceDirection) => setEditing({ direction, opened: true }), [])

  function onSaved(direction: ServiceDirection) {
    const next = (services.data ?? []).map((item) => (item.code === direction.code ? direction : item))
    services.setData(next.sort((a, b) => a.sortOrder - b.sortOrder))
    setEditing({ direction, opened: false })
  }

  return (
    <ListPage>
      <PageHeader title="Напрямки послуг" />
      <ContentToolbar
        note="Сторінка послуг показує опис і фото біля назви напрямку. Напрямки стоять за полем «Порядок», від меншого числа до більшого."
        summary={services.data ? `Напрямків: ${services.data.length}` : null}
        isLoading={services.isFetching}
        onRefresh={services.reload}
      />
      <ListPageBody>
        <DataTable
          ariaLabel="Напрямки послуг"
          columns={servicesColumns}
          data={rows}
          getRowId={getRowId}
          isLoading={services.isLoading}
          isFetching={services.isFetching}
          minWidth={920}
          height="100%"
          onRowClick={onRowClick}
          emptyText={failed ? <ListError problem={services.problem} onRetry={services.reload} /> : 'Напрямків послуг немає.'}
        />
      </ListPageBody>
      <ServiceDirectionDrawer
        direction={editing.direction}
        opened={editing.opened}
        onClose={() => setEditing((current) => ({ ...current, opened: false }))}
        onSaved={onSaved}
      />
    </ListPage>
  )
}
