import { IconClipboardList } from '@tabler/icons-react'
import { SalesRegister } from '@/shared/sales/SalesRegister'
import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
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
import { PageState } from '@/shared/ui/PageState'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { changeServiceRequestStatus, getServiceRequest, getServiceRequestCounts, getServiceRequests, type RequestStatus, type ServiceRequest } from '../api/requestsApi'
import { RequestDetailPane } from '../components/RequestDetailPane'
import { requestsColumns } from '../components/requestsColumns'
import { RequestsStatusTabs } from '../components/RequestsStatusTabs'
import { useRequestsState } from '../lib/useRequestsState'
import '@/shared/ui/split/split.css'
import '@/shared/sales/sales-list.css'
import './requests.css'

const getRowId = (row: ServiceRequest) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function RequestsPage() {
  const { can } = usePermissions()
  const canChange = can(PermissionKeys.Requests.ChangeStatus)
  const canViewOrders = can(PermissionKeys.Orders.View)
  const { state, update } = useRequestsState()
  const query = useMemo(() => ({ status: state.status || undefined, page: state.page, pageSize: state.pageSize }), [state])
  const requests = useApiQuery(`requests:${JSON.stringify(query)}`, () => getServiceRequests(query), { keepPrevious: true })
  const counts = useApiQuery('requests-counts', getServiceRequestCounts)
  const [pending, setPending] = useState<{ id: string; status: RequestStatus } | null>(null)
  const [snapshot, setSnapshot] = useState<ServiceRequest | null>(null)
  const [params, setParams] = useSearchParams()
  const pickedId = params.get('id')

  const page = requests.data
  const failed = requests.status === 'error' || requests.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const local = rows.find((row) => row.id === pickedId) ?? (snapshot?.id === pickedId ? snapshot : null)
  const lookup = useApiQuery(`request:${pickedId}`, () => getServiceRequest(pickedId!), { enabled: Boolean(pickedId && !local && requests.status !== 'forbidden') })
  const selected = local ?? (lookup.status === 'ready' && lookup.data?.id === pickedId ? lookup.data : null)
  const detail = selected ?? snapshot
  const compact = useMediaQuery('(max-width: 48em)')

  const setRequestId = useCallback((id: string | null) => {
    // A filter navigation may already be in the URL while the table still renders its previous rows.
    const next = new URLSearchParams(window.location.search)
    if (id) next.set('id', id)
    else next.delete('id')
    setParams(next, { replace: true })
  }, [setParams])

  const select = useCallback((row: ServiceRequest) => {
    setSnapshot(row)
    setRequestId(row.id)
  }, [setRequestId])
  const columns = useMemo(() => requestsColumns(select, compact === true), [select, compact])

  function close() {
    if (pending) return
    if (selected) setSnapshot(selected)
    setRequestId(null)
  }

  function reloadAll() {
    requests.reload()
    counts.reload()
    notifySummaryStale()
  }

  async function changeStatus(row: ServiceRequest, status: RequestStatus) {
    setPending({ id: row.id, status })
    try {
      const result = await withCsrf((headers) => changeServiceRequestStatus(headers, row.id, status))
      if (result.data) {
        const next = result.data
        setSnapshot(next)
        if (page) requests.setData({ ...page, items: page.items.map((item) => (item.id === next.id ? next : item)) })
        lookup.setData(next)
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
    <ListPage className="sales-list-page requests-list-page">
      <PageHeader title="Заявки на послуги" />

      <RequestsStatusTabs status={state.status} counts={counts.status === 'ready' ? counts.data : undefined} onChange={(status) => update({ status })} />

      <SalesRegister title="Заявки на послуги" icon={IconClipboardList}>
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
            minWidth={compact ? 255 : 670}
            height="100%"
            onRowClick={select}
            emptyText={emptyText}
          />
        </ListPageBody>
      </SalesRegister>

      {pickedId && !selected && requests.status !== 'forbidden' && (
        <AppEditorModal opened title="Заявка на послугу" onClose={close}>
          <PageState kind={lookup.status === 'ready' ? 'empty' : lookup.status}
            title={lookup.problem?.status === 404 ? 'Заявку не знайдено' : undefined}
            onRetry={lookup.status === 'error' && lookup.problem?.status !== 404 ? lookup.reload : undefined} />
        </AppEditorModal>
      )}
      {detail && requests.status !== 'forbidden' && (
        <RequestDetailPane
          opened={Boolean(selected)}
          request={detail}
          canChange={canChange}
          canViewOrders={canViewOrders}
          pendingStatus={pending?.id === detail.id ? pending.status : undefined}
          onClose={close}
          onChangeStatus={(row, status) => void changeStatus(row, status)}
        />
      )}
    </ListPage>
  )
}
