import { Anchor, Button, Group, Select, TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ARCHIVE_PATH } from '@/features/dntrade-archive/lib/archive'
import { fieldErrors, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { listWorkForms, type WorkFormListItem } from '../api/workFormsApi'
import { WorkFormStatus } from '../components/WorkFormStatus'
import { useWorkFormAccess } from '../lib/useWorkFormAccess'
import { WORK_FORMS_PATH, WORK_FORM_SECTIONS, WORK_FORM_STATUSES, readWorkFormSection, readWorkFormStatus, workFormCreateHref, workFormSectionLabel, workFormTypeLabel } from '../lib/workForms'
import './work-forms.css'

const PAGE_SIZE = 50
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const EMPTY_ROWS: WorkFormListItem[] = []
const countFormat = new Intl.NumberFormat('uk-UA')
const updatedFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' })
const rowId = (row: WorkFormListItem) => row.id

function readPage(raw: string | null, fallback: number, maximum: number) {
  const number = Number(raw)
  return Number.isInteger(number) && number > 0 && number <= maximum ? number : fallback
}

function workFormColumns(search: string): DataTableColumn<WorkFormListItem>[] {
  return [
    {
      id: 'title',
      header: 'Назва форми',
      width: 245,
      minWidth: 175,
      fill: true,
      cell: (row) => (
        <Anchor component={Link} to={{ pathname: `${WORK_FORMS_PATH}/${row.id}`, search }} title={row.title} fw={600} display="block" truncate>
          {row.title}
        </Anchor>
      ),
    },
    { id: 'section', header: 'Розділ', width: 105, cell: (row) => workFormSectionLabel(row.section) },
    { id: 'type', header: 'Тип форми', width: 167, cell: (row) => workFormTypeLabel(row.type) },
    { id: 'status', header: 'Статус', width: 182, cell: (row) => <WorkFormStatus status={row.status} /> },
    { id: 'documentDate', header: 'Дата документа', width: 129, cell: (row) => row.documentDate?.split('-').reverse().join('.') || '—' },
    { id: 'sourceRecordId', header: 'Джерело', width: 115, cell: (row) => row.sourceRecordId ? (
      <Anchor component={Link} to={`${ARCHIVE_PATH}/${row.sourceRecordId}`}>DNTrade</Anchor>
    ) : 'Нова форма' },
    { id: 'updatedAt', header: 'Оновлено', width: 146, cell: (row) => updatedFormat.format(new Date(row.updatedAt)) },
  ]
}

export function DnTradeWorkFormsPage() {
  const { allowed, isLoading: checkingAccess } = useWorkFormAccess()
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const section = readWorkFormSection(params.get('section'))
  const status = readWorkFormStatus(params.get('status'))
  const sourceRecordId = params.get('sourceRecordId') || undefined
  const pageSize = readPage(params.get('pageSize'), PAGE_SIZE, 100)
  const page = readPage(params.get('page'), 1, Math.floor(2_147_483_647 / pageSize) + 1)
  const query = { q: q || undefined, section, status, sourceRecordId, page, pageSize }
  const forms = useApiQuery(`dntrade-work-forms:${JSON.stringify(query)}`, () => listWorkForms(query), { enabled: allowed })
  const search = params.toString()
  const columns = useMemo(() => workFormColumns(search), [search])
  const [draft, setDraft] = useState(q)
  const [previousQuery, setPreviousQuery] = useState(q)
  if (q !== previousQuery) {
    setPreviousQuery(q)
    setDraft(q)
  }
  const commit = useDebouncedCallback((value: string) => updateFilters({ q: value.trim() }), 350)
  useEffect(() => () => commit.cancel(), [commit, q])

  function updateFilters(next: Record<string, string | null>) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      for (const [key, value] of Object.entries(next)) {
        if (value) updated.set(key, value)
        else updated.delete(key)
      }
      updated.delete('page')
      return updated
    }, { replace: true })
  }

  function updatePage(nextPage: number, nextSize: number) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (nextPage === 1) updated.delete('page')
      else updated.set('page', String(nextPage))
      if (nextSize === PAGE_SIZE) updated.delete('pageSize')
      else updated.set('pageSize', String(nextSize))
      return updated
    }, { replace: true })
  }

  function sectionSearch(nextSection: string | null) {
    const next = new URLSearchParams(params)
    if (nextSection) next.set('section', nextSection)
    else next.delete('section')
    next.delete('page')
    return next.toString()
  }

  if (!allowed) return <PageState kind={checkingAccess ? 'loading' : 'forbidden'} />

  const failed = forms.status === 'error' || forms.status === 'forbidden'
  const result = failed ? undefined : forms.data
  const hasFilters = Boolean(q || section || status || sourceRecordId)
  const create = workFormCreateHref({ section, sourceRecordId })
  const createSearch = new URLSearchParams(params)
  for (const [key, value] of new URLSearchParams(create.search)) createSearch.set(key, value)

  return (
    <ListPage>
      <PageHeader title="Робочі форми DNTrade" actions={(
        <Button component={Link} to={{ pathname: create.pathname, search: createSearch.toString() }} leftSection={<IconPlus size={16} />}>
          Нова форма
        </Button>
      )} />
      <Group component="nav" gap="xs" className="dntrade-work-form-views" aria-label="Розділи робочих форм">
        {[{ value: null, label: 'Усі форми' }, ...WORK_FORM_SECTIONS].map((view) => (
          <Button
            key={view.label}
            component={Link}
            to={{ pathname: WORK_FORMS_PATH, search: sectionSearch(view.value) }}
            size="compact-sm"
            variant={(section ?? null) === view.value ? 'light' : 'subtle'}
            aria-current={(section ?? null) === view.value ? 'page' : undefined}
          >
            {view.label}
          </Button>
        ))}
      </Group>
      <FilterBar
        label="Пошук робочих форм"
        search={(
          <>
            <TextInput
              className="app-filter-wide"
              label="Пошук"
              placeholder="Назва форми"
              leftSection={<IconSearch size={16} stroke={1.7} />}
              value={draft}
              maxLength={128}
              onChange={(event) => { setDraft(event.currentTarget.value); commit(event.currentTarget.value) }}
              onKeyDown={(event) => { if (event.key === 'Enter') commit.flush() }}
            />
            <Select
              label="Статус"
              placeholder="Усі"
              clearable
              data={[...WORK_FORM_STATUSES]}
              value={status ?? null}
              onChange={(value) => { commit.cancel(); updateFilters({ q: draft.trim(), status: value }) }}
            />
          </>
        )}
        actions={(
          <>
            {sourceRecordId ? <Button size="xs" variant="default" onClick={() => updateFilters({ sourceRecordId: null })}>Усі джерела</Button> : null}
            {result ? <span className="app-filter-summary">Форм {countFormat.format(result.totalItems)}</span> : null}
            <Paginator
              page={result?.page ?? page}
              pageSize={result?.pageSize ?? pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              totalPages={result ? Math.ceil(result.totalItems / result.pageSize) : undefined}
              isLoading={forms.isFetching}
              onPageChange={(next) => updatePage(next, pageSize)}
              onPageSizeChange={(next) => updatePage(1, next)}
              onRefresh={forms.reload}
            />
          </>
        )}
      />
      <ListPageBody>
        <DataTable
          ariaLabel="Робочі форми DNTrade"
          columns={columns}
          data={result?.items ?? EMPTY_ROWS}
          getRowId={rowId}
          isLoading={forms.isLoading}
          isFetching={forms.isFetching}
          minWidth={900}
          height="100%"
          emptyText={failed ? (
            <PageState
              kind={forms.status === 'forbidden' ? 'forbidden' : 'error'}
              description={Object.values(fieldErrors(forms.problem)).join(' ') || problemMessage(forms.problem, 'Не вдалося завантажити робочі форми.')}
              onRetry={forms.status === 'error' ? forms.reload : undefined}
            />
          ) : hasFilters ? 'За цими умовами форм немає.' : 'Збережених форм ще немає.'}
        />
      </ListPageBody>
    </ListPage>
  )
}
