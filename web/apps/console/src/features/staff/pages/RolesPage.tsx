import { Alert, Button, Skeleton, Stack, Text } from '@mantine/core'
import { IconAlertTriangle, IconDeviceFloppy, IconInfoCircle, IconLock, IconPlus, IconRefresh } from '@tabler/icons-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { getPermissionCatalog, getRolePermissions, getRoles, updateRolePermissions, type StaffRole } from '@/shared/auth/permissionsApi'
import { notifyPermissionsChanged } from '@/shared/lib/events'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { DeleteRoleDialog } from '../components/DeleteRoleDialog'
import { PermissionToolbar } from '../components/PermissionToolbar'
import { PermissionTree } from '../components/PermissionTree'
import { RoleFormModal } from '../components/RoleFormModal'
import { RoleList } from '../components/RoleList'
import { RoleSummary } from '../components/RoleSummary'
import { SaveFailureAlert } from '../components/SaveFailureAlert'
import {
  buildSections,
  diffKeys,
  EMPTY_FILTERS,
  filterPermissions,
  hasActiveFilters,
  orderKeys,
  toggleKeys,
  type PermissionFilters,
} from '../lib/permissionTree'
import { NETWORK_FAILURE, toFailure, type Failure } from '../lib/problems'
import { sortRoles } from '../lib/roleText'
import { useLeaveGuard } from '../lib/useLeaveGuard'
import './roles.css'
import './staff.css'

type Draft = { key: string; keys: ReadonlySet<string> }
type Pending = { kind: 'role'; id: string } | { kind: 'navigate'; to: string } | { kind: 'reload' }
type RoleDialog = { kind: 'create' } | { kind: 'edit'; role: StaffRole } | { kind: 'delete'; role: StaffRole }
type SaveFailure = { roleId: string; failure: Failure }

const EMPTY_KEYS: ReadonlySet<string> = new Set()
const ROLES_MANAGE = PermissionKeys.Staff.ManageRoles

type Stamp = { updatedAt: string | null; updatedBy: string | null }

function freshest(a: Stamp | undefined, b: Stamp): Stamp {
  if (!a?.updatedAt) return b
  if (!b.updatedAt) return a
  return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b
}

