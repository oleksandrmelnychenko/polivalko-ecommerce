import { Button, Stack, Text } from '@mantine/core'
import { IconDownload, IconShoppingBag, IconShoppingCart } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import { Can, usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifySummaryStale } from '@/shared/lib/events'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableSortingState } from '@/shared/ui/data-table/types'
import { usePageSelection } from '@/shared/ui/data-table/usePageSelection'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { changeOrderStatus, exportOrders, getOrderCounts, getOrders, type OrderRow } from '../api/ordersApi'
import { OrdersBulkBar } from '../components/OrdersBulkBar'
import { OpenCarts } from '../components/OpenCarts'
import { useSalesRefresh } from '../lib/useSalesRefresh'
import { OrdersBulkConfirm } from '../components/OrdersBulkConfirm'
import { ordersColumns } from '../components/ordersColumns'
import { OrdersFilters } from '../components/OrdersFilters'
import { OrdersStatusTabs } from '../components/OrdersStatusTabs'
import { hasActiveFilters, orderHref, sortingToSort, sortToSorting, toApiFilters, toListQuery } from '../lib/orderFilters'
import { statusProblemText } from '../lib/statusProblem'
import { useOrdersState } from '../lib/useOrdersState'
import '@/shared/sales/sales-list.css'
import './orders.css'

const getRowId = (row: OrderRow) => row.number
const countFormat = new Intl.NumberFormat('uk-UA')
const BULK_COMMENT = 'Масова зміна статусу'

export function OrdersPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { state, params, update, reset } = useOrdersState()
  const listQuery = useMemo(() => toListQuery(state), [state])
  const countsQuery = useMemo(() => toApiFilters(state), [state])
  const orders = useApiQuery(`orders:${JSON.stringify(listQuery)}`, () => getOrders(listQuery), { keepPrevious: true })
  const counts = useApiQuery(`orders-counts:${JSON.stringify(countsQuery)}`, () => getOrderCounts(countsQuery), { keepPrevious: true })
  const filtered = hasActiveFilters(state)
  const canChangeStatus = can(PermissionKeys.Orders.ChangeStatus)

  const page = orders.data
  const failed = orders.status === 'error' || orders.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const rowIds = useMemo(() => rows.map(getRowId), [rows])
  const { selected, select, clear: clearSelection } = usePageSelection(params.toString(), rowIds)
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showCarts, setShowCarts] = useState(false)
  useSalesRefresh(() => {
    if (!orders.isFetching && !counts.isFetching && !busy && !confirming && !showCarts) {
      orders.reload()
      counts.reload()
    }
  })

  const sorting = useMemo(() => sortToSorting(state.sort), [state.sort])
  const onSortingChange = useCallback((next: DataTableSortingState) => update({ sort: sortingToSort(next) }), [update])
  const onRowClick = useCallback((row: OrderRow) => navigate(orderHref(row.number)), [navigate])
  const tableSelection = useMemo(
    () =>
      canChangeStatus
        ? {
            selected,
            onChange: select,
            rowLabel: (id: string) => `Вибрати замовлення ${id}`,
          }
        : undefined,
    [canChangeStatus, selected, select],
  )

  function reloadAll() {
    orders.reload()
    counts.reload()
    notifySummaryStale()
  }

  async function applyBulk(cancelReason: string) {
    if (!bulkStatus) return
    const numbers = [...selected]
    if (numbers.length === 0) return
    const reason = bulkStatus === 'cancelled' ? cancelReason.trim() : BULK_COMMENT
    if (!reason) return
    setBusy(true)
    let done = 0
    const skipped: string[] = []
    for (const number of numbers) {
      try {
        const result = await withCsrf((headers) => changeOrderStatus(headers, number, { status: bulkStatus, reason }))
        if (result.data) done += 1
        else skipped.push(`${number}: ${statusProblemText(result.error, 'не змінено').replace(/\.$/, '')}`)
      } catch {
        skipped.push(`${number}: немає зв'язку з сервером`)
      }
    }
    setBusy(false)
    setConfirming(false)
    clearSelection()
    setBulkStatus(null)
    const label = orderStatusLabel[bulkStatus]
    if (skipped.length === 0) notifySuccess(`Статус «${label}» встановлено для ${done} з ${numbers.length}.`)
    else notifyError(`Статус «${label}» встановлено для ${done} з ${numbers.length}. Пропущено: ${skipped.join('; ')}.`)
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

  const emptyText = failed ? (
    <Stack align="center" gap={8}>
      <Text size="sm">{problemMessage(orders.problem, orders.status === 'forbidden' ? 'Недостатньо прав, щоб переглядати замовлення.' : 'Не вдалося завантажити замовлення.')}</Text>
      {orders.status === 'error' ? (
        <Button size="xs" variant="default" onClick={orders.reload}>
          Спробувати ще раз
        </Button>
      ) : null}
    </Stack>
  ) : filtered || state.status ? (
    'За цими умовами замовлень немає.'
  ) : (
    'Замовлень ще немає.'
  )

  return (
    <ListPage className="sales-list-page orders-list-page">
      <PageHeader title="Замовлення" />
      {showCarts && <OpenCarts onClose={() => setShowCarts(false)} />}
      <OrdersStatusTabs status={state.status} counts={counts.status === 'ready' ? counts.data : undefined} onChange={(status) => update({ status })} />
      <section className="orders-register" aria-labelledby="orders-register-title">
        <header className="orders-register-head">
          <h2 id="orders-register-title"><MetricLabel icon={IconShoppingBag}>Замовлення</MetricLabel></h2>
          <div className="orders-register-actions">
          <Button size="xs" radius="xl" leftSection={<IconShoppingCart size={16} />} onClick={() => setShowCarts(true)}>
            Відкриті кошики
          </Button>
          <Can permission={PermissionKeys.Orders.Export}>
            <Button size="xs" variant="default" radius="xl" leftSection={<IconDownload size={16} stroke={1.8} />} loading={exporting} onClick={exportCsv}>
              Експорт CSV
            </Button>
          </Can>
          </div>
        </header>

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
          minWidth={1120}
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
          onClear={clearSelection}
        />
      ) : null}

      </section>
      <OrdersBulkConfirm
        opened={confirming && selected.size > 0}
        status={bulkStatus}
        count={selected.size}
        busy={busy}
        onConfirm={(reason) => void applyBulk(reason)}
        onClose={() => setConfirming(false)}
      />
    </ListPage>
  )
}
