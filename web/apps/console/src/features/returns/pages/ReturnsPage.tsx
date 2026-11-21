import { Button, Stack, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
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
import { returnsColumns } from '../components/returnsColumns'
import { hasActiveFilters, toRefundsQuery, useReturnsState } from '../lib/returnsState'
import '@/shared/sales/sales-list.css'
import './returns.css'

const getRowId = (row: RefundRow) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function ReturnsPage({ sourceSwitch }: { sourceSwitch?: ReactNode }) {
  const { state, update, reset } = useReturnsState()
  const query = useMemo(() => toRefundsQuery(state), [state])
  const refunds = useApiQuery(`refunds:${JSON.stringify(query)}`, () => getRefunds(query), { keepPrevious: true })
  const filtered = hasActiveFilters(state)
  const [params, setParams] = useSearchParams()
  const pickedId = params.get('id')

  const page = refunds.data
  const failed = refunds.status === 'error' || refunds.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const [snapshot, setSnapshot] = useState<RefundRow | null>(null)
  const selected = rows.find((row) => row.id === pickedId)
  const detail = selected ?? snapshot
  const compact = useMediaQuery('(max-width: 48em)')

  const setId = useCallback((id: string | null) => {
    const next = new URLSearchParams(window.location.search)
    next.set('source', 'web')
    if (id) next.set('id', id)
    else next.delete('id')
    setParams(next, { replace: true })
  }, [setParams])
  const select = useCallback((row: RefundRow) => {
    setSnapshot(row)
    setId(row.id)
  }, [setId])
  const columns = useMemo(() => returnsColumns(select, compact === true), [select, compact])

  function close() {
    if (selected) setSnapshot(selected)
    setId(null)
  }

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
    <ListPage className="sales-list-page returns-list-page">
      <PageHeader title="Повернення" actions={sourceSwitch} />

      <ReturnsFilters
        state={state}
        filtered={filtered}
        update={update}
        reset={reset}
        actions={
          <>
            {page && !failed ? <span className="app-filter-summary">Знайдено: {countFormat.format(page.totalItems)}</span> : null}
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
          columns={columns}
          data={rows}
          getRowId={getRowId}
          isLoading={refunds.isLoading}
          isFetching={refunds.isFetching}
          minWidth={compact ? 250 : 650}
          height="100%"
          onRowClick={select}
          emptyText={emptyText}
        />
      </ListPageBody>
      {detail && !failed && <ReturnDetailPane refund={detail} opened={Boolean(selected)} onClose={close} />}
    </ListPage>
  )
}
