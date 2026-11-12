import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPageBody } from '@/shared/ui/ListPage'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getAccounts, type AccountRow } from '../api/accountsApi'
import { toAccountsQuery, useAccountsState } from '../lib/accountsState'
import { AccountDetailPane } from './AccountDetailPane'
import { ACCOUNTS_COLUMNS } from './accountsColumns'
import { AccountsFilters } from './AccountsFilters'

const getRowId = (row: AccountRow) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function AccountsTab() {
  const { can } = usePermissions()
  const canManage = can(PermissionKeys.Customers.ManageAccounts)
  const canViewOrders = can(PermissionKeys.Orders.View)
  const { state, update } = useAccountsState()
  const query = useMemo(() => toAccountsQuery(state), [state])
  const accounts = useApiQuery(`accounts:${JSON.stringify(query)}`, () => getAccounts(query))
  const [params, setParams] = useSearchParams()
  const pickedId = params.get('id')

  const page = accounts.data
  const failed = accounts.status === 'error' || accounts.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const selectedId = pickedId ?? rows[0]?.id ?? null

  const select = useCallback(
    (row: AccountRow) =>
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
  const rowClassName = useCallback((row: AccountRow) => (row.id === selectedId ? 'app-split-row-active' : undefined), [selectedId])

  const emptyText = failed ? (
    <Stack align="center" gap={8}>
      <Text size="sm">{problemMessage(accounts.problem, 'Не вдалося завантажити кабінети.')}</Text>
      <Button size="xs" variant="default" onClick={accounts.reload}>
        Спробувати ще раз
      </Button>
    </Stack>
  ) : state.q || state.status !== 'all' ? (
    'За цими умовами кабінетів немає.'
  ) : (
    'На сайті ще ніхто не зареєструвався.'
  )

  return (
    <>
      <AccountsFilters
        state={state}
        update={update}
        actions={
          <>
            {page ? <span className="app-filter-summary">Знайдено: {countFormat.format(page.totalItems)}</span> : null}
            <Paginator
              page={state.page}
              pageSize={state.pageSize}
              totalPages={page?.totalPages}
              isLoading={accounts.isFetching}
              onPageChange={(next) => update({ page: next })}
              onPageSizeChange={(size) => update({ pageSize: size })}
              onRefresh={accounts.reload}
            />
          </>
        }
      />

      <ListPageBody>
        <div className="app-split-layout">
          <div className="app-split-list">
            <DataTable
              ariaLabel="Кабінети покупців"
              columns={ACCOUNTS_COLUMNS}
              data={rows}
              getRowId={getRowId}
              isLoading={accounts.isLoading}
              isFetching={accounts.isFetching}
              minWidth={620}
              height="100%"
              onRowClick={select}
              rowClassName={rowClassName}
              emptyText={emptyText}
            />
          </div>
          <AccountDetailPane id={selectedId} canManage={canManage} canViewOrders={canViewOrders} onChanged={accounts.reload} />
        </div>
      </ListPageBody>
    </>
  )
}
