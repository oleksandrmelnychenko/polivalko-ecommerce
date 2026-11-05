import { Button, Stack, Text } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { plural } from '@polivalko/shared/lib/format'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import { Can, usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifySummaryStale } from '@/shared/lib/events'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableSortingState } from '@/shared/ui/data-table/types'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { changeOrderStatus, exportOrders, getOrderCounts, getOrders, type OrderRow } from '../api/ordersApi'
import { OrdersBulkBar } from '../components/OrdersBulkBar'
import { ordersColumns } from '../components/ordersColumns'
import { OrdersFilters } from '../components/OrdersFilters'
import { OrdersStatusTabs } from '../components/OrdersStatusTabs'
import { hasActiveFilters, orderHref, sortingToSort, sortToSorting, toApiFilters, toListQuery } from '../lib/orderFilters'
import { useOrdersState } from '../lib/useOrdersState'
import './orders.css'

const getRowId = (row: OrderRow) => row.number
const countFormat = new Intl.NumberFormat('uk-UA')

export function OrdersPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { state, params, update, reset } = useOrdersState()
  const listQuery = useMemo(() => toListQuery(state), [state])
  const countsQuery = useMemo(() => toApiFilters(state), [state])
  const orders = useApiQuery(`orders:${JSON.stringify(listQuery)}`, () => getOrders(listQuery))
  const counts = useApiQuery(`orders-counts:${JSON.stringify(countsQuery)}`, () => getOrderCounts(countsQuery))
  const filtered = hasActiveFilters(state)
  const canChangeStatus = can(PermissionKeys.Orders.ChangeStatus)

  const selectionKey = params.toString()
  const [selection, setSelection] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: selectionKey, ids: new Set() })
  const selected = selection.key === selectionKey ? selection.ids : EMPTY_SELECTION
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const sorting = useMemo(() => sortToSorting(state.sort), [state.sort])
  const onSortingChange = useCallback((next: DataTableSortingState) => update({ sort: sortingToSort(next) }), [update])
  const onRowClick = useCallback((row: OrderRow) => navigate(orderHref(row.number)), [navigate])
  const tableSelection = useMemo(
    () =>
      canChangeStatus
        ? {
            selected,
            onChange: (ids: ReadonlySet<string>) => setSelection({ key: selectionKey, ids }),
            rowLabel: (id: string) => `Вибрати замовлення ${id}`,
          }
        : undefined,
    [canChangeStatus, selected, selectionKey],
  )

  const page = orders.data
  const rows = orders.status === 'error' || orders.status === 'forbidden' ? [] : (page?.items ?? [])

  function reloadAll() {
    orders.reload()
    counts.reload()
    notifySummaryStale()
  }

  async function applyBulk() {
    if (!bulkStatus) return
    const numbers = [...selected]
    setBusy(true)
    let done = 0
    const failed: string[] = []
    for (const number of numbers) {
      try {
        const result = await withCsrf((headers) => changeOrderStatus(headers, number, { status: bulkStatus, reason: 'Масова зміна статусу' }))
        if (result.data) done += 1
        else failed.push(`${number}: ${problemMessage(result.error, 'не змінено')}`)
      } catch {
        failed.push(`${number}: немає зв'язку з сервером`)
      }
    }
    setBusy(false)
    setConfirming(false)
    setSelection({ key: selectionKey, ids: new Set() })
    setBulkStatus(null)
    const label = orderStatusLabel[bulkStatus]
    if (failed.length === 0) notifySuccess(`Статус «${label}» встановлено для ${done} з ${numbers.length}.`)
    else notifyError(`Статус «${label}» встановлено для ${done} з ${numbers.length}. Пропущено: ${failed.join('; ')}.`)
    reloadAll()
  }

  async function exportCsv() {
    setExporting(true)
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...listQuery, page: undefined, pageSize: undefined })) {
      if (value !== undefined && value !== '') search.set(key, String(value))
    }
    const ok = await exportOrders(search).catch(() => false)
    setExporting(false)
    if (!ok) notifyError('Не вдалося вивантажити CSV. Спробуйте ще раз.')
  }

  const emptyText =
    orders.status === 'error' ? (
      <Stack align="center" gap={8}>
        <Text size="sm">{problemMessage(orders.problem, 'Не вдалося завантажити замовлення.')}</Text>
        <Button size="xs" variant="default" onClick={orders.reload}>
          Спробувати ще раз
        </Button>
      </Stack>
    ) : filtered || state.status ? (
      'За цими умовами замовлень немає.'
    ) : (
      'Замовлень ще немає.'
    )

  return (
    <ListPage>
      <PageHeader
        title="Замовлення"
        actions={
          <Can permission={PermissionKeys.Orders.Export}>
            <Button variant="default" leftSection={<IconDownload size={16} stroke={1.8} />} loading={exporting} onClick={exportCsv}>
              Експорт CSV
            </Button>
          </Can>
        }
      />

      <OrdersStatusTabs status={state.status} counts={counts.data} onChange={(status) => update({ status })} />

      <OrdersFilters
        state={state}
        filtered={filtered}
        update={update}
        reset={reset}
        actions={
          <>
            {page ? <span className="app-filter-summary">Знайдено: {countFormat.format(page.totalItems)}</span> : null}
            <Paginator
              page={state.page}
              pageSize={state.pageSize}
              totalPages={page?.totalPages}
              isLoading={orders.isFetching}
              onPageChange={(next) => update({ page: next })}
              onPageSizeChange={(size) => update({ pageSize: size })}
              onRefresh={reloadAll}
            />
          </>
        }
      />

      <ListPageBody>
        <DataTable
          ariaLabel="Замовлення"
          columns={ordersColumns}
          data={rows}
          getRowId={getRowId}
          isLoading={orders.isLoading}
          isFetching={orders.isFetching}
          minWidth={980}
          height="100%"
          manualSorting
          sorting={sorting}
          onSortingChange={onSortingChange}
          onRowClick={onRowClick}
          selection={tableSelection}
          emptyText={emptyText}
        />
      </ListPageBody>

      {selected.size > 0 ? (
        <OrdersBulkBar
          count={selected.size}
          status={bulkStatus}
          busy={busy}
          onStatus={setBulkStatus}
          onApply={() => setConfirming(true)}
          onClear={() => setSelection({ key: selectionKey, ids: new Set() })}
        />
      ) : null}

      <ConfirmDialog
        opened={confirming}
        title="Змінити статус"
        message={bulkStatus ? `Встановити статус «${orderStatusLabel[bulkStatus]}» для ${selected.size} ${plural(selected.size, 'замовлення', 'замовлення', 'замовлень')}?` : ''}
        confirmLabel="Змінити статус"
        busy={busy}
        onConfirm={() => void applyBulk()}
        onClose={() => setConfirming(false)}
      />
    </ListPage>
  )
}

const EMPTY_SELECTION: ReadonlySet<string> = new Set()
