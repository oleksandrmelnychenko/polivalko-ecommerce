import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { getAudit, type AuditEntry } from '@/shared/audit/auditApi'
import { getPermissionCatalog } from '@/shared/auth/permissionsApi'
import { isPermissionKey, PERMISSION_LABELS } from '@/shared/auth/permissionKeys'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { DEFAULT_PAGE_SIZE } from '@/shared/ui/paginator/pageSize'
import { AUDIT_COLUMNS } from '../components/auditColumns'
import { AuditEntryPane } from '../components/AuditEntryPane'
import { AuditFilters } from '../components/AuditFilters'
import { ListError } from '../components/ListError'
import { toAuditQuery, useAuditState } from '../lib/auditFilters'
import '@/shared/ui/split/split.css'
import './audit.css'

const getRowId = (row: AuditEntry) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function AuditPage() {
  const { can } = usePermissions()
  const { state, update, reset } = useAuditState()
  const query = useMemo(() => toAuditQuery(state), [state])
  const audit = useApiQuery(`audit:${JSON.stringify(query)}`, () => getAudit(query))
  const catalog = useApiQuery('permission-catalog', () => getPermissionCatalog())
  const [params, setParams] = useSearchParams()
  const pickedId = params.get('id')

  const permissionName = useMemo(() => {
    const names = new Map((catalog.data?.permissions ?? []).map((permission) => [permission.key, permission.name]))
    return (key: string) => names.get(key) ?? (isPermissionKey(key) ? PERMISSION_LABELS[key] : key)
  }, [catalog.data])

  const page = audit.data
  const failed = audit.status === 'error' || audit.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (page?.items ?? [])), [failed, page])
  const filtered = Boolean(state.q || state.entityType)
  const selected = rows.find((row) => row.id === pickedId) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null

  const select = useCallback(
    (entry: AuditEntry) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('id', entry.id)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const rowClassName = useCallback((row: AuditEntry) => (row.id === selectedId ? 'app-split-row-active' : undefined), [selectedId])

  const showObject = useCallback(
    (entry: AuditEntry) =>
      setParams(
        () => {
          const next = new URLSearchParams()
          next.set('entityType', entry.entityType)
          if (entry.entityId) next.set('q', entry.entityId)
          if (state.pageSize !== DEFAULT_PAGE_SIZE) next.set('pageSize', String(state.pageSize))
          next.set('id', entry.id)
          return next
        },
        { replace: true },
      ),
    [setParams, state.pageSize],
  )

  return (
    <ListPage>
      <PageHeader title="Журнал змін" />

      <AuditFilters
        state={state}
        update={update}
        reset={reset}
        actions={
          <>
            {page ? <span className="app-filter-summary">Записів: {countFormat.format(page.totalItems)}</span> : null}
            <Paginator
              page={state.page}
              pageSize={state.pageSize}
              totalPages={page?.totalPages}
              isLoading={audit.isFetching}
              onPageChange={(next) => update({ page: next })}
              onPageSizeChange={(size) => update({ pageSize: size })}
              onRefresh={audit.reload}
            />
          </>
        }
      />

      <ListPageBody>
        <div className="app-split-layout">
          <div className="app-split-list">
            <DataTable
              ariaLabel="Журнал змін"
              columns={AUDIT_COLUMNS}
              data={rows}
              getRowId={getRowId}
              isLoading={audit.isLoading}
              isFetching={audit.isFetching}
              minWidth={600}
              height="100%"
              onRowClick={select}
              rowClassName={rowClassName}
              emptyText={failed ? <ListError problem={audit.problem} onRetry={audit.reload} /> : filtered ? 'За цими умовами записів немає.' : 'Журнал порожній.'}
            />
          </div>
          <AuditEntryPane entry={selected} can={can} permissionName={permissionName} onShowObject={showObject} />
        </div>
      </ListPageBody>
    </ListPage>
  )
}
