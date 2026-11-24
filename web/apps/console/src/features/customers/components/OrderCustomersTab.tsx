import { SalesRegister } from '@/shared/sales/SalesRegister'
import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { IconUser } from '@tabler/icons-react'
import { useCustomerSelection } from '../lib/useCustomerSelection'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
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
import { customersColumns } from './customersColumns'
import { CustomersFilters } from './CustomersFilters'

const getRowId = (row: Customer) => row.phone
const countFormat = new Intl.NumberFormat('uk-UA')

export function OrderCustomersTab({ onOpenAccount }: { onOpenAccount: (account: AccountListItem) => void }) {
  const { can } = usePermissions()
  const canViewOrders = can(PermissionKeys.Orders.View)
  const { state, update } = useCustomersState()
  const query = useMemo(() => toCustomersQuery(state), [state])
  const customers = useApiQuery(`customers:${JSON.stringify(query)}`, () => getCustomers(query), { keepPrevious: true })
  const { id, setId } = useCustomerSelection()
  const compact = useMediaQuery('(max-width: 48em)')

  const sorting = useMemo(() => sortToSorting(state.sort), [state.sort])
  const onSortingChange = useCallback((next: DataTableSortingState) => update({ sort: sortingToSort(next) }), [update])

  const page = customers.data
  const failed = customers.status === 'error' || customers.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const [closing, setClosing] = useState<Customer | null>(null)
  const selected = rows.find((row) => row.phone === id) ?? null
  const detail = selected ?? closing
  const select = useCallback((row: Customer) => setId(row.phone), [setId])
  const columns = useMemo(() => customersColumns(select, compact === true), [select, compact])

  function close() {
    setClosing(selected)
    setId(null)
  }

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
      <SalesRegister title="Покупці за замовленнями" icon={IconUser}>
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
            minWidth={compact ? 245 : 670}
            height="100%"
            manualSorting
            sorting={sorting}
            onSortingChange={onSortingChange}
            onRowClick={select}
            emptyText={emptyText}
          />
        </ListPageBody>
      </SalesRegister>
      <AppEditorModal
        opened={Boolean(selected) && !failed}
        onClose={close}
        onExitTransitionEnd={() => setClosing(null)}
        title={<MetricLabel icon={IconUser}>Картка покупця</MetricLabel>}
        size="standard"
        className="customer-modal"
      >
        {detail && !failed && (
          <CustomerDetailPane key={detail.phone} customer={detail} canViewOrders={canViewOrders} onOpenAccount={onOpenAccount} />
        )}
      </AppEditorModal>
    </>
  )
}
