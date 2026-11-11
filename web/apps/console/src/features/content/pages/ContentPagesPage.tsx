import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getPages, type PageListItem } from '../api/contentApi'
import { ContentToolbar } from '../components/ContentToolbar'
import { pagesColumns } from '../components/contentColumns'
import { ListError } from '../components/ListError'
import { PageDetailPane } from '../components/PageDetailPane'
import '@/shared/ui/split/split.css'
import './content.css'

const getRowId = (row: PageListItem) => row.slug

export function ContentPagesPage() {
  const pages = useApiQuery('content-pages', () => getPages())
  const failed = pages.status === 'error' || pages.status === 'forbidden'
  const rows = failed ? [] : (pages.data ?? [])
  const [params, setParams] = useSearchParams()
  const picked = params.get('page')
  const selected = rows.find((row) => row.slug === picked) ?? rows[0] ?? null
  const selectedSlug = selected?.slug ?? null

  const selectPage = useCallback(
    (row: PageListItem) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('page', row.slug)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const rowClassName = useCallback((row: PageListItem) => (row.slug === selectedSlug ? 'app-split-row-active' : undefined), [selectedSlug])

  return (
    <ListPage>
      <PageHeader title="Текстові сторінки" />
      <ContentToolbar
        note="Клік по рядку показує сторінку справа. «Редагувати» відкриває редактор з переглядом."
        summary={pages.data ? `Сторінок: ${pages.data.length}` : null}
        isLoading={pages.isFetching}
        onRefresh={pages.reload}
      />
      <ListPageBody>
        <div className="app-split-layout">
          <div className="app-split-list">
            <DataTable
              ariaLabel="Текстові сторінки"
              columns={pagesColumns}
              data={rows}
              getRowId={getRowId}
              isLoading={pages.isLoading}
              isFetching={pages.isFetching}
              minWidth={480}
              height="100%"
              onRowClick={selectPage}
              rowClassName={rowClassName}
              emptyText={failed ? <ListError problem={pages.problem} onRetry={pages.reload} /> : 'Текстових сторінок ще немає.'}
            />
          </div>
          <PageDetailPane item={selected} />
        </div>
      </ListPageBody>
    </ListPage>
  )
}
