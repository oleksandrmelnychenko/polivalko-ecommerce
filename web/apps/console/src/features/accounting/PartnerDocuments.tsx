import { Select, TextInput, Title } from '@mantine/core'
import { IconFiles, IconSearch } from '@tabler/icons-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { FilterBar } from '@/shared/ui/FilterBar'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageState } from '@/shared/ui/PageState'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { normalizePageSize } from '@/shared/ui/paginator/pageSize'
import { PartnerDocumentsGrid } from './PartnerDocumentsGrid'
import { read, statusNames, type Doc, type Page } from './api'

// The document register serves 50 records per request. Fetch only the batches intersecting the visible page.
const REGISTER_SIZE = 50

async function readDocumentPage(filters: URLSearchParams, page: number, size: number) {
  const offset = (page - 1) * size
  const firstBatch = Math.floor(offset / REGISTER_SIZE) + 1
  const batch = (index: number) => read<Page<Doc>>('documents?' + filters + '&page=' + index)
  const first = await batch(firstBatch)
  if (!first.data) return first
  const { total, items } = first.data
  const lastBatch = Math.ceil(Math.min(total, offset + size) / REGISTER_SIZE)
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, lastBatch - firstBatch) }, (_, i) => batch(firstBatch + i + 1)),
  )
  const records = [...items]
  for (const result of rest) {
    if (!result.data) return result
    records.push(...result.data.items)
  }
  const start = offset % REGISTER_SIZE
  return { response: first.response, data: { total, items: records.slice(start, start + size) } }
}

export function PartnerDocuments({ id }: { id: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const size = normalizePageSize(params.get('pageSize'))
  const page = Math.max(1, Math.trunc(Number(params.get('page'))) || 1)
  const filters = new URLSearchParams({ partnerId: id })
  for (const key of ['q', 'from', 'to', 'status']) {
    const value = params.get(key)
    if (value) filters.set(key, value)
  }
  const query = useApiQuery('partner-documents:' + filters + ':' + page + ':' + size, () =>
    readDocumentPage(filters, page, size),
  )
  const total = query.data?.total

  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    navigate(
      { pathname: '/accounting/partners/' + id, search: next.toString() },
      { replace: true, state: location.state },
    )
  }

  return (
    <div className="partner-documents">
      <Title order={2}>
        <MetricLabel icon={IconFiles}>Документи контрагента</MetricLabel>
      </Title>
      <FilterBar
        label="Фільтри документів контрагента"
        activeCount={['from', 'to', 'status'].filter((key) => filters.has(key)).length}
        search={
          <TextInput
            className="app-filter-wide"
            type="search"
            aria-label="Пошук документів"
            placeholder="Номер або організація…"
            leftSection={<IconSearch size={16} stroke={1.7} />}
            value={params.get('q') ?? ''}
            maxLength={160}
            onChange={(event) => change('q', event.currentTarget.value)}
          />
        }
        actions={
          <>
            <span className="app-filter-summary">Знайдено: {total?.toLocaleString('uk-UA') ?? '—'}</span>
            <Paginator
              page={page}
              pageSize={size}
              totalPages={total === undefined ? undefined : Math.ceil(total / size)}
              isLoading={query.isFetching}
              onPageChange={(n) => change('page', String(n))}
              onPageSizeChange={(n) => change('pageSize', String(n))}
              onRefresh={query.reload}
            />
          </>
        }
      >
        <TextInput
          type="date"
          label="З дати"
          value={params.get('from') ?? ''}
          max={params.get('to') ?? undefined}
          onChange={(event) => change('from', event.currentTarget.value)}
        />
        <TextInput
          type="date"
          label="До дати"
          value={params.get('to') ?? ''}
          min={params.get('from') ?? undefined}
          onChange={(event) => change('to', event.currentTarget.value)}
        />
        <Select
          label="Статус"
          placeholder="Усі"
          clearable
          data={Object.entries(statusNames).map(([value, label]) => ({ value, label }))}
          value={params.get('status')}
          onChange={(value) => change('status', value ?? '')}
        />
      </FilterBar>
      {query.status === 'error' || query.status === 'forbidden' ? (
        <PageState kind={query.status} onRetry={query.reload} />
      ) : (
        <PartnerDocumentsGrid rows={query.data?.items ?? []} loading={query.isLoading} />
      )}
    </div>
  )
}
