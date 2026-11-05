import { Skeleton } from '@mantine/core'
import { IconShield, IconShieldLock } from '@tabler/icons-react'
import type { StaffRole } from '@/shared/auth/permissionsApi'
import { TableChip } from '@/shared/ui/TableChip'
import { rightsText, usersText } from '../lib/roleText'

type RoleListProps = {
  roles: readonly StaffRole[]
  selectedId: string
  dirty: boolean
  isLoading: boolean
  myRoleId: string | null
  onSelect: (role: StaffRole) => void
}

export function RoleList({ roles, selectedId, dirty, isLoading, myRoleId, onSelect }: RoleListProps) {
  if (isLoading) {
    return (
      <div className="roles-list" aria-busy="true">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} height={62} radius={10} className="roles-item-skeleton" />
        ))}
      </div>
    )
  }

  return (
    <nav className="roles-list" aria-label="Ролі">
      {roles.map((role) => {
        const selected = role.id === selectedId
        const RoleIcon = role.isSuperuser ? IconShieldLock : IconShield
        return (
          <button
            key={role.id}
            type="button"
            className={`roles-item${selected ? ' is-selected' : ''}`}
            aria-current={selected ? 'true' : undefined}
            onClick={() => onSelect(role)}
          >
            <span className="roles-item-icon" aria-hidden="true">
              <RoleIcon size={18} stroke={1.7} />
            </span>
            <span className="roles-item-main">
              <span className="roles-item-name">
                {role.name}
                {selected && dirty ? <span className="roles-item-dirty" title="Є незбережені зміни" aria-label="Є незбережені зміни" /> : null}
              </span>
              <span className="roles-item-meta">
                {usersText(role.userCount)} · {role.isSuperuser ? 'усі права' : rightsText(role.permissionCount)}
              </span>
              <span className="roles-item-badges">
                {role.isSystem ? <TableChip value="Системна" /> : null}
                {role.isSuperuser ? <TableChip tone="document" value="Повний доступ" /> : null}
                {role.id === myRoleId ? <TableChip tone="success" value="Ваша роль" /> : null}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
