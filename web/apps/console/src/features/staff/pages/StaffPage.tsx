import { ActionIcon, Button, Stack, Text, Tooltip } from '@mantine/core'
import { IconKey, IconRefresh, IconUserPlus } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { ChangePasswordModal, useAuth, usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { getRoles } from '@/shared/auth/permissionsApi'
import { notifyPermissionsChanged } from '@/shared/lib/events'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getStaffUsers, lockStaffUser, type StaffUser } from '../api/staffApi'
import { FailureAlert } from '../components/FailureAlert'
import { ResetPasswordModal } from '../components/ResetPasswordModal'
import { ResetTwoFactorModal } from '../components/ResetTwoFactorModal'
import { staffColumns } from '../components/staffColumns'
import { StaffFilters } from '../components/StaffFilters'
import { StaffUserModal } from '../components/StaffUserModal'
import { NETWORK_FAILURE, notifyFailure, toFailure, type Failure } from '../lib/problems'
import { filterStaff, useStaffFilters } from '../lib/useStaffFilters'
import './staff.css'

type Dialog = { kind: 'create' } | { kind: 'edit' | 'password' | 'two-factor'; user: StaffUser }

const getRowId = (row: StaffUser) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function StaffPage() {
  const { me } = useAuth()
  const { can, isSuperuser } = usePermissions()
  const users = useApiQuery('staff-users', () => getStaffUsers())
  const roles = useApiQuery('staff-roles', () => getRoles())
  const { filters, filtered, update, reset } = useStaffFilters()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [ownPassword, setOwnPassword] = useState(false)
  const [lockTarget, setLockTarget] = useState<StaffUser | null>(null)
  const [lockFailure, setLockFailure] = useState<Failure | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const roleList = useMemo(() => roles.data ?? [], [roles.data])
  const rolesById = useMemo(() => new Map(roleList.map((role) => [role.id, role])), [roleList])
  const selfEmail = me?.email ?? ''
  const canOpenRoles = can(PermissionKeys.Staff.ManageRoles)
  const setUsers = users.setData
  const userList = users.data

  const replaceUser = useCallback(
    (saved: StaffUser) => {
      if (!userList) return
      const exists = userList.some((user) => user.id === saved.id)
      setUsers(exists ? userList.map((user) => (user.id === saved.id ? saved : user)) : [...userList, saved])
    },
    [setUsers, userList],
  )

  const changeLock = useCallback(
    async (user: StaffUser, locked: boolean) => {
      setBusyId(user.id)
      setLockFailure(null)
      try {
        const result = await withCsrf((headers) => lockStaffUser(headers, user.id, locked))
        if (result.data) {
          replaceUser(result.data)
          setLockTarget(null)
          notifySuccess(locked ? `Доступ для ${user.displayName} заблоковано.` : `Доступ для ${user.displayName} відновлено.`)
        } else if (locked) {
          setLockFailure(toFailure(result.error, 'Доступ не змінено.'))
        } else {
          notifyFailure(result.error, 'Доступ не змінено.')
        }
      } catch {
        if (locked) setLockFailure(NETWORK_FAILURE)
        else notifyFailure(undefined, NETWORK_FAILURE.title)
      }
      setBusyId(null)
    },
    [replaceUser],
  )

  const columns = useMemo(
    () =>
      staffColumns({
        selfEmail,
        busyId,
        rolesById,
        canOpenRoles,
        onEdit: (user) => setDialog({ kind: 'edit', user }),
        onPassword: (user) => setDialog({ kind: 'password', user }),
        onResetTwoFactor: (user) => setDialog({ kind: 'two-factor', user }),
        onLock: (user) => {
          if (user.lockedOut) {
            void changeLock(user, false)
            return
          }
          setLockFailure(null)
          setLockTarget(user)
        },
      }),
    [busyId, canOpenRoles, changeLock, rolesById, selfEmail],
  )

  const onRowClick = useCallback((user: StaffUser) => setDialog({ kind: 'edit', user }), [])
  const failed = users.status === 'error' || users.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : filterStaff(userList ?? [], filters)), [failed, filters, userList])

  function onSaved(saved: StaffUser) {
    replaceUser(saved)
    setDialog(null)
    users.reload()
    roles.reload()
    if (saved.email.toLowerCase() === selfEmail.toLowerCase()) notifyPermissionsChanged()
  }

  function refresh() {
    users.reload()
    roles.reload()
  }

  const emptyText = failed ? (
    <Stack align="center" gap={8}>
      <Text size="sm">{problemMessage(users.problem, 'Не вдалося завантажити працівників.')}</Text>
      <Button size="xs" variant="default" onClick={users.reload}>
        Спробувати ще раз
      </Button>
    </Stack>
  ) : filtered ? (
    'За цими умовами працівників немає.'
  ) : (
    'Працівників ще немає.'
  )

  return (
    <ListPage>
      <PageHeader
        title="Працівники"
        actions={
          <>
            <Button variant="default" leftSection={<IconKey size={16} stroke={1.8} />} onClick={() => setOwnPassword(true)}>
              Змінити мій пароль
            </Button>
            <Button leftSection={<IconUserPlus size={16} stroke={1.8} />} onClick={() => setDialog({ kind: 'create' })}>
              Додати працівника
            </Button>
          </>
        }
      />

      <StaffFilters
        filters={filters}
        filtered={filtered}
        roles={roleList}
        update={update}
        reset={reset}
        actions={
          <>
            {userList ? <span className="app-filter-summary">Знайдено: {countFormat.format(rows.length)}</span> : null}
            <Tooltip label="Оновити">
              <ActionIcon variant="default" aria-label="Оновити" loading={users.isFetching} onClick={refresh}>
                <IconRefresh size={17} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          </>
        }
      />

      <ListPageBody>
        <DataTable
          ariaLabel="Працівники"
          columns={columns}
          data={rows}
          getRowId={getRowId}
          isLoading={users.isLoading}
          isFetching={users.isFetching}
          minWidth={1180}
          height="100%"
          onRowClick={onRowClick}
          emptyText={emptyText}
        />
      </ListPageBody>

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <StaffUserModal
          key={dialog.kind === 'edit' ? dialog.user.id : 'new'}
          user={dialog.kind === 'edit' ? dialog.user : null}
          roles={roleList}
          rolesLoading={roles.isLoading}
          canGrantSuperuser={isSuperuser}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      ) : null}

      {dialog?.kind === 'password' ? <ResetPasswordModal key={dialog.user.id} user={dialog.user} onClose={() => setDialog(null)} /> : null}

      {dialog?.kind === 'two-factor' ? (
        <ResetTwoFactorModal
          key={dialog.user.id}
          user={dialog.user}
          superuser={Boolean(rolesById.get(dialog.user.roleId)?.isSuperuser)}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            replaceUser(saved)
            setDialog(null)
          }}
        />
      ) : null}

      <ChangePasswordModal opened={ownPassword} onClose={() => setOwnPassword(false)} />

      <ConfirmDialog
        opened={lockTarget !== null}
        title="Заблокувати доступ"
        danger
        confirmLabel="Заблокувати доступ"
        busy={busyId !== null}
        message={
          lockTarget ? (
            <Stack gap="sm">
              <Text size="sm">
                Заблокувати доступ для {lockTarget.displayName}? Працівник не зможе увійти, активні сесії завершаться.
              </Text>
              <FailureAlert failure={lockFailure} />
            </Stack>
          ) : (
            ''
          )
        }
        onConfirm={() => {
          if (lockTarget) void changeLock(lockTarget, true)
        }}
        onClose={() => {
          setLockTarget(null)
          setLockFailure(null)
        }}
      />
    </ListPage>
  )
}
