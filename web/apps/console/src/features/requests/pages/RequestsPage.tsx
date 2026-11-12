import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifySummaryStale } from '@/shared/lib/events'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifyError } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { changeServiceRequestStatus, getServiceRequestCounts, getServiceRequests, type RequestStatus, type ServiceRequest } from '../api/requestsApi'
import { RequestDetailPane } from '../components/RequestDetailPane'
import { REQUESTS_COLUMNS } from '../components/requestsColumns'
import { RequestsStatusTabs } from '../components/RequestsStatusTabs'
import { useRequestsState } from '../lib/useRequestsState'
import '@/shared/ui/split/split.css'

const getRowId = (row: ServiceRequest) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function RequestsPage() {
  const { can } = usePermissions()
  const canChange = can(PermissionKeys.Requests.ChangeStatus)
  const canViewOrders = can(PermissionKeys.Orders.View)
  const { state, update } = useRequestsState()
  const query = useMemo(() => ({ status: state.status || undefined, page: state.page, pageSize: state.pageSize }), [state])
  const requests = useApiQuery(`requests:${JSON.stringify(query)}`, () => getServiceRequests(query))
  const counts = useApiQuery('requests-counts', getServiceRequestCounts)
  const [pending, setPending] = useState<{ id: string; status: RequestStatus } | null>(null)
  const [changed, setChanged] = useState<ServiceRequest | null>(null)
  const [params, setParams] = useSearchParams()
  const pickedId = params.get('id')

  const page = requests.data
  const failed = requests.status === 'error' || requests.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const selected = rows.find((row) => row.id === pickedId) ?? (changed && changed.id === pickedId ? changed : null) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null

  const select = useCallback(
    (row: ServiceRequest) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('id', row.id)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const rowClassName = useCallback((row: ServiceRequest) => (row.id === selectedId ? 'app-split-row-active' : undefined), [selectedId])

  function reloadAll() {
    requests.reload()
    counts.reload()
    notifySummaryStale()
  }

  async function changeStatus(row: ServiceRequest, status: RequestStatus) {
    setPending({ id: row.id, status })
    select(row)
    try {
      const result = await withCsrf((headers) => changeServiceRequestStatus(headers, row.id, status))
      if (result.data) {
        const next = result.data
        setChanged(next)
        if (page) requests.setData({ ...page, items: page.items.map((item) => (item.id === next.id ? next : item)) })
        reloadAll()
      } else {
        notifyError(problemMessage(result.error, 'Статус не змінено.'))
      }
    } catch {
      notifyError(NETWORK_ERROR)
    } finally {
      setPending(null)
    }
  }

  const emptyText = failed ? (
    <Stack align="center" gap={8}>
      <Text size="sm">{problemMessage(requests.problem, 'Не вдалося завантажити дані.')}</Text>
      <Button size="xs" variant="default" onClick={requests.reload}>
        Спробувати ще раз
      </Button>
    </Stack>
  ) : state.status ? (
    'Заявок з цим статусом немає.'
  ) : (
    'Заявок немає. Вони приходять з форми на сторінці послуг.'
  )

  return (
    <ListPage>
      <PageHeader title="Заявки на послуги" />

      <RequestsStatusTabs status={state.status} counts={counts.data} onChange={(status) => update({ status })} />

      <FilterBar
        label="Сторінки заявок"
        actions={
          <>
            {page ? <span className="app-filter-summary">Знайдено: {countFormat.format(page.totalItems)}</span> : null}
            <Paginator
              page={state.page}
              pageSize={state.pageSize}
              totalPages={page?.totalPages}
              isLoading={requests.isFetching}
              onPageChange={(next) => update({ page: next })}
              onPageSizeChange={(size) => update({ pageSize: size })}
              onRefresh={reloadAll}
            />
          </>
        }
      />

      <ListPageBody>
        <div className="app-split-layout">
          <div className="app-split-list">
            <DataTable
              ariaLabel="Заявки на послуги"
              columns={REQUESTS_COLUMNS}
              data={rows}
              getRowId={getRowId}
              isLoading={requests.isLoading}
              isFetching={requests.isFetching}
              minWidth={620}
              height="100%"
              onRowClick={select}
              rowClassName={rowClassName}
              emptyText={emptyText}
            />
          </div>
          <RequestDetailPane
            request={selected}
            canChange={canChange}
            canViewOrders={canViewOrders}
            pendingStatus={pending && pending.id === selectedId ? pending.status : undefined}
            onChangeStatus={(row, status) => void changeStatus(row, status)}
          />
        </div>
      </ListPageBody>
    </ListPage>
  )
}
