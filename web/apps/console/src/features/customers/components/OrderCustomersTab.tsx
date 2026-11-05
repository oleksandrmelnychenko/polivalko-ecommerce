import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableSortingState } from '@/shared/ui/data-table/types'
import { ListPageBody } from '@/shared/ui/ListPage'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getCustomers, type Customer } from '../api/customersApi'
import { ordersOfCustomerHref, sortingToSort, sortToSorting, toCustomersQuery } from '../lib/customersState'
import { useCustomersState } from '../lib/useCustomersState'
import { customersColumns } from './customersColumns'
import { CustomersFilters } from './CustomersFilters'

const getRowId = (row: Customer) => row.phone
const countFormat = new Intl.NumberFormat('uk-UA')

export function OrderCustomersTab() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canViewOrders = can(PermissionKeys.Orders.View)
  const { state, update } = useCustomersState()
  const query = useMemo(() => toCustomersQuery(state), [state])
  const customers = useApiQuery(`customers:${JSON.stringify(query)}`, () => getCustomers(query))

  const columns = useMemo(() => customersColumns(canViewOrders), [canViewOrders])
  const sorting = useMemo(() => sortToSorting(state.sort), [state.sort])
  const onSortingChange = useCallback((next: DataTableSortingState) => update({ sort: sortingToSort(next) }), [update])
  const onRowClick = useCallback((row: Customer) => navigate(ordersOfCustomerHref(row.phone)), [navigate])

  const page = customers.data
  const rows = customers.status === 'error' || customers.status === 'forbidden' ? [] : (page?.items ?? [])

  const emptyText =
    customers.status === 'error' ? (
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
        <DataTable
          ariaLabel="Покупці за замовленнями"
          columns={columns}
          data={rows}
          getRowId={getRowId}
          isLoading={customers.isLoading}
          isFetching={customers.isFetching}
          minWidth={1040}
          height="100%"
          manualSorting
          sorting={sorting}
          onSortingChange={onSortingChange}
          onRowClick={canViewOrders ? onRowClick : undefined}
          emptyText={emptyText}
        />
      </ListPageBody>
    </>
  )
}
