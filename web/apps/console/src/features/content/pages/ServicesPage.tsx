import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getServices, type ServiceDirection } from '../api/contentApi'
import { ContentToolbar } from '../components/ContentToolbar'
import { servicesColumns } from '../components/contentColumns'
import { ListError } from '../components/ListError'
import { ServiceDetailPane } from '../components/ServiceDetailPane'
import { ServiceDirectionDrawer } from '../components/ServiceDirectionDrawer'
import '@/shared/ui/split/split.css'
import './content.css'

const getRowId = (row: ServiceDirection) => row.code

export function ServicesPage() {
  const services = useApiQuery('content-services', () => getServices())
  const [editing, setEditing] = useState<{ direction: ServiceDirection | null; opened: boolean }>({ direction: null, opened: false })
  const failed = services.status === 'error' || services.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : [...(services.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)), [failed, services.data])
  const visible = useMemo(() => rows.filter((row) => row.isVisible), [rows])
  const openEditor = useCallback((direction: ServiceDirection) => setEditing({ direction, opened: true }), [])
  const [params, setParams] = useSearchParams()
  const picked = params.get('code')
  const selected = rows.find((row) => row.code === picked) ?? rows[0] ?? null
  const selectedCode = selected?.code ?? null
  const selectDirection = useCallback(
    (row: ServiceDirection) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('code', row.code)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const rowClassName = useCallback((row: ServiceDirection) => (row.code === selectedCode ? 'app-split-row-active' : undefined), [selectedCode])

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
        <div className="app-split-layout">
          <div className="app-split-list">
            <DataTable
              ariaLabel="Напрямки послуг"
              columns={servicesColumns}
              data={rows}
              getRowId={getRowId}
              isLoading={services.isLoading}
              isFetching={services.isFetching}
              minWidth={500}
              height="100%"
              onRowClick={selectDirection}
              rowClassName={rowClassName}
              emptyText={failed ? <ListError problem={services.problem} onRetry={services.reload} /> : 'Напрямків послуг немає.'}
            />
          </div>
          <ServiceDetailPane
            direction={selected}
            position={selected ? visible.findIndex((row) => row.code === selected.code) + 1 : 0}
            visibleCount={visible.length}
            onEdit={openEditor}
          />
        </div>
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
