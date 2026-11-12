import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import type { AccountListItem } from '@/shared/sales/salesLookups'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableSortingState } from '@/shared/ui/data-table/types'
import { ListPageBody } from '@/shared/ui/ListPage'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getCustomers, type Customer } from '../api/customersApi'
import { sortingToSort, sortToSorting, toCustomersQuery } from '../lib/customersState'
import { useCustomersState } from '../lib/useCustomersState'
import { CustomerDetailPane } from './CustomerDetailPane'
import { CUSTOMERS_COLUMNS } from './customersColumns'
import { CustomersFilters } from './CustomersFilters'

const getRowId = (row: Customer) => row.phone
const countFormat = new Intl.NumberFormat('uk-UA')

export function OrderCustomersTab({ onOpenAccount }: { onOpenAccount: (account: AccountListItem) => void }) {
  const { can } = usePermissions()
  const canViewOrders = can(PermissionKeys.Orders.View)
  const { state, update } = useCustomersState()
  const query = useMemo(() => toCustomersQuery(state), [state])
  const customers = useApiQuery(`customers:${JSON.stringify(query)}`, () => getCustomers(query))
  const [params, setParams] = useSearchParams()
  const pickedPhone = params.get('id')

  const sorting = useMemo(() => sortToSorting(state.sort), [state.sort])
  const onSortingChange = useCallback((next: DataTableSortingState) => update({ sort: sortingToSort(next) }), [update])

  const page = customers.data
  const failed = customers.status === 'error' || customers.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const selected = rows.find((row) => row.phone === pickedPhone) ?? rows[0] ?? null
  const selectedPhone = selected?.phone ?? null

  const select = useCallback(
    (row: Customer) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('id', row.phone)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const rowClassName = useCallback((row: Customer) => (row.phone === selectedPhone ? 'app-split-row-active' : undefined), [selectedPhone])

  const emptyText = failed ? (
    <Stack align="center" gap={8}>
      <Text size="sm">{problemMessage(customers.problem, 'Не вдалося завантажити дані.')}</Text>
      <Button size="xs" variant="default" onClick={customers.reload}>
        Спробувати ще раз
      </Button>
    </Stack>
  ) : state.q ? (
    'За цим запитом покупців немає.'
  ) : (
    'Покупців ще немає.'
  )

  return (
    <>
      <CustomersFilters
        state={state}
        update={update}
        actions={
          <>
            {page ? <span className="app-filter-summary">Знайдено: {countFormat.format(page.totalItems)}</span> : null}
            <Paginator
              page={state.page}
              pageSize={state.pageSize}
              totalPages={page?.totalPages}
              isLoading={customers.isFetching}
              onPageChange={(next) => update({ page: next })}
              onPageSizeChange={(size) => update({ pageSize: size })}
              onRefresh={customers.reload}
            />
          </>
        }
      />

      <ListPageBody>
        <div className="app-split-layout">
          <div className="app-split-list">
            <DataTable
              ariaLabel="Покупці за замовленнями"
              columns={CUSTOMERS_COLUMNS}
              data={rows}
              getRowId={getRowId}
              isLoading={customers.isLoading}
              isFetching={customers.isFetching}
              minWidth={600}
              height="100%"
              manualSorting
              sorting={sorting}
              onSortingChange={onSortingChange}
              onRowClick={select}
              rowClassName={rowClassName}
              emptyText={emptyText}
            />
          </div>
          <CustomerDetailPane customer={selected} canViewOrders={canViewOrders} onOpenAccount={onOpenAccount} />
        </div>
      </ListPageBody>
    </>
  )
}
