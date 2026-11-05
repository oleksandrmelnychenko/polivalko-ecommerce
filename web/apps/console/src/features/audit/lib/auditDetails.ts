type RoleText = { name: string | null; description: string | null }

export type RoleChange =
  | { kind: 'created'; role: RoleText; permissions: string[] }
  | { kind: 'updated'; before: RoleText; after: RoleText }
  | { kind: 'deleted'; role: RoleText }
  | { kind: 'permissions'; role: RoleText; added: string[]; removed: string[] }

export type PermissionName = (key: string) => string

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function keys(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function readRoleChange(action: string, details: unknown): RoleChange | null {
  if (!isRecord(details)) return null
  switch (action) {
    case 'role.created':
      return { kind: 'created', role: { name: text(details.name), description: text(details.description) }, permissions: keys(details.permissions) }
    case 'role.updated': {
      const before = isRecord(details.before) ? details.before : {}
      const after = isRecord(details.after) ? details.after : {}
      return {
        kind: 'updated',
        before: { name: text(before.displayName) ?? text(before.name), description: text(before.description) },
        after: { name: text(after.name) ?? text(after.displayName), description: text(after.description) },
      }
    }
    case 'role.deleted':
      return { kind: 'deleted', role: { name: text(details.name), description: null } }
    case 'role.permissions_updated':
      return { kind: 'permissions', role: { name: text(details.name), description: null }, added: keys(details.added), removed: keys(details.removed) }
    default:
      return null
  }
}

const quoted = (name: string | null) => (name ? `«${name}»` : '')

export function roleChangeSummary(change: RoleChange, permissionName: PermissionName): string {
  const parts: string[] = []
  switch (change.kind) {
    case 'created':
      parts.push(quoted(change.role.name))
      if (change.permissions.length) parts.push(`Права: ${change.permissions.map(permissionName).join(', ')}`)
      break
    case 'updated':
      parts.push(change.before.name && change.before.name !== change.after.name ? `${quoted(change.before.name)} → ${quoted(change.after.name)}` : quoted(change.after.name))
      break
    case 'deleted':
      parts.push(quoted(change.role.name))
      break
    case 'permissions':
      parts.push(quoted(change.role.name))
      if (change.added.length) parts.push(`Додано: ${change.added.map(permissionName).join(', ')}`)
      if (change.removed.length) parts.push(`Вилучено: ${change.removed.map(permissionName).join(', ')}`)
      break
  }
  return parts.filter(Boolean).join(' · ')
}

export function genericSummary(details: unknown): string {
  if (!isRecord(details)) return JSON.stringify(details)
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${scalar(value)}`)
    .join('; ')
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.every((item) => typeof item !== 'object' || item === null) ? value.map(scalar).join(', ') : `[${value.length}]`
  return '{…}'
}
