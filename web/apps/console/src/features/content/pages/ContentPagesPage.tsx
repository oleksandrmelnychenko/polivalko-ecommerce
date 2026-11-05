import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getPages, type PageListItem } from '../api/contentApi'
import { ContentToolbar } from '../components/ContentToolbar'
import { pagesColumns } from '../components/contentColumns'
import { ListError } from '../components/ListError'
import { pageEditorHref } from '../lib/contentLinks'
import './content.css'

const getRowId = (row: PageListItem) => row.slug

export function ContentPagesPage() {
  const navigate = useNavigate()
  const pages = useApiQuery('content-pages', () => getPages())
  const failed = pages.status === 'error' || pages.status === 'forbidden'
  const rows = failed ? [] : (pages.data ?? [])
  const onRowClick = useCallback((row: PageListItem) => navigate(pageEditorHref(row.slug)), [navigate])

  return (
    <ListPage>
      <PageHeader title="Текстові сторінки" />
      <ContentToolbar
        summary={pages.data ? `Сторінок: ${pages.data.length}` : null}
        isLoading={pages.isFetching}
        onRefresh={pages.reload}
      />
      <ListPageBody>
        <DataTable
          ariaLabel="Текстові сторінки"
          columns={pagesColumns}
          data={rows}
          getRowId={getRowId}
          isLoading={pages.isLoading}
          isFetching={pages.isFetching}
          minWidth={720}
          height="100%"
          onRowClick={onRowClick}
          emptyText={failed ? <ListError problem={pages.problem} onRetry={pages.reload} /> : 'Текстових сторінок ще немає.'}
        />
      </ListPageBody>
    </ListPage>
  )
}
