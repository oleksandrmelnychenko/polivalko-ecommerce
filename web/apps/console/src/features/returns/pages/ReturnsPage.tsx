import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getRefunds, type RefundRow } from '../api/returnsApi'
import { ReturnsFilters } from '../components/ReturnsFilters'
import { returnsColumns } from '../components/returnsColumns'
import { orderHref } from '../lib/returnsLabels'
import { hasActiveFilters, toRefundsQuery, useReturnsState } from '../lib/returnsState'
import './returns.css'

const getRowId = (row: RefundRow) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function ReturnsPage() {
  const navigate = useNavigate()
  const { state, update, reset } = useReturnsState()
  const query = useMemo(() => toRefundsQuery(state), [state])
  const refunds = useApiQuery(`refunds:${JSON.stringify(query)}`, () => getRefunds(query))
  const filtered = hasActiveFilters(state)
  const onRowClick = useCallback((row: RefundRow) => navigate(orderHref(row.orderNumber)), [navigate])

  const page = refunds.data
  const rows = refunds.status === 'error' || refunds.status === 'forbidden' ? [] : (page?.items ?? [])

  const emptyText =
    refunds.status === 'error' ? (
      <Stack align="center" gap={8}>
        <Text size="sm">{problemMessage(refunds.problem, 'Не вдалося завантажити повернення.')}</Text>
        <Button size="xs" variant="default" onClick={refunds.reload}>
          Спробувати ще раз
        </Button>
      </Stack>
    ) : filtered ? (
      'За цими умовами повернень немає.'
    ) : (
      'Повернень ще не було. Оформити повернення можна в картці замовлення.'
    )

  return (
    <ListPage>
      <PageHeader title="Повернення" />

      <ReturnsFilters
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
              isLoading={refunds.isFetching}
              onPageChange={(next) => update({ page: next })}
              onPageSizeChange={(size) => update({ pageSize: size })}
              onRefresh={refunds.reload}
            />
          </>
        }
      />

      <ListPageBody>
        <DataTable
          ariaLabel="Повернення"
          columns={returnsColumns}
          data={rows}
          getRowId={getRowId}
          isLoading={refunds.isLoading}
          isFetching={refunds.isFetching}
          minWidth={1020}
          height="100%"
          onRowClick={onRowClick}
          emptyText={emptyText}
        />
      </ListPageBody>
    </ListPage>
  )
}
