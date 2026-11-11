import type { StaffRole } from '@/shared/auth/permissionsApi'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { TableChip } from '@/shared/ui/TableChip'
import type { StaffUser } from '../api/staffApi'
import { StaffAvatar } from './StaffAvatar'

type ColumnOptions = {
  selfEmail: string
  rolesById: ReadonlyMap<string, StaffRole>
}

export function staffColumns({ selfEmail, rolesById }: ColumnOptions): DataTableColumn<StaffUser>[] {
  const isSelf = (user: StaffUser) => user.email.toLowerCase() === selfEmail.toLowerCase()
  return [
    {
      id: 'name',
      header: 'Працівник',
      accessor: (row) => row.displayName.toLocaleLowerCase('uk'),
      enableSorting: true,
      width: 300,
      minWidth: 220,
      fill: true,
      cell: (row) => (
        <span className="app-split-name-cell">
          <StaffAvatar name={row.displayName} size="sm" locked={row.lockedOut} />
          <span className="staff-person">
            <span className="app-split-item-name">
              {row.displayName}
              {isSelf(row) ? <span className="staff-self"> (ви)</span> : null}
            </span>
            <span className="staff-person-email">{row.email}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'role',
      header: 'Роль',
      accessor: (row) => row.roleName.toLocaleLowerCase('uk'),
      enableSorting: true,
      width: 160,
      cell: (row) => <TableChip tone={rolesById.get(row.roleId)?.isSuperuser ? 'document' : 'neutral'} value={row.roleName} />,
    },
    {
      id: 'access',
      header: 'Доступ',
      accessor: (row) => (row.lockedOut ? 1 : 0),
      enableSorting: true,
      width: 140,
      cell: (row) => (row.lockedOut ? <TableChip dot tone="danger" value="Заблоковано" /> : <TableChip dot tone="success" value="Активний" />),
    },
    {
      id: 'twoFactor',
      header: 'Двофакторна',
      accessor: (row) => (row.twoFactorEnabled ? 1 : 0),
      enableSorting: true,
      width: 130,
      cell: (row) => (row.twoFactorEnabled ? <TableChip tone="success" value="Увімкнено" /> : <span className="app-split-item-meta is-off">вимкнено</span>),
    },
  ]
}
