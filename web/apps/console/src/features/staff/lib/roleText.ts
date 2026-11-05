import { formatDateTime, plural } from '@polivalko/shared/lib/format'
import type { StaffRole } from '@/shared/auth/permissionsApi'

export const countText = new Intl.NumberFormat('uk-UA')

export function rightsText(n: number): string {
  return `${countText.format(n)} ${plural(n, 'право', 'права', 'прав')}`
}

export function usersText(n: number): string {
  return `${countText.format(n)} ${plural(n, 'працівник', 'працівники', 'працівників')}`
}

export function updatedText(updatedAt: string | null | undefined, updatedBy: string | null | undefined): string | null {
  if (!updatedAt) return null
  return updatedBy ? `Оновлено ${formatDateTime(updatedAt)} · ${updatedBy}` : `Оновлено ${formatDateTime(updatedAt)}`
}

export function defaultRoleId(roles: readonly StaffRole[]): string {
  const preferred = roles.find((role) => role.isSystem && !role.isSuperuser) ?? roles.find((role) => !role.isSuperuser)
  return preferred?.id ?? ''
}

export function sortRoles(roles: readonly StaffRole[]): StaffRole[] {
  return [...roles].sort((a, b) => {
    if (a.isSuperuser !== b.isSuperuser) return a.isSuperuser ? -1 : 1
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    return a.name.localeCompare(b.name, 'uk', { sensitivity: 'base' })
  })
}
