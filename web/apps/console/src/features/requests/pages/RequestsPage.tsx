import { Button, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifySummaryStale } from '@/shared/lib/events'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifyError } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { FilterBar } from '@/shared/ui/FilterBar'
import { changeServiceRequestStatus, getServiceRequestCounts, getServiceRequests, type RequestStatus, type ServiceRequest } from '../api/requestsApi'
import { requestsColumns } from '../components/requestsColumns'
import { RequestsStatusTabs } from '../components/RequestsStatusTabs'
import { useRequestsState } from '../lib/useRequestsState'
import './requests.css'

const getRowId = (row: ServiceRequest) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')
const NO_PENDING: ReadonlyMap<string, RequestStatus> = new Map()

export function RequestsPage() {
  const { can } = usePermissions()
  const canChange = can(PermissionKeys.Requests.ChangeStatus)
  const { state, update } = useRequestsState()
  const query = useMemo(() => ({ status: state.status || undefined, page: state.page, pageSize: state.pageSize }), [state])
  const requests = useApiQuery(`requests:${JSON.stringify(query)}`, () => getServiceRequests(query))
  const counts = useApiQuery('requests-counts', getServiceRequestCounts)
  const [pending, setPending] = useState<ReadonlyMap<string, RequestStatus>>(NO_PENDING)

  const page = requests.data
  const rows = requests.status === 'error' || requests.status === 'forbidden' ? [] : (page?.items ?? [])

  function reloadAll() {
    requests.reload()
    counts.reload()
    notifySummaryStale()
  }

  async function changeStatus(row: ServiceRequest, status: RequestStatus) {
    setPending((current) => new Map(current).set(row.id, status))
    try {
      const result = await withCsrf((headers) => changeServiceRequestStatus(headers, row.id, status))
      if (result.data) {
        const changed = result.data
        if (page) requests.setData({ ...page, items: page.items.map((item) => (item.id === changed.id ? changed : item)) })
        reloadAll()
      } else {
        notifyError(problemMessage(result.error, 'Статус не змінено.'))
      }
    } catch {
      notifyError(NETWORK_ERROR)
    } finally {
      setPending((current) => {
        const next = new Map(current)
        next.delete(row.id)
        return next
      })
    }
  }

  const columns = requestsColumns({ canChange, pending, onChange: (row, status) => void changeStatus(row, status) })

  const emptyText =
    requests.status === 'error' ? (
      <Stack align="center" gap={8}>
        <Text size="sm">{problemMessage(requests.problem, 'Не вдалося завантажити дані.')}</Text>
        <Button size="xs" variant="default" onClick={requests.reload}>
          Спробувати ще раз
        </Button>
      </Stack>
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
        <DataTable
          ariaLabel="Заявки на послуги"
          columns={columns}
          data={rows}
          getRowId={getRowId}
          isLoading={requests.isLoading}
          isFetching={requests.isFetching}
          minWidth={960}
          height="100%"
          emptyText={emptyText}
        />
      </ListPageBody>
    </ListPage>
  )
}
