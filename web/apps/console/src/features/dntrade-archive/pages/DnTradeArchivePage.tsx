import { Anchor, Button } from '@mantine/core'
import { IconFileImport, IconFileText } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { WORK_FORMS_PATH } from '@/features/dntrade-work-forms/lib/workForms'
import { fieldErrors, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DNTRADE_FORM_ADDITIONAL_PERMISSIONS, PermissionKeys } from '@/shared/auth/permissionKeys'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getArchive, type ArchiveItem, type ArchiveQuery } from '../api/archiveApi'
import { ArchiveFilters, archiveFilterKeys, readArchiveFilters, type ArchiveFilterValues } from '../components/ArchiveFilters'
import { ArchiveImportDialog } from '../components/ArchiveImportDialog'
import { ArchiveNavigation } from '../components/ArchiveNavigation'
import { ARCHIVE_PATH, archiveAmount, archiveEntityLabel, archiveSourceDate } from '../lib/archive'
import { archiveViewEntityType, readArchiveView } from '../lib/archiveViews'

const PAGE_SIZE = 50
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const EMPTY_ROWS: ArchiveItem[] = []
const getRowId = (row: ArchiveItem) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

function archiveColumns(search: string, warehouse: boolean): DataTableColumn<ArchiveItem>[] {
  return [
    {
      id: 'sourceId',
      header: 'Код запису',
      fill: true,
      width: 210,
      minWidth: 160,
      cell: (row) => (
        <Anchor component={Link} to={{ pathname: `${ARCHIVE_PATH}/${row.id}`, search }} title={row.sourceId} display="block" fw={600} truncate>
          {row.sourceId}
        </Anchor>
      ),
    },
    { id: 'entityType', header: 'Тип запису', width: 185, cell: (row) => archiveEntityLabel(row.entityType) },
    { id: 'documentType', header: 'Вид документа', width: 155, cell: (row) => row.documentType ?? '—' },
    { id: 'sourceDate', header: 'Дата запису', width: 115, cell: (row) => archiveSourceDate(row.sourceDate) },
    { id: 'sourceAccount', header: 'Джерело', width: 150, cell: (row) => row.sourceAccount },
    ...(warehouse ? [{ id: 'storeIds', header: 'Код складу', width: 155, cell: (row: ArchiveItem) => row.storeIds.join(', ') || '—' }] : []),
    { id: 'status', header: 'Статус', width: 130, cell: (row) => row.status ?? '—' },
    { id: 'total', header: 'Сума', width: 140, align: 'right', numeric: true, cell: (row) => archiveAmount(row.total, row.currency) },
  ]
}

function readPageNumber(raw: string | null, fallback: number, maximum: number) {
  const number = Number(raw)
  return Number.isInteger(number) && number >= 1 && number <= maximum ? number : fallback
}

export function DnTradeArchivePage() {
  const { can } = usePermissions()
  const { search } = useLocation()
  const [params, setParams] = useSearchParams()
  const [importing, setImporting] = useState(false)
  const canImport = can(PermissionKeys.DnTradeArchive.Import)
  const canManageForms = canImport && DNTRADE_FORM_ADDITIONAL_PERMISSIONS.every(can)
  const view = readArchiveView(params)
  const formSection = view.id === 'directories' ? 'directory' : view.id
  const warehouse = view.id === 'warehouse'
  const filters = useMemo(() => readArchiveFilters(params), [params])
  const columns = useMemo(() => archiveColumns(search, warehouse), [search, warehouse])
  const pageSize = readPageNumber(params.get('pageSize'), PAGE_SIZE, 100)
  const page = readPageNumber(params.get('page'), 1, Math.floor(2_147_483_647 / pageSize) + 1)
  const filtered = archiveFilterKeys.some((key) => Boolean(filters[key]))
  const query: ArchiveQuery = {
    q: filters.q || undefined,
    sourceAccount: filters.sourceAccount || undefined,
    entityType: archiveViewEntityType(view, filters.entityType) || undefined,
    storeId: filters.storeId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page,
    pageSize,
  }
  const archive = useApiQuery(`dntrade-archive:${JSON.stringify(query)}`, () => getArchive(query))
  const failed = archive.status === 'error' || archive.status === 'forbidden'
  const archivePage = failed ? undefined : archive.data

  function updateFilters(next: ArchiveFilterValues) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      for (const key of archiveFilterKeys) {
        const value = next[key].trim()
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

  return (
    <ListPage>
      <PageHeader
        title="Архів DNTrade"
        actions={canImport ? (
          <>
            {canManageForms ? (
              <Button component={Link} to={formSection === 'all' ? WORK_FORMS_PATH : `${WORK_FORMS_PATH}?section=${formSection}`} leftSection={<IconFileText size={16} stroke={1.8} />}>
                Робочі форми
              </Button>
            ) : null}
            <Button variant="default" leftSection={<IconFileImport size={16} stroke={1.8} />} onClick={() => setImporting(true)}>
              Імпорт файлів
            </Button>
          </>
        ) : null}
      />
      <ArchiveNavigation params={params} />
      <ArchiveFilters
        view={view}
        filters={filters}
        onChange={updateFilters}
        actions={
          <>
            {archivePage ? <span className="app-filter-summary">Записів {countFormat.format(archivePage.total)}</span> : null}
            <Paginator
              page={archivePage?.page ?? page}
              pageSize={archivePage?.pageSize ?? pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              totalPages={archivePage ? Math.ceil(archivePage.total / archivePage.pageSize) : undefined}
              isLoading={archive.isFetching}
              onPageChange={(next) => updatePage(next, pageSize)}
              onPageSizeChange={(next) => updatePage(1, next)}
              onRefresh={archive.reload}
            />
          </>
        }
      />
      <ListPageBody>
        <DataTable
          ariaLabel="Записи архіву DNTrade"
          columns={columns}
          data={archivePage?.items ?? EMPTY_ROWS}
          getRowId={getRowId}
          isLoading={archive.isLoading}
          isFetching={archive.isFetching}
          minWidth={1000}
          height="100%"
          emptyText={failed ? (
            <PageState
              kind={archive.status === 'forbidden' ? 'forbidden' : 'error'}
              description={Object.values(fieldErrors(archive.problem)).join(' ') || problemMessage(archive.problem, 'Не вдалося завантажити архів.')}
              onRetry={archive.status === 'error' ? archive.reload : undefined}
            />
          ) : filtered ? 'За цими умовами записів немає.' : view.id === 'all' ? 'Архів порожній.' : 'Записів цього типу немає.'}
        />
      </ListPageBody>
      {canImport && importing ? <ArchiveImportDialog onClose={() => setImporting(false)} onImported={archive.reload} /> : null}
    </ListPage>
  )
}