export function RolesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { permissions } = useAuth()
  const { can, isSuperuser, permissionKeys } = usePermissions()
  const myRoleId = permissions?.roleId ?? null

  const roles = useApiQuery('roles', () => getRoles())
  const catalog = useApiQuery('permission-catalog', () => getPermissionCatalog())
  const roleList = useMemo(() => sortRoles(roles.data ?? []), [roles.data])
  const requestedId = params.get('role') ?? ''
  const selectedRole = roleList.find((role) => role.id === requestedId) ?? roleList[0] ?? null
  const selectedId = selectedRole?.id ?? ''
  const rolePermissions = useApiQuery(`role-permissions:${selectedId}`, () => getRolePermissions(selectedId), { enabled: selectedId !== '' })
  const loaded = rolePermissions.data?.roleId === selectedId ? rolePermissions.data : undefined
  const catalogPermissions = useMemo(() => catalog.data?.permissions ?? [], [catalog.data])

  const baseline = useMemo<ReadonlySet<string>>(() => (loaded ? new Set(loaded.permissionKeys) : EMPTY_KEYS), [loaded])
  const draftKey = loaded ? `${loaded.roleId}:${loaded.version}` : ''
  const [draft, setDraft] = useState<Draft | null>(null)
  const selected = draft && draft.key === draftKey ? draft.keys : baseline
  const { added, removed } = useMemo(() => diffKeys(baseline, selected), [baseline, selected])
  const changes = added.length + removed.length
  const readOnly = !loaded || loaded.isSuperuser || Boolean(selectedRole?.isSuperuser)
  const dirty = !readOnly && changes > 0

  const [filters, setFilters] = useState<PermissionFilters>(EMPTY_FILTERS)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(EMPTY_KEYS)
  const [saving, setSaving] = useState(false)
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [dialog, setDialog] = useState<RoleDialog | null>(null)

  const mine = useMemo(() => new Set(permissionKeys), [permissionKeys])
  const canToggle = useCallback((key: string) => !readOnly && (isSuperuser || mine.has(key) || baseline.has(key)), [baseline, isSuperuser, mine, readOnly])

  const visible = useMemo(() => filterPermissions(catalogPermissions, filters, selected, baseline), [baseline, catalogPermissions, filters, selected])
  const sections = useMemo(() => buildSections(visible), [visible])
  const visibleToggleable = visible.map((permission) => permission.key).filter(canToggle)
  const lockedCount = readOnly ? 0 : catalogPermissions.filter((permission) => !canToggle(permission.key)).length
  const catalogMismatch = Boolean(catalog.data && loaded && catalog.data.version !== loaded.catalogVersion)
  const selfLockout = Boolean(loaded && loaded.roleId === myRoleId && !isSuperuser && removed.includes(ROLES_MANAGE))
  const currentFailure = saveFailure && saveFailure.roleId === selectedId ? saveFailure.failure : null
  const setRolePermissionsData = rolePermissions.setData

  useLeaveGuard(dirty, (to) => setPending({ kind: 'navigate', to }))

  function updateSelection(next: ReadonlySet<string>) {
    if (!draftKey || readOnly || saving) return
    setDraft({ key: draftKey, keys: next })
  }

  function toggle(keys: readonly string[]) {
    const allowed = keys.filter(canToggle)
    if (allowed.length) updateSelection(toggleKeys(selected, allowed))
  }

  function selectVisible() {
    updateSelection(new Set([...selected, ...visibleToggleable]))
  }

  function clearVisible() {
    const next = new Set(selected)
    for (const key of visibleToggleable) next.delete(key)
    updateSelection(next)
  }

  function discard() {
    setDraft(null)
    setSaveFailure(null)
  }

  function applyRole(id: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (id) next.set('role', id)
        else next.delete('role')
        return next
      },
      { replace: true },
    )
  }

  function selectRole(role: StaffRole) {
    if (role.id === selectedId || saving) return
    if (dirty) {
      setPending({ kind: 'role', id: role.id })
      return
    }
    applyRole(role.id)
  }

  function reloadAll() {
    setSaveFailure(null)
    roles.reload()
    catalog.reload()
    rolePermissions.reload()
  }

  function requestReload() {
    if (saving) return
    if (dirty) setPending({ kind: 'reload' })
    else reloadAll()
  }

  function reloadAfterFailure() {
    setDraft(null)
    reloadAll()
  }

  function continuePending() {
    const action = pending
    if (!action) return
    setPending(null)
    discard()
    if (action.kind === 'role') applyRole(action.id)
    else if (action.kind === 'navigate') navigate(action.to)
    else reloadAll()
  }

  async function save() {
    if (!loaded || !selectedRole || !dirty || saving || catalogMismatch) return
    const target = loaded
    const roleName = selectedRole.name
    const keys = orderKeys(selected, catalogPermissions)
    setSaving(true)
    setSaveFailure(null)
    try {
      const result = await withCsrf((headers) => updateRolePermissions(headers, target.roleId, { expectedVersion: target.version, permissionKeys: keys }))
      if (result.data) {
        setRolePermissionsData(result.data)
        setDraft(null)
        roles.reload()
        notifySuccess(`Права ролі «${roleName}» збережено.`)
        if (target.roleId === myRoleId) notifyPermissionsChanged()
      } else {
        setSaveFailure({ roleId: target.roleId, failure: toFailure(result.error, 'Права не збережено.') })
      }
    } catch {
      setSaveFailure({ roleId: target.roleId, failure: NETWORK_FAILURE })
    }
    setSaving(false)
  }

  function onRoleSaved(role: StaffRole, created: boolean) {
    setDialog(null)
    notifySuccess(created ? `Роль «${role.name}» створено.` : `Роль «${role.name}» збережено.`)
    if (roles.data) roles.setData(created ? [...roles.data, role] : roles.data.map((item) => (item.id === role.id ? role : item)))
    roles.reload()
    if (created) {
      if (dirty) setPending({ kind: 'role', id: role.id })
      else applyRole(role.id)
    } else if (role.id === myRoleId) {
      notifyPermissionsChanged()
    }
  }

  function onRoleDeleted(role: StaffRole) {
    setDialog(null)
    notifySuccess(`Роль «${role.name}» видалено.`)
    if (roles.data) roles.setData(roles.data.filter((item) => item.id !== role.id))
    roles.reload()
    if (role.id === requestedId) applyRole('')
  }

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const header = (
    <PageHeader
      title="Ролі і права"
      actions={
        <Button leftSection={<IconPlus size={16} stroke={1.8} />} disabled={!roles.data} onClick={() => setDialog({ kind: 'create' })}>
          Нова роль
        </Button>
      }
    />
  )

  if (!roles.data && (roles.status === 'error' || roles.status === 'forbidden')) {
    return (
      <>
        {header}
        <PageState kind={roles.status} description={problemMessage(roles.problem, 'Не вдалося завантажити ролі.')} onRetry={roles.reload} />
      </>
    )
  }

  return (
    <div className="roles-page">
      {header}
      <div className="roles-layout">
        <aside className="roles-aside">
          <div className="roles-aside-head">
            <span className="app-section-title">Ролі</span>
            <span className="roles-aside-count">{roleList.length}</span>
          </div>
          <RoleList roles={roleList} selectedId={selectedId} dirty={dirty} isLoading={roles.isLoading} myRoleId={myRoleId} onSelect={selectRole} />
        </aside>

        <section className="roles-editor" aria-label="Права ролі">
          {selectedRole ? (
            <RoleSummary
              role={selectedRole}
              selectedCount={selected.size}
              totalCount={catalogPermissions.length || selectedRole.permissionCount}
              stamp={freshest(loaded, selectedRole)}
              busy={saving}
              onEdit={() => setDialog({ kind: 'edit', role: selectedRole })}
              onDelete={() => setDialog({ kind: 'delete', role: selectedRole })}
            />
          ) : null}

          <PermissionToolbar
            filters={filters}
            onFilters={setFilters}
            shown={visible.length}
            total={catalogPermissions.length}
            readOnly={readOnly}
            canSelectAll={!saving && visibleToggleable.some((key) => !selected.has(key))}
            canClear={!saving && visibleToggleable.some((key) => selected.has(key))}
            refreshing={roles.isFetching || catalog.isFetching || rolePermissions.isFetching}
            onSelectAll={selectVisible}
            onClear={clearVisible}
            onRefresh={requestReload}
          />

          <div className="roles-editor-scroll">
            <EditorBody
              loading={roles.isLoading || catalog.isLoading || (selectedId !== '' && !loaded && rolePermissions.status !== 'error' && rolePermissions.status !== 'forbidden')}
              empty={roles.status === 'ready' && roleList.length === 0}
              catalogFailed={catalog.status === 'error' || catalog.status === 'forbidden'}
              catalogProblem={catalog.problem}
              roleFailed={!loaded && (rolePermissions.status === 'error' || rolePermissions.status === 'forbidden')}
              roleProblem={rolePermissions.problem}
              onRetry={reloadAll}
            >
              <div className="roles-alerts">
                {selectedRole?.isSuperuser ? (
                  <Alert color="gray" variant="light" icon={<IconLock size={18} />} title="Роль «Адміністратор» не редагується">
                    Адміністратор завжди має всі права. Зняти їх, перейменувати чи видалити роль не можна.
                  </Alert>
                ) : null}
                {catalogMismatch ? (
                  <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} title="Каталог прав оновився">
                    <Stack gap={6} align="flex-start">
                      <Text size="sm">Перед збереженням завантажте актуальні права ролі.</Text>
                      <Button size="xs" variant="default" leftSection={<IconRefresh size={14} />} onClick={reloadAfterFailure}>
                        Завантажити актуальні права
                      </Button>
                    </Stack>
                  </Alert>
                ) : null}
                {loaded && !readOnly && baseline.size === 0 && changes === 0 ? (
                  <p className="roles-note">
                    <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" />
                    У ролі ще немає прав. Позначте потрібні й натисніть «Зберегти права».
                  </p>
                ) : null}
                {lockedCount > 0 ? (
                  <p className="roles-note">
                    <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" />
                    Прав із замком немає у вашій ролі, тому цій ролі ви їх надати не можете.
                  </p>
                ) : null}
              </div>
              {sections.length > 0 ? (
                <PermissionTree
                  sections={sections}
                  selected={selected}
                  baseline={baseline}
                  readOnly={readOnly || saving}
                  canToggle={canToggle}
                  collapsed={collapsed}
                  forceExpanded={hasActiveFilters(filters)}
                  onToggleCollapsed={toggleCollapsed}
                  onToggleKeys={toggle}
                />
              ) : (
                <p className="roles-empty">За цими умовами прав немає.</p>
              )}
            </EditorBody>
          </div>

          {selectedRole && !readOnly ? (
            <footer className="roles-footer">
              {currentFailure ? (
                <div className="roles-footer-alert">
                  <SaveFailureAlert failure={currentFailure} catalog={catalogPermissions} onReload={reloadAfterFailure} />
                </div>
              ) : null}
              <div className="roles-footer-status" aria-live="polite">
                {changes > 0 ? (
                  <>
                    <b>Змін: {changes}</b>
                    <span>
                      додано {added.length}, знято {removed.length}
                    </span>
                  </>
                ) : (
                  <span>Змін немає</span>
                )}
              </div>
              {selfLockout ? (
                <p className="roles-footer-warning">
                  <IconAlertTriangle size={16} stroke={1.8} aria-hidden="true" />
                  Ви знімаєте з власної ролі право «Ролі та права». Після збереження ця сторінка стане для вас недоступною.
                </p>
              ) : null}
              <div className="roles-footer-actions">
                <Button variant="default" disabled={!dirty || saving} onClick={discard}>
                  Скасувати зміни
                </Button>
                <Button leftSection={<IconDeviceFloppy size={16} stroke={1.8} />} disabled={!dirty || catalogMismatch} loading={saving} onClick={() => void save()}>
                  Зберегти права
                </Button>
              </div>
            </footer>
          ) : null}
        </section>
      </div>

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <RoleFormModal
          key={dialog.kind === 'edit' ? dialog.role.id : 'new'}
          role={dialog.kind === 'edit' ? dialog.role : null}
          roles={roleList}
          catalog={catalogPermissions}
          onClose={() => setDialog(null)}
          onSaved={onRoleSaved}
        />
      ) : null}

      {dialog?.kind === 'delete' ? (
        <DeleteRoleDialog
          key={dialog.role.id}
          role={dialog.role}
          canOpenStaff={can(PermissionKeys.Staff.ManageUsers)}
          onClose={() => setDialog(null)}
          onDeleted={onRoleDeleted}
          onStale={roles.reload}
        />
      ) : null}

      <AppModal opened={pending !== null} title="Незбережені зміни" size={440} onClose={() => setPending(null)}>
        <Text size="sm">
          Є незбережені зміни прав ролі «{selectedRole?.name}» ({changes}). Відхилити їх і продовжити?
        </Text>
        <AppModalFooter>
          <Button variant="default" onClick={() => setPending(null)} data-autofocus>
            Залишитися
          </Button>
          <Button color="red" onClick={continuePending}>
            Відхилити зміни
          </Button>
        </AppModalFooter>
      </AppModal>
    </div>
  )
}

type EditorBodyProps = {
  loading: boolean
  empty: boolean
  catalogFailed: boolean
  catalogProblem: unknown
  roleFailed: boolean
  roleProblem: unknown
  onRetry: () => void
  children: ReactNode
}

function EditorBody({ loading, empty, catalogFailed, catalogProblem, roleFailed, roleProblem, onRetry, children }: EditorBodyProps) {
  if (empty) return <PageState kind="empty" title="Ролей ще немає" description="Створіть першу роль кнопкою «Нова роль»." />
  if (catalogFailed) return <PageState kind="error" description={problemMessage(catalogProblem, 'Не вдалося завантажити каталог прав.')} onRetry={onRetry} />
  if (roleFailed) return <PageState kind="error" description={problemMessage(roleProblem, 'Не вдалося завантажити права ролі.')} onRetry={onRetry} />
  if (loading) {
    return (
      <div className="roles-skeleton" aria-busy="true" aria-label="Завантаження прав">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <Skeleton key={row} height={row % 3 === 0 ? 40 : 52} radius={8} />
        ))}
      </div>
    )
  }
  return <>{children}</>
}
