import { useCallback, useMemo, useState } from 'react'
import { usePermissions } from '@/features/auth'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { getPermissionCatalog } from '@/shared/auth/permissionsApi'
import { isPermissionKey, PERMISSION_LABELS } from '@/shared/auth/permissionKeys'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getAudit, type AuditEntry } from '../api/auditApi'
import { auditColumns } from '../components/auditColumns'
import { AuditEntryDrawer } from '../components/AuditEntryDrawer'
import { AuditFilters } from '../components/AuditFilters'
import { ListError } from '../components/ListError'
import { toAuditQuery, useAuditState } from '../lib/auditFilters'
import './audit.css'

const getRowId = (row: AuditEntry) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function AuditPage() {
  const { can } = usePermissions()
  const { state, update, reset } = useAuditState()
  const query = useMemo(() => toAuditQuery(state), [state])
  const audit = useApiQuery(`audit:${JSON.stringify(query)}`, () => getAudit(query))
  const catalog = useApiQuery('permission-catalog', () => getPermissionCatalog())
  const [selected, setSelected] = useState<{ entry: AuditEntry | null; opened: boolean }>({ entry: null, opened: false })

  const permissionName = useMemo(() => {
    const names = new Map((catalog.data?.permissions ?? []).map((permission) => [permission.key, permission.name]))
    return (key: string) => names.get(key) ?? (isPermissionKey(key) ? PERMISSION_LABELS[key] : key)
  }, [catalog.data])

  const columns = useMemo(() => auditColumns({ can, permissionName }), [can, permissionName])
  const onRowClick = useCallback((entry: AuditEntry) => setSelected({ entry, opened: true }), [])

  const page = audit.data
  const failed = audit.status === 'error' || audit.status === 'forbidden'
  const rows = failed ? [] : (page?.items ?? [])
  const filtered = Boolean(state.q || state.entityType)

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
        <DataTable
          ariaLabel="Журнал змін"
          columns={columns}
          data={rows}
          getRowId={getRowId}
          isLoading={audit.isLoading}
          isFetching={audit.isFetching}
          minWidth={1100}
          height="100%"
          onRowClick={onRowClick}
          emptyText={failed ? <ListError problem={audit.problem} onRetry={audit.reload} /> : filtered ? 'За цими умовами записів немає.' : 'Журнал порожній.'}
        />
      </ListPageBody>

      <AuditEntryDrawer
        entry={selected.entry}
        opened={selected.opened}
        onClose={() => setSelected((current) => ({ ...current, opened: false }))}
        can={can}
        permissionName={permissionName}
      />
    </ListPage>
  )
}
