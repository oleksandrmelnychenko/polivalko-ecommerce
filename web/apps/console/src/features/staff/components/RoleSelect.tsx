import { Select } from '@mantine/core'
import type { StaffRole } from '@/shared/auth/permissionsApi'
import { rightsText, sortRoles } from '../lib/roleText'

type RoleSelectProps = {
  roles: readonly StaffRole[]
  value: string
  onChange: (value: string) => void
  loading?: boolean
  canGrantSuperuser: boolean
  label?: string
  description?: string
  error?: string
  disabled?: boolean
}

export function RoleSelect({ roles, value, onChange, loading = false, canGrantSuperuser, label = 'Роль', description, error, disabled }: RoleSelectProps) {
  const sorted = sortRoles(roles)
  const byId = new Map(sorted.map((role) => [role.id, role]))
  const data = sorted.map((role) => ({ value: role.id, label: role.name, disabled: role.isSuperuser && !canGrantSuperuser }))

  return (
    <Select
      label={label}
      description={description}
      error={error}
      disabled={disabled}
      data={data}
      value={value || null}
      allowDeselect={false}
      placeholder={loading ? 'Завантаження ролей…' : 'Оберіть роль'}
      nothingFoundMessage="Ролей немає"
      onChange={(next) => onChange(next ?? '')}
      renderOption={({ option }) => {
        const role = byId.get(option.value)
        const sub = role
          ? [role.isSuperuser ? 'Повний доступ' : rightsText(role.permissionCount), option.disabled ? 'призначає лише адміністратор' : null].filter(Boolean).join(' · ')
          : ''
        return (
          <span className="staff-role-option">
            <span className="staff-role-option-name">{option.label}</span>
            {sub ? <span className="staff-role-option-sub">{sub}</span> : null}
          </span>
        )
      }}
    />
  )
}
