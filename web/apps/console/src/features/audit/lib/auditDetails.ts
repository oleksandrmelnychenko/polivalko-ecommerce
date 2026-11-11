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
