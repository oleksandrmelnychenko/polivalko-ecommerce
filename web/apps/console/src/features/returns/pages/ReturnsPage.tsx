import { Button, Stack, Text } from '@mantine/core'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getRefunds, type RefundRow } from '../api/returnsApi'
import { ReturnDetailPane } from '../components/ReturnDetailPane'
import { ReturnsFilters } from '../components/ReturnsFilters'
import { RETURNS_COLUMNS } from '../components/returnsColumns'
import { hasActiveFilters, toRefundsQuery, useReturnsState } from '../lib/returnsState'
import '@/shared/ui/split/split.css'
import './returns.css'

const getRowId = (row: RefundRow) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function ReturnsPage() {
  const { state, update, reset } = useReturnsState()
  const query = useMemo(() => toRefundsQuery(state), [state])
  const refunds = useApiQuery(`refunds:${JSON.stringify(query)}`, () => getRefunds(query))
  const filtered = hasActiveFilters(state)
  const [params, setParams] = useSearchParams()
  const pickedId = params.get('id')

  const page = refunds.data
  const failed = refunds.status === 'error' || refunds.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const selected = rows.find((row) => row.id === pickedId) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null

  const select = useCallback(
    (row: RefundRow) =>
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
  const rowClassName = useCallback((row: RefundRow) => (row.id === selectedId ? 'app-split-row-active' : undefined), [selectedId])

  const emptyText = failed ? (
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
        <div className="app-split-layout">
          <div className="app-split-list">
            <DataTable
              ariaLabel="Повернення"
              columns={RETURNS_COLUMNS}
              data={rows}
              getRowId={getRowId}
              isLoading={refunds.isLoading}
              isFetching={refunds.isFetching}
              minWidth={520}
              height="100%"
              onRowClick={select}
              rowClassName={rowClassName}
              emptyText={emptyText}
            />
          </div>
          <ReturnDetailPane refund={selected} />
        </div>
      </ListPageBody>
    </ListPage>
  )
}
