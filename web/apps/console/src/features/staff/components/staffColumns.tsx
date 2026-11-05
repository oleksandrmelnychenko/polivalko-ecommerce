import { Button, Group } from '@mantine/core'
import { IconKey, IconLock, IconLockOpen, IconPencil } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import type { StaffRole } from '@/shared/auth/permissionsApi'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { StaffUser } from '../api/staffApi'

type ColumnOptions = {
  selfEmail: string
  busyId: string | null
  rolesById: ReadonlyMap<string, StaffRole>
  canOpenRoles: boolean
  onEdit: (user: StaffUser) => void
  onPassword: (user: StaffUser) => void
  onLock: (user: StaffUser) => void
}

export function staffColumns({ selfEmail, busyId, rolesById, canOpenRoles, onEdit, onPassword, onLock }: ColumnOptions): DataTableColumn<StaffUser>[] {
  const isSelf = (user: StaffUser) => user.email.toLowerCase() === selfEmail.toLowerCase()
  return [
    {
      id: 'name',
      header: 'Працівник',
      accessor: (row) => row.displayName.toLocaleLowerCase('uk'),
      enableSorting: true,
      width: 280,
      fill: true,
      cell: (row) => (
        <CellStack
          title={
            <>
              {row.displayName}
              {isSelf(row) ? <span className="staff-self"> (ви)</span> : null}
            </>
          }
          sub={row.email}
        />
      ),
    },
    {
      id: 'role',
      header: 'Роль',
      accessor: (row) => row.roleName.toLocaleLowerCase('uk'),
      enableSorting: true,
      width: 200,
      cell: (row) => {
        const role = rolesById.get(row.roleId)
        const chip = <TableChip tone={role?.isSuperuser ? 'document' : 'neutral'} value={row.roleName} />
        return canOpenRoles ? (
          <Link className="staff-role-link" to={`/system/roles?role=${encodeURIComponent(row.roleId)}`} title={`Права ролі «${row.roleName}»`}>
            {chip}
          </Link>
        ) : (
          chip
        )
      },
    },
    {
      id: 'access',
      header: 'Доступ',
      accessor: (row) => (row.lockedOut ? 1 : 0),
      enableSorting: true,
      width: 150,
      cell: (row) => (row.lockedOut ? <TableChip dot tone="danger" value="Заблоковано" /> : <TableChip dot tone="success" value="Активний" />),
    },
    {
      id: 'actions',
      header: <span className="visually-hidden">Дії</span>,
      width: 380,
      align: 'right',
      cell: (row) => (
        <Group gap={6} justify="flex-end" wrap="nowrap" className="staff-row-actions">
          <Button size="compact-sm" variant="default" leftSection={<IconPencil size={14} stroke={1.8} />} onClick={() => onEdit(row)}>
            Змінити
          </Button>
          <Button size="compact-sm" variant="default" leftSection={<IconKey size={14} stroke={1.8} />} onClick={() => onPassword(row)}>
            Новий пароль
          </Button>
          <Button
            className="staff-lock-button"
            size="compact-sm"
            variant={row.lockedOut ? 'default' : 'light'}
            color={row.lockedOut ? 'gray' : 'red'}
            leftSection={row.lockedOut ? <IconLockOpen size={14} stroke={1.8} /> : <IconLock size={14} stroke={1.8} />}
            disabled={busyId !== null}
            loading={busyId === row.id}
            onClick={() => onLock(row)}
          >
            {row.lockedOut ? 'Розблокувати' : 'Заблокувати'}
          </Button>
        </Group>
      ),
    },
  ]
}
