import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPageBody } from '@/shared/ui/ListPage'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getAccounts, type AccountRow } from '../api/accountsApi'
import { accountHref, toAccountsQuery, useAccountsState } from '../lib/accountsState'
import { accountsColumns } from './accountsColumns'
import { AccountsFilters } from './AccountsFilters'

const getRowId = (row: AccountRow) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function AccountsTab() {
  const navigate = useNavigate()
  const { state, update } = useAccountsState()
  const query = useMemo(() => toAccountsQuery(state), [state])
  const accounts = useApiQuery(`accounts:${JSON.stringify(query)}`, () => getAccounts(query))
  const onRowClick = useCallback((row: AccountRow) => navigate(accountHref(row.id)), [navigate])

  const page = accounts.data
  const rows = accounts.status === 'error' || accounts.status === 'forbidden' ? [] : (page?.items ?? [])

  const emptyText =
    accounts.status === 'error' ? (
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
        <DataTable
          ariaLabel="Кабінети покупців"
          columns={accountsColumns}
          data={rows}
          getRowId={getRowId}
          isLoading={accounts.isLoading}
          isFetching={accounts.isFetching}
          minWidth={1010}
          height="100%"
          onRowClick={onRowClick}
          emptyText={emptyText}
        />
      </ListPageBody>
    </>
  )
}
