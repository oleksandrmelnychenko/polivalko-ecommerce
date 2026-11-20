import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { IconId } from '@tabler/icons-react'
import { useCustomerSelection } from '../lib/useCustomerSelection'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
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
import { accountsColumns } from './accountsColumns'
import { AccountsFilters } from './AccountsFilters'

const getRowId = (row: AccountRow) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function AccountsTab() {
  const { can } = usePermissions()
  const canManage = can(PermissionKeys.Customers.ManageAccounts)
  const canViewOrders = can(PermissionKeys.Orders.View)
  const { state, update } = useAccountsState()
  const query = useMemo(() => toAccountsQuery(state), [state])
  const accounts = useApiQuery(`accounts:${JSON.stringify(query)}`, () => getAccounts(query), { keepPrevious: true })
  const { id, setId } = useCustomerSelection()
  const compact = useMediaQuery('(max-width: 48em)')

  const page = accounts.data
  const failed = accounts.status === 'error' || accounts.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const [closing, setClosing] = useState<string | null>(null)
  const selected = id
  const detail = selected ?? closing
  const select = useCallback((row: AccountRow) => setId(row.id), [setId])
  const columns = useMemo(() => accountsColumns(select, compact === true), [select, compact])

  function close() {
    setClosing(selected)
    setId(null)
  }

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
        <DataTable
          ariaLabel="Кабінети покупців"
          columns={columns}
          data={rows}
          getRowId={getRowId}
          isLoading={accounts.isLoading}
          isFetching={accounts.isFetching}
          minWidth={compact ? 245 : 710}
          height="100%"
          onRowClick={select}
          emptyText={emptyText}
        />
      </ListPageBody>
      <AppEditorModal
        opened={Boolean(selected) && !failed}
        onClose={close}
        onExitTransitionEnd={() => setClosing(null)}
        title={<MetricLabel icon={IconId}>Кабінет покупця</MetricLabel>}
        size="standard"
        className="customer-modal"
      >
        {detail && !failed && (
          <AccountDetailPane key={detail} id={detail} canManage={canManage} canViewOrders={canViewOrders} onChanged={accounts.reload} />
        )}
      </AppEditorModal>
    </>
  )
}
